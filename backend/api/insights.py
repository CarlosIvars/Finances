"""
Servicio de Insights IA usando LangChain.
Soporta: OpenAI, LM Studio (local), o reglas heurísticas como fallback.
RGPD: Anonimización de datos antes de envío a LLM + verificación de consentimiento.
"""
import os
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any
from django.db.models import Sum, Avg, Count
from django.db.models.functions import TruncMonth
from django.contrib.auth.models import User

from .models import Transaction, Category, Alert, UserConsent


def clean_llm_response(text: str) -> str:
    """
    Limpia la respuesta del LLM eliminando tokens de razonamiento.
    Los modelos como DeepSeek incluyen <think>...</think> que no deben mostrarse.
    """
    # Remove <think>...</think> blocks (including multiline)
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    # Remove any remaining opening/closing think tags
    text = re.sub(r'</?think>', '', text)
    # Clean up extra whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def anonymize_for_llm(text: str) -> str:
    """
    RGPD: Anonimiza descripciones antes de enviarlas al LLM.
    Elimina/reemplaza datos que podrían identificar o revelar datos sensibles.
    """
    # Posibles nombres propios (dos palabras capitalizadas seguidas)
    text = re.sub(r'\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\b', '[NOMBRE]', text)
    # DNI/NIE
    text = re.sub(r'\b\d{8}[A-Z]\b', '[DOC_ID]', text)
    text = re.sub(r'\b[XYZ]\d{7}[A-Z]\b', '[DOC_ID]', text)
    # Teléfonos (9 dígitos)
    text = re.sub(r'\b\d{9}\b', '[TELÉFONO]', text)
    # Tarjetas de crédito parciales
    text = re.sub(r'\b\d{4}[X*]+\d{4}\b', '[TARJETA]', text)
    # IBAN
    text = re.sub(r'\b[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}\b', '[IBAN]', text)
    # Patrones sensibles (salud, religión, política)
    text = re.sub(r'(?i)(dr\.|clínica|hospital|farmacia|consultorio|médico)', '[ESTABLECIMIENTO]', text)
    text = re.sub(r'(?i)(sindicato|partido|iglesia|mezquita|templo)', '[ORGANIZACIÓN]', text)
    text = re.sub(r'(?i)(terapia|psicólog|psiquiat|rehabilitación)', '[SERVICIO]', text)
    return text.strip()


def get_spending_summary(user: User, months: int = 2) -> Dict[str, Any]:
    """Obtiene resumen de gastos para análisis IA"""
    today = datetime.now().date()
    start_date = today - timedelta(days=months * 30)
    
    transactions = Transaction.objects.filter(
        user=user,
        date__gte=start_date,
        type='expense',
        is_deleted=False
    )
    
    # Gastos por categoría
    by_category = transactions.values('category__name', 'category__id').annotate(
        total=Sum('amount'),
        count=Count('id'),
        avg=Avg('amount')
    ).order_by('-total')
    
    # Gastos por mes
    by_month = transactions.annotate(
        month=TruncMonth('date')
    ).values('month').annotate(
        total=Sum('amount')
    ).order_by('month')
    
    # Totales
    total_expense = transactions.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    transaction_count = transactions.count()
    
    # Detectar gastos recurrentes (posibles suscripciones)
    recurring = transactions.values('description').annotate(
        count=Count('id'),
        total=Sum('amount')
    ).filter(count__gte=2).order_by('-count')[:10]
    
    # RGPD: Anonimizar descripciones de recurrentes antes de enviar al LLM
    anonymized_recurring = [
        {
            **r,
            'description': anonymize_for_llm(r['description'])
        }
        for r in recurring
    ]
    
    return {
        'by_category': list(by_category),
        'by_month': list(by_month),
        'total_expense': float(total_expense),
        'transaction_count': transaction_count,
        'recurring': anonymized_recurring,
        'period_days': months * 30
    }


