# 💰 FinancIAs — Intelligent Personal Finance Manager

<p align="center">
  <strong>Gestión financiera inteligente con IA, Open Banking (PSD2), captura automática de notificaciones bancarias y cumplimiento RGPD.</strong>
</p>

---

## 📋 Índice

- [Descripción General](#-descripción-general)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Tech Stack](#-tech-stack)
- [Funcionalidades — App Web](#-funcionalidades--app-web)
- [Funcionalidades — App Móvil (Android)](#-funcionalidades--app-móvil-android)
- [API REST — Catálogo de Endpoints](#-api-rest--catálogo-de-endpoints)
- [Base de Datos](#-base-de-datos)
- [Seguridad y RGPD](#-seguridad-y-rgpd)
- [Despliegue](#-despliegue)
- [Desarrollo Local](#-desarrollo-local)
- [Variables de Entorno](#-variables-de-entorno)
- [Scripts Disponibles](#-scripts-disponibles)
- [Roadmap](#-roadmap)

---

## 🎯 Descripción General

**FinancIAs** es una plataforma completa de gestión de finanzas personales compuesta por tres componentes principales:

| Componente | Tecnología | Descripción |
|---|---|---|
| **Backend API** | Django 6 + DRF | API REST con JWT, IA integrada, Open Banking y RGPD |
| **Frontend Web** | React 19 + Vite + PWA | SPA con gráficos interactivos, modo offline y tema oscuro/claro |
| **App Móvil** | Kotlin + Jetpack Compose | Captura automática de notificaciones bancarias, SQLite cifrado |

### Características Principales
- 📊 **Dashboard financiero** con KPIs, gráficos y tendencias mensuales
- 🏦 **Open Banking (PSD2)** — Conexión directa con bancos españoles
- 📱 **Captura de notificaciones** — Intercepta push de Sabadell, Bizum y Google Wallet
- 🤖 **IA Financiera** — Insights automáticos, detección de anomalías y consejo presupuestario
- 📁 **Importación de extractos** — Soporta `.xls`, `.xlsx`, `.csv` con categorización automática
- 🔒 **RGPD/GDPR completo** — Consentimiento granular, exportación de datos, derecho al olvido
- 🌐 **Modo Offline (PWA)** — IndexedDB + Service Worker con sincronización automática
- 💰 **Presupuestos mensuales** — Límites por categoría con alertas de exceso

---

## 🏗 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO FINAL                            │
├──────────────────────┬──────────────────────────────────────────┤
│                      │                                          │
│   📱 App Móvil       │   🌐 App Web (PWA)                      │
│   Kotlin/Compose     │   React 19 / Vite / TailwindCSS         │
│   Room SQLite        │   IndexedDB (offline)                    │
│   NotificationListener│   Service Worker (Workbox)              │
│         │            │         │                                │
│         │ REST/JSON  │         │ REST/JSON + JWT                │
│         ▼            │         ▼                                │
│   ┌──────────────────┴─────────────────────┐                   │
│   │        🔧 Backend API (Django 6)       │                   │
│   │    Django REST Framework + SimpleJWT    │                   │
│   │                                        │                   │
│   │  ┌─────────┐  ┌──────────┐  ┌───────┐ │                   │
│   │  │ api/    │  │ banking/ │  │ RGPD  │ │                   │
│   │  │ CRUD    │  │ PSD2     │  │ Audit │ │                   │
│   │  │ Import  │  │ OAuth    │  │ ARCO  │ │                   │
│   │  │ Sync    │  │ Sync     │  │       │ │                   │
│   │  └────┬────┘  └────┬─────┘  └───┬───┘ │                   │
│   │       │            │             │     │                   │
│   │       ▼            ▼             ▼     │                   │
│   │  ┌──────────────────────────────────┐  │                   │
│   │  │   PostgreSQL 17 / SQLite (dev)   │  │                   │
│   │  └──────────────────────────────────┘  │                   │
│   │                                        │                   │
│   │  ┌──────────────────────────────────┐  │                   │
│   │  │   🤖 Motor IA                    │  │                   │
│   │  │   LM Studio (local) → OpenAI    │  │                   │
│   │  │   Anonymizer RGPD + Prompts     │  │                   │
│   │  └──────────────────────────────────┘  │                   │
│   └────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Tech Stack

### Backend
| Categoría | Tecnología |
|---|---|
| Framework | Python 3.12, Django 6.0.2, DRF 3.14+ |
| Autenticación | JWT (SimpleJWT) — Access 15min, Refresh 1d, rotación + blacklist |
| Base de datos | PostgreSQL 17 (prod) / SQLite3 (dev) |
| IA/LLM | LM Studio local (DeepSeek R1 8B) → OpenAI (gpt-4o-mini) → Heurístico |
| Importación | pandas, openpyxl, xlrd |
| Seguridad | Fernet AES (tokens bancarios), HSTS, SSL redirect, audit middleware |
| Servidor | Gunicorn + WhiteNoise (SPA + estáticos) |

### Frontend
| Categoría | Tecnología |
|---|---|
| Framework | React 19, TypeScript 5.9, Vite 7 |
| Estilos | TailwindCSS 3.4, tema oscuro/claro |
| Gráficos | Recharts (BarChart, PieChart, AreaChart) |
| Iconos | Lucide React |
| PWA/Offline | vite-plugin-pwa, Workbox, IndexedDB (idb) |
| HTTP | Axios con interceptor JWT y cola de refresco |

### App Móvil (Android)
| Categoría | Tecnología |
|---|---|
| Plataforma | Android SDK 35, minSdk 26 (Android 8.0+) |
| Lenguaje | Kotlin 2.0.21, JVM Target 17 |
| UI | Jetpack Compose (BOM 2024.10.01) + Material 3 |
| Base de datos | Room SQLite 2.6.1 con KSP |
| Seguridad | EncryptedSharedPreferences (AES-256-GCM, Android Keystore) |
| Notificaciones | NotificationListenerService |

---

## 🌐 Funcionalidades — App Web

### 1. 📊 Dashboard (Inicio)
- **KPIs principales**: Balance total, ingresos del periodo, gastos del periodo
- **Selector de periodo**: Mes actual, histórico completo, o meses anteriores
- **Gráfico "Presupuesto vs Gasto Real"**: Barras horizontales agrupadas por categoría
- **Gráfico "Ingresos vs Gastos Mensual"**: Barras verticales de los últimos 6 meses
- **Gráfico "Distribución de Gastos"**: Donut chart con las 8 categorías principales
- **Movimientos recientes**: Lista de las últimas transacciones con badge de tipo
- **Botón "Análisis IA"**: Genera insights financieros on-demand con notificación toast

### 2. 🏦 Open Banking (Bancos)
- **Conexión PSD2 con bancos**: Soporte para Sabadell, BBVA, Santander, CaixaBank, ING, Revolut
- **Flujo OAuth completo**: Redirige al banco → Autorización → Callback con tokens cifrados
- **Gestión de conexiones**: Estado de salud (activa/pendiente/expirada/revocada)
- **Cuentas vinculadas**: IBAN, saldo disponible en tiempo real, tipo de cuenta
- **Movimientos bancarios**: Historial de transacciones importadas por cuenta
- **Sincronización manual**: Botón de sync con registro de operaciones (SyncLog)
- **Desconexión segura**: Revocación de consentimiento sin eliminar historial
- **Banner de seguridad PSD2**: Indicador visual de acceso solo-lectura (AIS)

### 3. 📝 Transacciones (Movimientos)
- **Tabla completa** con todas las transacciones del usuario
- **Búsqueda en tiempo real**: Por concepto, importe o categoría
- **Filtros combinables**: Por mes, tipo (ingresos/gastos), categoría
- **Ordenación por columna**: Fecha, concepto, categoría, importe (asc/desc)
- **Edición inline de categoría**: Click en badge → selector → guardar/cancelar
- **Auto-aprendizaje**: Al recategorizar, el backend crea reglas automáticas (`ClassificationRule`)
- **Indicador de sin categoría**: Badge "⚠️ Sin categoría" para transacciones pendientes

### 4. 📈 Análisis Financiero
- **Gráfico de evolución del balance**: AreaChart continuo con gradiente dinámico (verde si positivo, rojo si negativo)
- **Selectores de timeframe**: MAX, 1 Año, 6 Meses, 3 Meses, 1 Mes
- **KPIs de periodo**: Balance inicial, balance actual, variación absoluta, variación %
- **Balance máximo y mínimo** del periodo seleccionado
- **Línea de referencia en 0**: Indicador visual de zona de deuda

### 5. 💰 Presupuesto Mensual
- **Configuración por categoría**: Input numérico para cada categoría de gasto
- **Selector de mes**: Dropdown con 6 meses anteriores y 3 futuros
- **KPIs resumen**: Presupuesto total, gastado, diferencia (verde/rojo)
- **Barras de progreso**: Por categoría, coloreadas según consumo (<80% azul, >100% rojo)
- **Guardado en lote**: Endpoint `bulk_save` para persistir todos los presupuestos a la vez
- **Consejo IA**: Botón "Obtener Consejos" que llama al LLM para análisis de hábitos

### 6. 🤖 Insights IA
- **Feed de alertas inteligentes**: Anomalías, insights, recordatorios y metas
- **Codificación por color**: Rosa (anomalía), azul (insight), ámbar (recordatorio), verde (meta)
- **Expandir/colapsar**: Click en tarjeta muestra mensaje completo con markdown formateado
- **Transacciones relacionadas**: Deep-link a las transacciones que generaron la alerta
- **Marcar como leído**: Automático al expandir, con opción de "leer todo"
- **Eliminar alerta**: Botón de dismiss individual
- **Generación on-demand**: Botón "Generar Análisis" con rate-limit (3/hora)

### 7. 📁 Importar Movimientos
- **Drag & Drop**: Zona interactiva con feedback visual (borde + fondo)
- **Selector de archivo**: Soporte para `.xls`, `.xlsx`, `.csv`
- **Pipeline en 2 fases**: Upload → Procesamiento (parsing, limpieza, categorización)
- **Deduplicación automática**: Evita reimportar transacciones existentes
- **Sanitización PII**: Elimina números de tarjeta, referencias, datos personales
- **Auto-categorización**: Aplica reglas existentes + aprendizaje adaptativo
- **Feedback detallado**: Banner verde con nº de transacciones creadas o banner rojo con error

### 8. 🔒 Privacidad y Datos (RGPD)
- **Gestión de consentimiento (Art. 7)**: Toggles granulares para IA, IA externa, analítica, Open Banking
- **Transparencia de perfilado (Art. 22)**: Desglose de datos usados vs. no usados por la IA
- **Exportación de datos (Art. 15/20)**: Descarga JSON con todas las transacciones, categorías, presupuestos y consentimientos
- **Derecho al olvido (Art. 17)**: Eliminación de cuenta con confirmación "ELIMINAR", anonimización de consentimientos
- **Bloqueo de tratamiento esencial**: Toggle deshabilitado para almacenamiento básico (siempre activo)

### 9. ➕ Gasto Rápido (FAB Flotante)
- **Botón flotante "+"**: Visible en todas las pantallas
- **Formulario rápido**: Importe, categoría (8 chips de color), descripción opcional
- **Offline-first**: Guarda en IndexedDB si no hay conexión
- **Indicador de estado**: Pill "Online"/"Offline" con contador de pendientes
- **Sincronización automática**: Envía al backend al reconectarse

### 10. 🔔 Campana de Notificaciones
- **Polling cada 30s**: Comprueba alertas no leídas
- **Badge con contador**: Muestra nº de alertas nuevas (máx "9+")
- **Popover**: Lista de notificaciones recientes con timestamps relativos
- **Acciones**: Marcar individual como leída, marcar todas, dismiss

### 11. 🎨 Tema Oscuro/Claro
- **Toggle global**: Persistido en localStorage
- **Detección del sistema**: Usa `prefers-color-scheme` como valor inicial

### 12. 🔐 Autenticación
- **Login**: Usuario + contraseña con JWT (access + refresh)
- **Registro**: Validación de complejidad (8+ chars, mayúscula, minúscula, número), RGPD consent obligatorio
- **Modal legal**: Términos y condiciones RGPD completos con cláusulas de minimización de datos, perfilado IA y derechos ARCO
- **Auto-login post-registro**: JWT emitido tras registro exitoso

---

## 📱 Funcionalidades — App Móvil (Android)

### Navegación (5 pestañas)
| Pestaña | Funcionalidad |
|---|---|
| 🏠 **Inicio** | Balance, ingresos, gastos, tasa de ahorro, acciones rápidas, últimos 5 movimientos |
| 📝 **Movimientos** | Buscador, filtros (tipo + categoría), FAB para añadir, eliminar con confirmación |
| 📊 **Análisis** | Desglose por categoría con barras animadas, mayor gasto, total operaciones |
| 💰 **Presupuestos** | Progreso global, tarjetas por categoría (<80% verde, 80-100% ámbar, >100% rojo) |
| 🏦 **Bancos** | Estado del listener, entidades rastreadas, simulador de pruebas, log en vivo |

### Captura Automática de Notificaciones
- **NotificationListenerService**: Intercepta notificaciones de apps bancarias en tiempo real
- **Apps soportadas**: Banco Sabadell, Google Wallet, Google Pay
- **Parsing regex**: 5 patrones (Bizum recibido, Bizum enviado, tarjeta Sabadell, Wallet formato 1 y 2)
- **Categorización automática**: Motor de palabras clave (Mercadona→Alimentación, Repsol→Transporte, etc.)
- **Deduplicación**: Hash SHA-256 por notificación con índice único en SQLite
- **Buffer de diagnóstico**: Últimas 150 notificaciones capturadas en memoria para inspección

### Gestión de Datos
- **Base de datos local**: Room SQLite (`financias_local.db`) con 2 tablas (transactions, budgets)
- **Cifrado de preferencias**: EncryptedSharedPreferences con AES-256-GCM (Android Keystore)
- **Backup/Restore**: Exportar JSON al portapapeles / Importar JSON desde portapapeles
- **Borrado seguro**: Vaciado completo con diálogo de confirmación

### Ajustes (SettingsScreen)
- **Estado del cifrado**: Indicador visual del Keystore hardware
- **Sincronización Cloud**: Campos para URL del servidor y API Key (cifrados)
- **Test de conexión**: Ping HTTP al backend configurado
- **Toggles de rastreo**: Activar/desactivar Sabadell, Bizum, Google Wallet individualmente

---

## 📡 API REST — Catálogo de Endpoints

### Autenticación
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/token/` | Obtener par JWT (access + refresh) |
| `POST` | `/api/token/refresh/` | Refrescar token con rotación y blacklist |
| `POST` | `/api/register/` | Registro con validación RGPD + auto-login |

### Recursos Financieros
| Método | Endpoint | Descripción |
|---|---|---|
| `GET/POST` | `/api/accounts/` | Listar/crear cuentas bancarias |
| `GET/PUT/PATCH/DELETE` | `/api/accounts/{id}/` | CRUD cuenta individual |
| `GET/POST` | `/api/categories/` | Listar/crear categorías |
| `GET/PUT/PATCH/DELETE` | `/api/categories/{id}/` | CRUD categoría (valida ownership) |
| `GET/POST` | `/api/transactions/` | Listar/crear transacciones |
| `GET/PUT/PATCH/DELETE` | `/api/transactions/{id}/` | CRUD transacción (PATCH trigger auto-learn) |
| `GET/POST` | `/api/rules/` | Listar/crear reglas de clasificación |
| `GET/PUT/PATCH/DELETE` | `/api/rules/{id}/` | CRUD regla individual |

### Importación de Extractos
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/imports/` | Subir archivo (multipart/form-data) |
| `POST` | `/api/imports/{id}/process_file/` | Procesar extracto bancario |

### Presupuestos
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/budgets/?month=YYYY-MM-01` | Presupuestos del mes |
| `POST` | `/api/budgets/bulk_save/` | Guardar presupuestos en lote |
| `GET` | `/api/budgets/comparison/?month=YYYY-MM-01` | Comparación presupuesto vs gasto real |
| `POST` | `/api/budgets/get_advice/` | Consejo IA de presupuesto |

### Alertas e Insights IA
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/alerts/` | Listar alertas activas |
| `GET` | `/api/alerts/unread_count/` | Contador de no leídas |
| `POST` | `/api/alerts/generate_insights/` | Generar análisis IA (3/hora) |
| `POST` | `/api/alerts/{id}/mark_read/` | Marcar como leída |
| `POST` | `/api/alerts/mark_all_read/` | Marcar todas como leídas |
| `POST` | `/api/alerts/{id}/dismiss/` | Descartar alerta |

### Sincronización Móvil
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/sync/status/` | Estado del servidor (contadores + timestamp) |
| `POST` | `/api/sync/pull/` | Descargar cambios desde el servidor |
| `POST` | `/api/sync/push/` | Enviar transacciones desde móvil |

### Open Banking (PSD2)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/banking/institutions/` | Bancos disponibles |
| `GET/POST` | `/api/banking/connections/` | Listar/crear conexiones bancarias |
| `POST` | `/api/banking/connections/{id}/sync/` | Forzar sincronización |
| `DELETE` | `/api/banking/connections/{id}/` | Revocar consentimiento |
| `GET` | `/api/banking/connections/{id}/accounts/` | Cuentas de la conexión |
| `GET` | `/api/banking/connections/{id}/sync-logs/` | Historial de sincronizaciones |
| `GET` | `/api/banking/callback/` | Callback OAuth (redirect automático) |
| `GET` | `/api/banking/accounts/{id}/transactions/` | Transacciones de cuenta bancaria |

### Privacidad RGPD
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/user/data/` | Exportar todos mis datos (Art. 15/20) |
| `DELETE` | `/api/user/data/` | Eliminar cuenta y datos (Art. 17) |
| `GET/POST` | `/api/user/consent/` | Gestionar consentimientos (Art. 7) |
| `GET` | `/api/user/profiling-info/` | Transparencia de perfilado (Art. 22) |

---

## 🗄 Base de Datos

### Backend (PostgreSQL / SQLite)

#### App `api`
| Modelo | Descripción |
|---|---|
| `Account` | Cuentas bancarias del usuario (nombre, banco, saldo inicial, moneda) |
| `Category` | Categorías jerárquicas (ingreso/gasto, color, parent) |
| `Transaction` | Movimiento financiero (importe, tipo, categoría, cuenta, batch de importación) |
| `ImportBatch` | Lote de importación de extracto bancario (archivo, estado) |
| `ClassificationRule` | Regla keyword→categoría para auto-clasificación |
| `Alert` | Alerta IA (tipo: anomaly/insight/reminder/goal, datos relacionados JSON) |
| `Budget` | Presupuesto mensual por categoría (unique: user+category+month) |
| `LLMPrompt` | Prompts editables para el motor IA (sistema y usuario) |
| `UserConsent` | Registro de consentimientos RGPD (append-only, anonimizable) |
| `AuditLog` | Log de auditoría inmutable (acción, recurso, IP, detalles) |

#### App `banking`
| Modelo | Descripción |
|---|---|
| `BankConnection` | Conexión PSD2 (provider, tokens cifrados Fernet, estado, consentimiento) |
| `BankAccount` | Cuenta bancaria externa (IBAN, saldo, nombre cifrado, tipo) |
| `BankTransaction` | Transacción bancaria sincronizada (dedup por external_id) |
| `SyncLog` | Registro de operaciones de sincronización |

### Móvil (Room SQLite)

| Tabla | Campos Clave |
|---|---|
| `transactions` | id (PK), description, amount, currency, type, category, date, timestamp, source, notificationHash (unique), rawText |
| `budgets` | categoryId (PK), categoryName, monthlyLimit, colorHex |

> ⚠️ **Nota**: Los esquemas de backend y móvil son intencionalmente diferentes. Se comunican vía REST API (JSON), no por replicación de BD.

---

## 🔒 Seguridad y RGPD

### Medidas de Seguridad
- **JWT con rotación**: Access 15min + Refresh 1d + blacklist automático
- **Cifrado de tokens bancarios**: AES Fernet simétrico para access/refresh tokens de Open Banking
- **Cifrado móvil**: EncryptedSharedPreferences con AES-256-GCM respaldado por Android Keystore
- **Sanitización PII**: Eliminación de DNI/NIE, teléfonos, tarjetas, IBANs antes de enviar al LLM
- **Headers de seguridad**: HSTS (1 año), SSL redirect, X-Content-Type-Options, HttpOnly cookies
- **Throttling**: Anónimo 5/min, autenticado 60/min, insights 3/hora
- **Aislamiento de usuario**: Todos los ViewSets filtran por `request.user`

### Cumplimiento RGPD
| Artículo | Implementación |
|---|---|
| Art. 7 — Consentimiento | Gestión granular con toggles, registro append-only |
| Art. 15 — Acceso | Exportación JSON completa de todos los datos |
| Art. 17 — Supresión | Eliminación con confirmación "ELIMINAR", anonimización de consents |
| Art. 20 — Portabilidad | Descarga en formato JSON estructurado |
| Art. 22 — Decisiones automatizadas | Transparencia de perfilado IA con datos usados/excluidos |
| Art. 32 — Seguridad | Cifrado, audit logs, minimización de datos |

---

## 🚀 Despliegue

### Docker (Producción)

```bash
# Build de la imagen (multi-stage: frontend + backend)
docker build -t financias .

# Ejecutar con Docker Compose (PostgreSQL + App)
# Ver GCP_DEPLOYMENT.md para la configuración completa
```

**Dockerfile multi-stage:**
1. **Stage 1**: `node:22-alpine` — Compila React/Vite (`npm run build`)
2. **Stage 2**: `python:3.12-slim` — Django + Gunicorn + WhiteNoise con frontend embebido

### GCP (Always Free Tier)
- **Máquina**: `e2-micro` (1 vCPU, 1 GB RAM) en `us-central1`
- **Disco**: 30 GB standard persistent disk
- **Swap**: 2 GB (mitigación OOM durante builds)
- **Servicios**: Docker Compose con `postgres:17-alpine` + app container
- Detalles completos en [`GCP_DEPLOYMENT.md`](GCP_DEPLOYMENT.md)

---

## 💻 Desarrollo Local

### Requisitos Previos
- Python 3.12+
- Node.js 22+
- Android Studio (para la app móvil)

### Inicio Rápido

```bash
# 1. Clonar el repositorio
git clone https://github.com/CarlosIvars/Finances.git
cd Finances

# 2. Arrancar todo (backend + frontend) con un solo comando
./dev.sh

# 3. Acceder a la aplicación
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/api/
# Admin Django: http://localhost:8000/admin/
```

### Inicio Manual

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r ../requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev

# Móvil (en Android Studio)
# Abrir carpeta mobile/ → Sync Gradle → Run ▶️
```

---

## ⚙️ Variables de Entorno

Crear `backend/.env`:

| Variable | Default | Descripción |
|---|---|---|
| `SECRET_KEY` | `dev-only-insecure...` | Clave secreta Django (**cambiar en prod**) |
| `DEBUG` | `True` | `False` en producción |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Hosts permitidos |
| `DB_ENGINE` | `sqlite3` | `postgresql` en producción |
| `DB_NAME` | `financias` | Nombre de la BD PostgreSQL |
| `DB_USER` | `financias` | Usuario PostgreSQL |
| `DB_PASSWORD` | `financias` | Contraseña PostgreSQL |
| `DB_HOST` | `localhost` | Host PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `LM_STUDIO_URL` | `http://localhost:1234/v1` | URL del LLM local |
| `LM_STUDIO_MODEL` | `deepseek/deepseek-r1-0528-qwen3-8b` | Modelo LLM cargado |
| `OPENAI_API_KEY` | *(vacío)* | API key OpenAI (fallback) |
| `BANKING_PROVIDER` | `mock` | Proveedor banking: `mock`/`redsys`/`powens`/`truelayer` |
| `BANKING_ENCRYPTION_KEY` | *(Fernet base64)* | Clave cifrado tokens bancarios |
| `FRONTEND_URL` | `http://localhost:5173` | URL del frontend (CORS + redirects) |

---

## 📜 Scripts Disponibles

### Desarrollo
| Comando | Descripción |
|---|---|
| `./dev.sh` | Arranca backend + frontend simultáneamente |
| `npm run dev` | Servidor Vite con proxy API |
| `npm run build` | Build producción del frontend |
| `npm run lint` | ESLint del frontend |

### Backend
| Comando | Descripción |
|---|---|
| `python manage.py migrate` | Aplicar migraciones |
| `python manage.py createsuperuser` | Crear admin |
| `python manage.py runserver` | Servidor de desarrollo |

### Utilidades (`test/`)
| Script | Descripción |
|---|---|
| `bulk_import.py` | Importación masiva de extractos para testing |
| `create_categories.py` | Seed de categorías predeterminadas |
| `inspect_excel.py` | Inspeccionar estructura de archivo Excel bancario |
| `reimport_clean.py` | Limpiar y reimportar datos de test |

### Móvil
| Comando | Descripción |
|---|---|
| `./mobile/gradlew assembleDebug` | Build APK debug |
| `./mobile/gradlew test` | Tests unitarios Android |

---

## 🗺 Roadmap

### En Progreso
- [ ] Motor de deduplicación cross-source (Wallet + Sabadell misma transacción)
- [ ] Categorización IA on-device (Gemini Nano / API cloud)
- [ ] Sincronización bidireccional móvil ↔ web

### Planificado
- [ ] Recategorización manual desde móvil y web
- [ ] Gráficos interactivos en la app móvil (Recharts equivalente)
- [ ] Notificaciones push desde el backend
- [ ] Open Banking real (Redsys/TrueLayer) en producción
- [ ] Multi-moneda con conversión automática
- [ ] Metas de ahorro con tracking visual

---

## 📄 Licencia

Proyecto privado de Carlos Ivars. Todos los derechos reservados.