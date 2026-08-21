# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

GONZA: sistema de administración de préstamos y pagos de un negocio de crédito. Backend Flask + PostgreSQL en `backend/`, frontend React (single-page, sin router) en `frontend/`. Se despliega en Railway (backend con `gunicorn` vía `Procfile`, frontend estático, y un worker de cron aparte para tareas diarias).

Todo el código, comentarios y mensajes de error están en español; sigue esa convención.

## Comandos

**Backend** (`backend/`, Python 3.11):
```bash
pip install -r requirements-dev.txt   # incluye requirements.txt + pytest
python app.py                          # dev server (usa DATABASE_URL/.env local)
python -m pytest -v                    # toda la suite
python -m pytest tests/test_pagare.py -v            # un archivo
python -m pytest tests/test_pagare.py::test_algo -v  # un test puntual
python -m py_compile app.py agregar_indices.py cron_job.py   # chequeo de sintaxis, corre en CI
```

**Frontend** (`frontend/`, Node 20):
```bash
npm ci
npm start                              # dev server (usa REACT_APP_API_URL, default http://localhost:5000)
CI=true npm test -- --watchAll=false   # suite completa una sola vez (igual que CI)
CI=true npm run build                  # build de producción
```

CI (`.github/workflows/ci.yml`) corre ambos jobs en cada push/PR a `main`: frontend (`npm ci` → test → build) y backend (`pip install -r requirements-dev.txt` → `py_compile` → `pytest`). Antes de dar por terminado un cambio, corre lo mismo localmente.

Variables de entorno requeridas están documentadas en `backend/.env.example` y `frontend/.env.example` — cópialos a `.env` para desarrollo local. `SECRET_KEY` es obligatoria: la app se niega a arrancar sin ella (evita invalidar sesiones en cada reinicio con una clave aleatoria).

## Arquitectura

### Backend — `backend/app.py` (un solo archivo, ~3400 líneas)

Todas las rutas viven en este archivo, sin blueprints. Está organizado por secciones con separadores `# ─── NOMBRE ───`; usa Grep para esas cabeceras antes de leer todo el archivo.