def detect_anomalies(user: User) -> List[Dict]:
    """Detecta gastos inusuales (>2x del promedio de esa categoría)"""
    anomalies = []
    
    categories = Category.objects.filter(user=user, is_income=False)
    
    for cat in categories:
        transactions = Transaction.objects.filter(user=user, category=cat, type='expense', is_deleted=False)
        if transactions.count() < 3:
            continue
            
        avg_amount = transactions.aggregate(avg=Avg('amount'))['avg']
        if not avg_amount:
            continue
            
        threshold = abs(float(avg_amount)) * 2
        unusual = transactions.filter(amount__lt=-threshold).order_by('amount')[:5]
        
        for tx in unusual[:3]:
            # Get IDs of related transactions for this category
            related_tx_ids = list(transactions.values_list('id', flat=True)[:20])
            anomalies.append({
                'transaction': tx,
                'category': cat.name,
                'category_id': cat.id,
                'amount': float(tx.amount),
                'avg': float(avg_amount),
                'ratio': abs(float(tx.amount) / float(avg_amount)),
                'transaction_ids': related_tx_ids
            })
    
    return sorted(anomalies, key=lambda x: x['ratio'], reverse=True)[:5]


def get_llm_client():
    """
    Obtiene el cliente LLM según configuración.
    Prioridad: LM Studio (local) > OpenAI > Fallback heurístico
    """
    from langchain_openai import ChatOpenAI
    
    lm_studio_url = os.environ.get('LM_STUDIO_URL', 'http://localhost:1234/v1')
    lm_studio_model = os.environ.get('LM_STUDIO_MODEL', 'deepseek/deepseek-r1-0528-qwen3-8b')
    
    try:
        import requests
        response = requests.get(f"{lm_studio_url}/models", timeout=2)
        if response.status_code == 200:
            return ChatOpenAI(
                base_url=lm_studio_url,
                api_key="lm-studio",
                model=lm_studio_model,
                temperature=0.7
            ), "LM Studio (local)"
    except:
        pass
    
    openai_key = os.environ.get('OPENAI_API_KEY')
    if openai_key:
        return ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
            api_key=openai_key
        ), "OpenAI"
    
    return None, "Heurístico"


