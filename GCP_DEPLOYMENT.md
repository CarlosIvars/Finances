# Guía Definitiva de Despliegue en Google Cloud (Always Free) 🚀

Esta guía contiene el paso a paso exacto para desplegar el proyecto **FinancIAs** en una máquina virtual gratuita de Google Cloud (GCP) utilizando tu arquitectura monolítica actual (Django + React en un solo contenedor) junto a PostgreSQL.

💰 **Objetivo:** 0.00€ al mes para siempre.

---

## 📋 Requisitos Previos
1. Una cuenta de Google.
2. Acceso a la [Consola de Google Cloud](https://console.cloud.google.com/).
3. Una tarjeta de crédito vinculada (Google la pide para verificar identidad, pero garantizamos que el coste será cero si sigues estos pasos al pie de la letra).

---

## 🖥️ Paso 1: Crear la Máquina Virtual (Compute Engine)

1. En el menú de GCP, ve a **Compute Engine > Instancias de VM** y haz clic en **Crear Instancia**.
2. Configura los siguientes parámetros exactos para que entre en el plan gratuito:
   - **Nombre:** `financias-server` (o el que prefieras).
   - **Región:** DEBES elegir una de estas tres: `us-central1` (Iowa), `us-east1` (Carolina del Sur) o `us-west1` (Oregón).
   - **Configuración de la máquina:** Familia de máquinas `E2`, tipo de máquina **`e2-micro`** (1 vCPU compartida, 1 GB de memoria).
   - **Disco de arranque:** Haz clic en *Cambiar*.
     - Sistema Operativo: **Ubuntu**
     - Versión: **Ubuntu 24.04 LTS** (o 22.04 LTS).
     - Tipo de disco: **Disco persistente estándar** (¡Muy importante! No elijas SSD balanceado).
     - Tamaño: **30 GB**.
   - **Firewall:** Marca ambas casillas ✅ *Permitir tráfico HTTP* y ✅ *Permitir tráfico HTTPS*.
3. Haz clic en **Crear**.

---

## 🛠️ Paso 2: Preparar la Máquina Virtual (Comandos Iníciales)

Una vez creada, haz clic en el botón **SSH** en la consola de Google Cloud para abrir una terminal en el navegador.

### 2.1 Crear Memoria Swap (CRÍTICO) ⚠️
Como la máquina solo tiene 1 GB de RAM, al compilar el Frontend (Vite/React) en el servidor, se quedará sin memoria y fallará. Vamos a crear 2 GB de memoria RAM virtual en el disco duro para evitarlo:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# Hacerlo permanente al reiniciar:
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2.2 Instalar Docker y Git
```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker y Docker Compose
sudo apt install -y docker.io docker-compose-v2 git

# Permitir a tu usuario usar docker sin "sudo"
sudo usermod -aG docker $USER
newgrp docker
```

---

## 📂 Paso 3: Clonar tu Código y Configurar `docker-compose.yml`

Descarga tu código fuente a la máquina virtual (puedes usar GitHub, GitLab o pasarlo por SSH).

```bash
git clone https://tu-repositorio/financias.git
cd financias
```

Ahora, vamos a crear el director de orquesta. Crea un archivo llamado `docker-compose.yml` en la raíz de tu proyecto:

```bash
nano docker-compose.yml
```

Pega el siguiente contenido (este archivo usa tu fantástico `Dockerfile` y une Postgres en una red interna privada):

```yaml
version: '3.8'

services:
  database:
    image: postgres:17-alpine
    container_name: financias-db
    restart: always
    environment:
      - POSTGRES_DB=financias
      - POSTGRES_USER=financias
      - POSTGRES_PASSWORD=tu_password_seguro_db
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - financias-net

  web:
    build: .
    container_name: financias-web
    restart: always
    depends_on:
      - database
    ports:
      - "80:8000"
    environment:
      - DEBUG=False
      - DB_HOST=database
      - DB_NAME=financias
      - DB_USER=financias
      - DB_PASSWORD=tu_password_seguro_db
      - SECRET_KEY=genera_una_clave_larga_y_aleatoria_aqui
      - ALLOWED_HOSTS=*
    networks:
      - financias-net

volumes:
  pgdata:

networks:
  financias-net:
    driver: bridge
```
*(Guarda pulsando `Ctrl+O`, `Enter`, y sal con `Ctrl+X`)*.

---

## 🚀 Paso 4: Desplegar la Aplicación

Con todo configurado, solo tienes que levantar tu proyecto. Esto tardará unos minutos la primera vez ya que:
1. Va a descargar Node.js y compilar tu React.
2. Va a descargar Python y empaquetar tu Django.

```bash
docker compose up -d --build
```

Cuando termine, ve a la consola de GCP, copia la **IP Externa** de tu máquina virtual y pégala en tu navegador. ¡Tu aplicación estará funcionando!

---

## 🌟 Paso 5 (Opcional pero recomendado): Un Dominio y HTTPS
Para que la aplicación sea segura y profesional, deberías comprar un dominio barato (ej. Namecheap o Cloudflare).
1. Apunta el Registro `A` de tu dominio a la IP Externa de Google Cloud.
2. En lugar de exponer el puerto `80:8000` directamente en Docker, puedes poner un contenedor como [Caddy](https://caddyserver.com/) delante para que te genere los certificados HTTPS (candado verde) automáticamente gratis con Let's Encrypt.
