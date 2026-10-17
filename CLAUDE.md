# CLAUDE.md

## Qué es

GONZA: administración de préstamos, pagos, ahorros y caja de un negocio de crédito. Backend Flask + PostgreSQL (`backend/`), frontend React sin router (`frontend/`). Desplegado en Railway (web + worker de cron).

## Comandos

```bash
# backend/ (Python 3.11)
pip install -r requirements-dev.txt
python app.py
python -m pytest -v

# frontend/ (Node 20)
npm ci
npm start                              # usa REACT_APP_API_URL (default http://localhost:5000)
CI=true npm test -- --watchAll=false
CI=true npm run build
```

Variables en `backend/.env.example` y `frontend/.env.example`. Sin `SECRET_KEY` la app no arranca. Antes de terminar un cambio, correr lo mismo que el CI.

## Estructura

- `backend/app.py` — todas las rutas en un archivo, por secciones `# ─── NOMBRE ───` (buscarlas con Grep). SQL directo con `psycopg2` + `RealDictCursor`, sin ORM.
- `backend/cron_job.py` — worker que llama a las rutas de alertas/respaldo con `X-Cron-Secret`.
- `frontend/src/App.jsx` — toda la UI, por módulos `// ── MÓDULO: X ──`. `api.js` es la única salida al backend. `components/ui.jsx` componentes comunes.

## Reglas

- Fechas de negocio con `hoy_mx()`/`ahora_mx()`, nunca `date.today()` (el servidor corre en UTC).
- Dinero siempre con `_money()` → `Decimal`, nunca `float()`.
- Tablas financieras: borrado suave (`eliminado_en`) y auditoría con `_registrar_auditoria()` en la misma transacción.
- Esquema: `_asegurar_tablas_auxiliares()` con `IF NOT EXISTS`, idempotente y nunca destructivo (no hay Alembic).
- Roles: `requiere_rol(...)`, `requiere_lectura(...)`; rutas de cron con `requiere_cron`.
- Colores con variables CSS de `theme.js`; en `recharts` usar `hex(C.algo)`.
- Si cambian `calcularInteresMensual`/`calcularCuotaMensual`, actualizar `App.test.js`.
- Pruebas backend: `fake_db(*resultados)` devuelve resultados en el orden exacto de las consultas de la ruta.
