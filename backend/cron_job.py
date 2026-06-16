#!/usr/bin/env python3
"""
GONZA - Cron Job diario
=======================
Este script se ejecuta diariamente en Railway y llama a las tres
rutas protegidas del backend:

  1. /api/alertas/enviar-correos  → avisa réditos próximos a vencer
  2. /api/backup/enviar           → respaldo de BD (xlsx por defecto)
  3. /api/resumen/informe         → informe ejecutivo por correo

CONFIGURACIÓN (variables de entorno en Railway):
  BACKEND_URL   → URL pública del backend  ej. https://gonza-backend.up.railway.app
  CRON_SECRET   → mismo valor que en el backend                (obligatorio)
  BACKUP_FORMATO→ csv | xlsx | sql                             (default: xlsx)
  TZ            → America/Mexico_City                          (para hora local)

DEPLOY EN RAILWAY:
  1. Crea un nuevo servicio "Worker" en tu proyecto Railway.
  2. Sube solo este archivo (cron_job.py) o ponlo en la misma carpeta del backend.
  3. En "Settings > Deploy" pon como Start Command:
       python cron_job.py
  4. En "Settings > Schedule" activa el cron con expresión:
       0 8 * * *       (todos los días a las 8:00 AM México)
  5. Agrega las variables de entorno BACKEND_URL, CRON_SECRET, BACKUP_FORMATO.
"""

import os
import sys
import requests
from datetime import datetime

# ── Configuración ─────────────────────────────────────────────────────────────
BACKEND_URL    = os.environ.get("BACKEND_URL", "http://localhost:5000").rstrip("/")
CRON_SECRET    = os.environ.get("CRON_SECRET", "")
BACKUP_FORMATO = os.environ.get("BACKUP_FORMATO", "xlsx")

HEADERS = {
    "Content-Type": "application/json",
    "X-Cron-Secret": CRON_SECRET,
}

TIMEOUT = 60  # segundos por petición

# ── Utilidades ────────────────────────────────────────────────────────────────
def log(msg, nivel="INFO"):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [{nivel}] {msg}", flush=True)

def llamar(ruta, body=None, nombre=""):
    """Llama a una ruta POST del backend y retorna True si tuvo éxito."""
    url = f"{BACKEND_URL}{ruta}"
    log(f"Llamando a {nombre} → {url}")
    try:
        resp = requests.post(url, json=body or {}, headers=HEADERS, timeout=TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            log(f"{nombre} OK → {data}")
            return True
        else:
            log(f"{nombre} FALLÓ (HTTP {resp.status_code}): {resp.text}", "ERROR")
            return False
    except requests.exceptions.Timeout:
        log(f"{nombre} TIMEOUT después de {TIMEOUT}s", "ERROR")
        return False
    except Exception as e:
        log(f"{nombre} EXCEPCIÓN: {e}", "ERROR")
        return False

# ── Tareas ────────────────────────────────────────────────────────────────────
def tarea_alertas():
    return llamar(
        "/api/alertas/enviar-correos",
        {},
        "Alertas de réditos"
    )

def tarea_backup():
    return llamar(
        "/api/backup/enviar",
        {"formato": BACKUP_FORMATO},
        f"Backup ({BACKUP_FORMATO.upper()})"
    )

def tarea_informe():
    return llamar(
        "/api/resumen/informe",
        {},
        "Informe ejecutivo"
    )

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    log("=" * 55)
    log("GONZA Cron Job — Inicio")
    log(f"Backend : {BACKEND_URL}")
    log(f"Backup  : {BACKUP_FORMATO.upper()}")
    if not CRON_SECRET:
        log("ADVERTENCIA: CRON_SECRET no está definido", "WARN")

    resultados = {
        "alertas": tarea_alertas(),
        "backup":  tarea_backup(),
        "informe": tarea_informe(),
    }

    exitosos  = sum(1 for v in resultados.values() if v)
    fallidos  = sum(1 for v in resultados.values() if not v)

    log("-" * 55)
    log(f"Resumen: {exitosos}/3 tareas exitosas, {fallidos} fallidas")
    log("GONZA Cron Job — Fin")
    log("=" * 55)

    # Salir con código de error si alguna tarea falló (Railway lo registra)
    sys.exit(0 if fallidos == 0 else 1)

if __name__ == "__main__":
    main()