- **Datos**: PostgreSQL vía `psycopg2` con `RealDictCursor` (las filas llegan como dicts, no tuplas). No hay ORM — SQL directo en cada ruta.
- **Zona horaria de negocio**: todo cálculo de fecha (cortes de interés, vencidos, "días para corte") debe usar `hoy_mx()`/`ahora_mx()`, nunca `date.today()`/`datetime.now()` a secas — el servidor corre en UTC (Railway) pero el negocio opera en hora de México. `get_db()` también fija `SET TIME ZONE` a nivel de sesión de Postgres para que `NOW()`/`CURRENT_DATE` en SQL coincidan.
- **Dinero**: usar siempre `_money()` para convertir montos que llegan del JSON de la petición a `Decimal` — nunca `float()`, por imprecisión binaria.
- **Auth**: login con usuario/contraseña (`werkzeug.security`) + 2FA opcional por TOTP (`pyotp`) para administradores. La sesión es un token firmado con `itsdangerous` (`Authorization: Bearer <token>`, 8h de vigencia) — reemplaza un esquema viejo de header `X-Username` falsificable. Bloqueo de cuenta tras 5 intentos fallidos en 15 minutos (`_cuenta_bloqueada`).
- **Roles**: `administrador`, `analista`, `consultor` (solo lectura de préstamos/caja), `usuario` (solo su propia info vía `/api/mis-datos`). Se aplican con los decoradores `requiere_rol(*roles)` y `requiere_lectura(*roles_extra)` (lectura siempre permite administrador+analista, más los roles extra que se pasen).
- **Rutas de cron** (`/api/cron/*`, `/api/alertas/enviar-*`, `/api/backup/enviar`, `/api/resumen/informe`) no usan sesión de usuario sino el decorador `requiere_cron`, que exige el header `X-Cron-Secret` igual a `CRON_SECRET` (también acepta un admin autenticado, para pruebas manuales). Si `CRON_SECRET` no está configurado, la ruta queda bloqueada, no abierta.
- **Auditoría y borrado suave**: las tablas financieras (`prestamos`, `clientes`, `ahorros`, `caja`, `pagos_plazos`, `caja_movimientos`) nunca se borran físicamente — se marcan con `eliminado_en` (ver `TABLAS_CON_BORRADO_SUAVE`). Cada creación/edición/eliminación relevante se registra en la tabla `auditoria` vía `_registrar_auditoria()`, en la misma transacción que el cambio.
- **Migraciones**: `_asegurar_tablas_auxiliares()` corre en cada arranque con `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — no hay Alembic ni migraciones versionadas, el propio arranque del proceso mantiene el esquema al día. Sigue este patrón (idempotente, nunca destructivo) si agregas columnas o tablas.
- **Dominio de negocio**: `clientes` → `prestamos` (con `interes_mensual`, `capital_abonado`, cortes mensuales de interés en `cortes_interes` generados automáticamente por `_generar_cortes_faltantes`, abonos en `pagos_prestamo`, refinanciamiento en `/api/prestamos/refinanciar`) + `ahorros`, `caja`/`caja_movimientos` (con intereses del 4%), `plazos` (pagos a plazos). Reportes: PDF/XLSX de pagaré, informe de deudor, cartera vencida, y backup completo de la base (CSV/XLSX/SQL) — generados con `reportlab` y `openpyxl`.
- **Integraciones externas**: correo vía API de Resend (`enviar_correo`, usa `RESEND_API_KEY`) y WhatsApp vía API de Twilio (`enviar_whatsapp`, usa `TWILIO_*`); ambas se degradan a "no configurado" en vez de fallar si faltan las credenciales. `cron_job.py` es un proceso Railway "Worker" aparte que llama diariamente a las rutas de alertas/backup/informe usando `CRON_SECRET`.
- **Rate limiting**: `flask-limiter` con storage en memoria (un solo servidor); límite global de 200/hora y 15/min específico en `/api/login`.

### Frontend — `frontend/src/` (Create React App, sin router)

- `App.jsx` (~2400 líneas): toda la UI en un solo archivo, organizado por módulos con separadores `// ── MÓDULO: X ──`. No hay React Router — la navegación es por estado local.
- `api.js`: única puerta de salida al backend. `api(path, options)` agrega el header `Authorization: Bearer <token>` (token guardado en `sessionStorage` bajo `gonza_user`) y fuerza logout automático en un 401. `descargarArchivo()` para respuestas binarias (PDF/XLSX). También trae `useApiData` (hook de fetch+loading+error) y `usePaginacion` (paginación en cliente).
- `theme.js`: sistema de temas portado de otro proyecto del mismo autor (Nexus/Chicos Wheels) — los colores (`C`) son variables CSS (`var(--...)`), no hexadecimales fijos; el tema activo se cambia con `document.documentElement.setAttribute("data-tema", ...)`, no reasignando `C`. Para `recharts` (SVG), usar `hex(C.algo)` en vez de `C.algo` directo, porque los atributos SVG `fill`/`stroke` no siempre resuelven `var()` de forma confiable. Las fórmulas de negocio del frontend (`calcularInteresMensual`, tasa 10% mensual; `calcularCuotaMensual`) están cubiertas por `App.test.js` — si las cambias, actualiza ese test.
- `components/ui.jsx`: componentes compartidos (Card, Modal, Tabla, Btn, Inp, Sel, Kpi, etc.) usados por todos los módulos de `App.jsx`.

## Testing backend

`backend/tests/conftest.py` no usa una base de datos real: el fixture `fake_db(*resultados)` reemplaza `get_db()` por un doble que devuelve, en orden, lo que la prueba encole para cada `fetchone()`/`fetchall()` que haga la ruta bajo prueba — hay que conocer el orden exacto de queries de la ruta para encolar los resultados correctamente. El rate limiting se desactiva automáticamente en todos los tests salvo `test_rate_limit.py` (fixture `autouse` `_sin_rate_limit`).
