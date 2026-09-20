---
name: graphify-config
description: "Configura, instala o prepara Graphify en un nuevo clon del repositorio. Usar cuando el usuario pida configurar, activar, instalar, inicializar o reparar Graphify, su gitignore, las instrucciones de Copilot o el hook post-commit."
argument-hint: "Configura Graphify en este repositorio"
user-invocable: true
---

# Configurar Graphify

Prepara cualquier clon Git para trabajar con Graphify. Esta skill contiene la
guía completa: no depende de documentación presente en el repositorio destino.

## Reglas

- Trabaja desde la raíz obtenida con `git rev-parse --show-toplevel`.
- Inspecciona cada archivo antes de modificarlo y conserva su contenido existente.
- No borres ningún `graphify-out/` local.
- Nunca añadas archivos de `graphify-out/` a Git.
- No hagas commits automáticamente.
- No ejecutes `git rm` sin confirmación explícita del usuario.
- No sustituyas una configuración de hooks existente sin confirmación.
- El fallo de Graphify tras un commit no debe alterar el resultado del commit.
- Haz cambios idempotentes: no dupliques reglas, instrucciones ni bloques del hook.

## 1. Comprobar requisitos

Comprueba la instalación sin asumir que `uv` o Graphify están disponibles:

```bash
command -v uv || true
command -v graphify || true
graphify --version
```

Si falta `uv`, comprueba que `curl` está disponible e instálalo:

```bash
command -v curl
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Sigue las indicaciones del instalador para incorporar `uv` al `PATH` de la
sesión actual y valida con `uv --version`. No uses `sudo` ni instales paquetes
del sistema de forma interactiva.

Si falta Graphify y `uv` está disponible, ejecuta:

```bash
uv tool install graphifyy
graphify --version
```

Aunque el paquete se llama `graphifyy`, los ejecutables son `graphify` y
`graphify-mcp`.

## 2. Instalar integraciones

Desde la raíz del repositorio ejecuta:

```bash
graphify vscode install
graphify copilot install
```

Después revisa `.github/copilot-instructions.md`. Conserva las instrucciones
del proyecto. Si el instalador no incorporó una sección equivalente, añade o
actualiza una única sección `## Graphify` que indique:

- usar `graphify query "<pregunta>"` primero para preguntas sobre arquitectura,
  estructura, componentes y ubicación o modificación de código cuando exista
  `graphify-out/graph.json`;
- usar `graphify path "<A>" "<B>"` para relaciones;
- usar `graphify explain "<concepto>"` para conceptos concretos;
- no versionar `graphify-out/`;
- pedir o ejecutar `graphify update .` cuando el grafo esté desactualizado.

Para navegación amplia, puede leer `graphify-out/wiki/index.md` si existe. Solo
debe leer `graphify-out/GRAPH_REPORT.md` para revisiones amplias o cuando
`query`, `path` y `explain` no aporten contexto suficiente. No reemplaces otras
secciones de `.github/copilot-instructions.md`.

## 3. Ignorar los artefactos

Comprueba que `.gitignore` contiene exactamente una regla equivalente a:

```gitignore
# Graphify generated artifacts
**/graphify-out/
```

Añádela si falta. Verifica la ruta raíz y una ruta anidada sin crear archivos:

```bash
git check-ignore -v graphify-out/.probe
git check-ignore -v nested/graphify-out/.probe
```

Comprueba por separado si ya existen artefactos versionados:

```bash
git ls-files -- ':(glob)**/graphify-out/**'
```

Si el comando devuelve archivos, informa al usuario y solicita confirmación
antes de retirarlos únicamente del índice con:

```bash
git rm -r --cached --ignore-unmatch -- ':(glob)**/graphify-out/**'
```

Explica que los archivos permanecerán en disco gracias a `--cached`. No uses
`rm -rf` ni elimines los grafos locales.

## 4. Configurar exclusiones de Graphify

Inspecciona `.graphifyignore` si existe y conserva sus reglas. Antes de la
primera extracción, añade solo exclusiones que correspondan a directorios
generados o dependencias presentes en el repositorio. Ejemplos habituales:

```gitignore
.git/
**/graphify-out/
**/.venv/
**/venv/
**/venv_*/
**/node_modules/
**/__pycache__/
**/dist/
**/build/
```

No ignores directorios de código fuente solo por ser grandes. Para archivos
vendorizados o generados específicos, explica la exclusión propuesta.

## 5. Configurar el hook post-commit

Primero comprueba la configuración local:

```bash
git config --local --get core.hooksPath || true
```

- Si no devuelve nada, usa `.githooks` y configúralo al terminar.
- Si devuelve `.githooks`, conserva esa configuración.
- Si devuelve otra ruta, no la reemplaces: explica el conflicto y solicita
    confirmación antes de integrar Graphify en esa ruta o migrar los hooks.

Crea o actualiza `.githooks/post-commit` sin sobrescribir lógica existente. Si
ya existe, conserva su shebang y su comportamiento e integra un único bloque
delimitado por `BEGIN graphify-config` y `END graphify-config`. Si no existe,
usa este contenido:

```bash
#!/usr/bin/env bash

# BEGIN graphify-config
if command -v graphify >/dev/null 2>&1; then
    repo_root="$(git rev-parse --show-toplevel)" || repo_root=""
    if [ -n "$repo_root" ] && [ -f "$repo_root/graphify-out/graph.json" ]; then
        echo "[post-commit] Actualizando Graphify..."
        (cd "$repo_root" && graphify update .) \
            || echo "[post-commit] Graphify no pudo actualizarse."
    fi
fi
# END graphify-config
exit 0
```

Si no había otra ruta de hooks configurada, actívalo para el clon actual:

```bash
chmod +x .githooks/post-commit
git config core.hooksPath .githooks
```

El hook se ejecuta después del commit. Como `graphify-out/` está ignorado, sus
artefactos permanecen locales y no contaminan el siguiente commit. El hook no
crea el grafo inicial y siempre deja intacto el resultado del commit.

## 6. Crear o actualizar el grafo

Si no existe `graphify-out/graph.json`, usa el flujo recomendado solo para
código, sin extracción semántica mediante LLM:

```bash
graphify extract . --code-only
graphify cluster-only . --no-viz
```

Si el grafo ya existe, ejecuta:

```bash
graphify update .
```

Respeta `.graphifyignore`. Si el grafo incluye entornos virtuales, dependencias
o archivos generados, propón exclusiones específicas antes de reextraer.

## 7. Validar

Ejecuta estas comprobaciones:

```bash
graphify --version
git config --local --get core.hooksPath
test -x .githooks/post-commit
test -f graphify-out/graph.json
git check-ignore -q graphify-out/graph.json
test -z "$(git ls-files -- ':(glob)**/graphify-out/**')"
git status --short
```

La configuración es correcta cuando Graphify responde, `core.hooksPath` es
`.githooks`, el hook es ejecutable, existe el grafo local y `graphify-out/` está
ignorado y ausente del índice de Git. Si se ha conservado otra ruta de hooks,
valida el hook en esa ruta en vez de exigir `.githooks`.

Al terminar, resume los archivos modificados, las comprobaciones realizadas y
cualquier acción que requiera confirmación del usuario.