def generate_insights_with_ai(user: User) -> List[Dict]:
    """
    Genera insights usando LLM. Returns list of dicts with message and related_data.
    RGPD: Verifica consentimiento antes de procesar.
    """
    # RGPD: Verificar consentimiento para procesamiento IA
    if not UserConsent.has_consent(user, 'ai_processing'):
        return [{
            'message': '🔒 El análisis con IA está desactivado. '
                       'Actívalo desde Privacidad > Consentimientos para recibir insights personalizados.',
            'related_data': {'type': 'consent_required', 'consent_type': 'ai_processing'}
        }]

    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    
    llm, provider = get_llm_client()
    
    if not llm:
        return generate_insights_heuristic(user)

    # RGPD: Si el proveedor es externo (OpenAI), verificar consentimiento adicional
    if provider == 'OpenAI' and not UserConsent.has_consent(user, 'external_ai'):
        return [{
            'message': '🔒 Para usar IA avanzada con proveedor externo, '
                       'activa "Procesamiento por IA externa" en Privacidad > Consentimientos.',
            'related_data': {'type': 'consent_required', 'consent_type': 'external_ai'}
        }]    
    summary = get_spending_summary(user)
    
    category_text = "\n".join([
        f"- {c['category__name'] or 'Sin categoría'}: {abs(c['total']):.2f}€ ({c['count']} transacciones)"
        for c in summary['by_category'][:10]
    ])
    
    recurring_text = "\n".join([
        f"- {r['description'][:50]}: {r['count']} veces, total {abs(r['total']):.2f}€"
        for r in summary['recurring'][:5]
    ])
    
    # Professional prompts for financial analysis
    default_system_prompt = """Eres un asesor financiero personal certificado con más de 15 años de experiencia en gestión de finanzas personales.

## Tu Rol
Analizas los datos financieros del usuario para proporcionar insights accionables y personalizados.

## Formato de Respuesta (OBLIGATORIO)
Estructura tu respuesta EXACTAMENTE así:

### 📊 Resumen Ejecutivo
[2-3 líneas con el estado general de las finanzas]

### 🔍 Análisis por Categoría
[Lista las 3 categorías con mayor gasto, indicando si son elevadas]

### ⚠️ Alertas Importantes
[Si hay gastos inusuales, suscripciones duplicadas, o patrones preocupantes]

### 💡 Recomendaciones Concretas
[2-3 acciones específicas que el usuario puede tomar HOY]

### 🎯 Meta Sugerida
[Una meta de ahorro realista para el próximo mes basada en los datos]

## Reglas
- Responde SOLO en español
- Usa emojis para mejorar legibilidad
- Sé constructivo, nunca crítico o condescendiente
- Basa TODAS tus observaciones en los datos proporcionados
- Máximo 350 palabras
- NO inventes datos que no estén en el contexto"""

    default_user_prompt = """## Datos Financieros del Usuario

**Período analizado:** Últimos {days} días
**Total gastado:** {total:.2f}€
**Número de transacciones:** {count}

### Desglose por Categoría:
{categories}

### Gastos Recurrentes Detectados:
{recurring}

---
Por favor, proporciona tu análisis profesional siguiendo el formato especificado."""

    # Try to get custom prompts from DB, fall back to defaults
    from .models import LLMPrompt
    system_prompt = LLMPrompt.get_prompt('insights_system', default_system_prompt)
    user_prompt = LLMPrompt.get_prompt('insights_user', default_user_prompt)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", user_prompt)
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    try:
        response = chain.invoke({
            'days': summary['period_days'],
            'total': summary['total_expense'],
            'count': summary['transaction_count'],
            'categories': category_text or "Sin datos suficientes",
            'recurring': recurring_text or "No se detectaron gastos recurrentes"
        })
        
        # Clean thinking tokens from response (for models like DeepSeek)
        clean_response = clean_llm_response(response)
        
        # Get top category IDs for related data
        top_categories = [c['category__id'] for c in summary['by_category'][:5] if c['category__id']]
        
        return [{
            'message': f"🤖 *Análisis generado con {provider}*\n\n{clean_response}",
            'related_data': {
                'type': 'general_analysis',
                'category_ids': top_categories,
                'period_days': summary['period_days']
            }
        }]
    except Exception as e:
        print(f"Error calling LLM ({provider}): {e}")
        return generate_insights_heuristic(user)


def generate_insights_heuristic(user: User) -> List[Dict]:
    """
    Genera insights usando reglas heurísticas. Returns dicts with related_data.
    """
    insights = []
    summary = get_spending_summary(user)
    
    # Insight 1: Categoría con más gasto
    if summary['by_category']:
        top = summary['by_category'][0]
        cat_id = top.get('category__id')
        # Get transaction IDs for this category
        tx_ids = list(Transaction.objects.filter(
            user=user, 
            category_id=cat_id,
            is_deleted=False
        ).values_list('id', flat=True)[:20]) if cat_id else []
        
        insights.append({
            'message': f"💰 Tu mayor gasto es en **{top['category__name'] or 'Sin categoría'}**: "
                      f"{abs(top['total']):.2f}€ en {top['count']} transacciones.",
            'related_data': {
                'type': 'top_category',
                'category_id': cat_id,
                'transaction_ids': tx_ids
            }
        })
    
    # Insight 2: Comparar meses
    months = summary['by_month']
    if len(months) >= 2:
        prev = abs(float(months[-2]['total']))
        curr = abs(float(months[-1]['total']))
        diff = curr - prev
        pct = (diff / prev * 100) if prev > 0 else 0
        
        if diff > 0:
            msg = f"📈 Este mes has gastado **{pct:.0f}% más** que el anterior ({curr:.2f}€ vs {prev:.2f}€)."
        else:
            msg = f"📉 ¡Bien! Este mes has gastado **{abs(pct):.0f}% menos** que el anterior ({curr:.2f}€ vs {prev:.2f}€)."
        
        insights.append({
            'message': msg,
            'related_data': {
                'type': 'month_comparison',
                'current_month': str(months[-1]['month']),
                'previous_month': str(months[-2]['month'])
            }
        })
    
    # Insight 3: Gastos recurrentes
    if summary['recurring']:
        total_recurring = sum(abs(r['total']) for r in summary['recurring'][:5])
        recurring_descs = [r['description'] for r in summary['recurring'][:5]]
        
        insights.append({
            'message': f"🔄 Tienes gastos recurrentes que suman **{total_recurring:.2f}€**. "
                      f"Revisa si todos son necesarios.",
            'related_data': {
                'type': 'recurring',
                'descriptions': recurring_descs
            }
        })
    
    return insights


