"""
Servicio de Insights IA usando LangChain.
Soporta: OpenAI, LM Studio (local), o reglas heurísticas como fallback.
"""
import os
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any
from django.db.models import Sum, Avg, Count
from django.db.models.functions import TruncMonth
from django.contrib.auth.models import User

from .models import Transaction, Category, Alert


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


def get_spending_summary(user: User, months: int = 2) -> Dict[str, Any]:
    """Obtiene resumen de gastos para análisis IA"""
    today = datetime.now().date()
    start_date = today - timedelta(days=months * 30)
    
    transactions = Transaction.objects.filter(
        user=user,
        date__gte=start_date,
        type='expense'
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
    
    return {
        'by_category': list(by_category),
        'by_month': list(by_month),
        'total_expense': float(total_expense),
        'transaction_count': transaction_count,
        'recurring': list(recurring),
        'period_days': months * 30
    }


def detect_anomalies(user: User) -> List[Dict]:
    """Detecta gastos inusuales (>2x del promedio de esa categoría)"""
    anomalies = []
    
    categories = Category.objects.filter(user=user, is_income=False)
    
    for cat in categories:
        transactions = Transaction.objects.filter(user=user, category=cat, type='expense')
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
    """
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    
    llm, provider = get_llm_client()
    
    if not llm:
        return generate_insights_heuristic(user)
    
    summary = get_spending_summary(user)
    
    category_text = "\n".join([
        f"- {c['category__name'] or 'Sin categoría'}: {abs(c['total']):.2f}€ ({c['count']} transacciones)"
        for c in summary['by_category'][:10]
    ])
    
    recurring_text = "\n".join([
        f"- {r['description'][:50]}: {r['count']} veces, total {abs(r['total']):.2f}€"
        for r in summary['recurring'][:5]
    ])
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Eres un asesor financiero personal experto. Analiza los gastos del usuario y proporciona:
1. Un resumen breve de sus hábitos de gasto
2. 2-3 observaciones específicas sobre categorías destacadas
3. 2-3 recomendaciones concretas para ahorrar
4. Detecta posibles suscripciones o gastos recurrentes que podrían revisarse

Sé conciso, usa emojis para hacer el texto más legible, y sé constructivo (no crítico).
Responde SOLO en español. Máximo 300 palabras."""),
        ("user", """Gastos de los últimos {days} días:

Total gastado: {total:.2f}€
Número de transacciones: {count}

Gastos por categoría:
{categories}

Gastos recurrentes detectados:
{recurring}

Dame tu análisis y recomendaciones.""")
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
            category_id=cat_id
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