def create_alerts_from_insights(user: User) -> int:
    """
    Genera alertas basadas en insights con transacciones relacionadas.
    """
    insights = generate_insights_with_ai(user)
    
    created = 0
    for insight in insights:
        Alert.objects.create(
            user=user,
            type='insight',
            icon='💡',
            title='Análisis de tus finanzas',
            message=insight['message'],
            related_data=insight.get('related_data')
        )
        created += 1
    
    # Detectar anomalías con transacciones relacionadas
    for anomaly in detect_anomalies(user)[:2]:
        Alert.objects.create(
            user=user,
            type='anomaly',
            icon='⚠️',
            title=f'Gasto inusual en {anomaly["category"]}',
            message=f'Detectamos un gasto de {abs(anomaly["amount"]):.2f}€, '
                    f'que es {anomaly["ratio"]:.1f}x tu media de {abs(anomaly["avg"]):.2f}€.',
            related_data={
                'type': 'anomaly',
                'category_id': anomaly['category_id'],
                'transaction_ids': anomaly['transaction_ids'],
                'anomaly_transaction_id': anomaly['transaction'].id
            }
        )
        created += 1
    
    # Recordatorio de fin de mes
    today = datetime.now()
    last_day = (today.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    if today.day >= last_day.day - 2:
        Alert.objects.get_or_create(
            user=user,
            type='reminder',
            title='Fin de mes',
            defaults={
                'icon': '📅',
                'message': '¡Es fin de mes! Recuerda subir tu extracto bancario.',
                'related_data': {'type': 'reminder'}
            }
        )
        created += 1
    
    return created


def generate_budget_advice(user, month) -> str:
    """
    Genera consejos IA sobre cómo reducir gastos basándose en el presupuesto.
    Usa prompts de la base de datos si están configurados.
    RGPD: Verifica consentimiento antes de procesar.
    """
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    from .models import Budget, LLMPrompt

    # RGPD: Verificar consentimiento para procesamiento IA
    if not UserConsent.has_consent(user, 'ai_processing'):
        return ('🔒 El análisis con IA está desactivado. '
                'Actívalo desde Privacidad > Consentimientos.')
    
    llm, provider = get_llm_client()
    
    if not llm:
        return generate_budget_advice_heuristic(user, month)
    
    # Get budget comparison data
    next_month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    
    budgets = Budget.objects.filter(user=user, month=month).select_related('category')
    
    spending = Transaction.objects.filter(
        user=user,
        type='expense',
        is_deleted=False,
        date__gte=month,
        date__lt=next_month
    ).values('category__name').annotate(
        spent=Sum('amount')
    )
    
    spending_map = {s['category__name']: abs(float(s['spent'])) for s in spending}
    
    # Build comparison text
    comparison_text = []
    over_budget = []
    for budget in budgets:
        spent = spending_map.get(budget.category.name, 0)
        diff = float(budget.amount) - spent
        status = "✅ bajo presupuesto" if diff >= 0 else "⚠️ EXCEDIDO"
        comparison_text.append(
            f"- {budget.category.name}: Presupuesto {budget.amount}€, Gastado {spent:.2f}€ → {status}"
        )
        if diff < 0:
            over_budget.append({
                'category': budget.category.name,
                'budgeted': float(budget.amount),
                'spent': spent,
                'excess': abs(diff)
            })
    
    if not comparison_text:
        return "No tienes presupuestos definidos para este mes. ¡Define uno primero!"
    
    # Professional prompts for budget advice
    default_system = """Eres un coach financiero personal especializado en gestión de presupuestos familiares.

## Tu Misión
Ayudar al usuario a optimizar sus gastos y cumplir sus metas de ahorro de forma realista y sostenible.

## Formato de Respuesta (OBLIGATORIO)

### 📊 Estado del Presupuesto
[Resumen en 1-2 líneas: ¿está dentro o fuera del presupuesto? ¿Por cuánto?]

### ⚠️ Categorías Críticas
[Lista las categorías excedidas ordenadas por gravedad, con el % de exceso]

### 💡 Plan de Acción (3 pasos)
1. **Acción inmediata:** [Algo que pueda hacer HOY]
2. **Esta semana:** [Ajuste a implementar en los próximos 7 días]
3. **Para el próximo mes:** [Estrategia preventiva]

### 🎯 Ahorro Potencial
[Calcula cuánto podría ahorrar si implementa las recomendaciones]

## Reglas Importantes
- Responde SOLO en español
- Sé específico: menciona categorías y cantidades exactas
- Prioriza consejos prácticos sobre teóricos
- Nunca juzgues ni critiques los hábitos del usuario
- Máximo 250 palabras
- Usa emojis con moderación para mejorar legibilidad"""

    default_user = """## Mi Presupuesto de {month}

### Comparativa por Categoría:
{comparison}

### Categorías Excedidas:
{over_budget}

---
Necesito un plan concreto para reducir mis gastos y cumplir mi presupuesto el próximo mes."""

    system_prompt = LLMPrompt.get_prompt('budget_advice_system', default_system)
    user_prompt = LLMPrompt.get_prompt('budget_advice_user', default_user)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", user_prompt)
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    try:
        over_budget_text = "\n".join([
            f"- {ob['category']}: excedido en {ob['excess']:.2f}€"
            for ob in over_budget
        ]) or "Ninguna (¡bien hecho!)"
        
        response = chain.invoke({
            'month': month.strftime('%B %Y'),
            'comparison': "\n".join(comparison_text),
            'over_budget': over_budget_text
        })
        
        # Clean thinking tokens
        return clean_llm_response(response)
    except Exception as e:
        print(f"Error generating budget advice: {e}")
        return generate_budget_advice_heuristic(user, month)


def generate_budget_advice_heuristic(user, month) -> str:
    """Genera consejos heurísticos cuando no hay LLM disponible"""
    from .models import Budget
    
    next_month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    
    budgets = Budget.objects.filter(user=user, month=month).select_related('category')
    
    spending = Transaction.objects.filter(
        user=user,
        type='expense',
        is_deleted=False,
        date__gte=month,
        date__lt=next_month
    ).values('category__name').annotate(
        spent=Sum('amount')
    )
    
    spending_map = {s['category__name']: abs(float(s['spent'])) for s in spending}
    
    over_budget = []
    for budget in budgets:
        spent = spending_map.get(budget.category.name, 0)
        diff = float(budget.amount) - spent
        if diff < 0:
            over_budget.append({
                'category': budget.category.name,
                'excess': abs(diff),
                'percentage': (spent / float(budget.amount) * 100) - 100
            })
    
    if not over_budget:
        return "🎉 ¡Excelente! Estás dentro del presupuesto en todas las categorías. ¡Sigue así!"
    
    # Sort by excess amount
    over_budget.sort(key=lambda x: x['excess'], reverse=True)
    
    advice = ["📊 **Análisis de tu presupuesto:**\n"]
    for ob in over_budget[:3]:
        advice.append(f"⚠️ **{ob['category']}**: Excedido en {ob['excess']:.2f}€ ({ob['percentage']:.0f}% sobre el presupuesto)")
    
    advice.append("\n💡 **Consejos:**")
    advice.append("1. Revisa los gastos de las categorías excedidas")
    advice.append("2. Considera ajustar el presupuesto si es muy restrictivo")
    advice.append("3. Busca alternativas más económicas para tus gastos habituales")
    
    return "\n".join(advice)

