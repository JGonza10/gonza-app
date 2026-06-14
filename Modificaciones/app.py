"""
GONZA - Backend API (Flask + PostgreSQL)
Conecta la base de datos SQL con el frontend React.
"""

import os
import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Permite que el frontend (diferente URL) llame a esta API

# ─── CONEXIÓN A LA BASE DE DATOS ─────────────────────────────────────────────
# DATABASE_URL viene de la variable de entorno (Railway la inyecta automático)
# En local, la defines en .env o en tu terminal

def get_db():
    """Devuelve una conexión a PostgreSQL."""
    return psycopg2.connect(
        os.environ.get("DATABASE_URL"),
        cursor_factory=psycopg2.extras.RealDictCursor  # devuelve dicts, no tuplas
    )

# ─── RUTAS: PRÉSTAMOS ────────────────────────────────────────────────────────

@app.route("/api/prestamos", methods=["GET"])
def get_prestamos():
    """Devuelve todos los préstamos."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM prestamos ORDER BY fecha_prestamo DESC;")
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

@app.route("/api/prestamos", methods=["POST"])
def add_prestamo():
    """Registra un nuevo préstamo."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO prestamos (deudor_nombre, fecha_prestamo, monto, interes_mensual, nota)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id;
    """, (
        data["deudor_nombre"],
        data["fecha_prestamo"],
        data["monto"],
        data["interes_mensual"],
        data.get("nota", "")
    ))
    nuevo_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return jsonify({"id": nuevo_id, "mensaje": "Préstamo registrado"}), 201

@app.route("/api/prestamos/<int:pid>/pagar", methods=["PATCH"])
def marcar_pagado(pid):
    """Marca un préstamo como pagado."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE prestamos
        SET pagado = TRUE,
            fecha_pago = %s,
            tipo_pago_id = (SELECT id FROM tipos_pago WHERE nombre = %s)
        WHERE id = %s;
    """, (data["fecha_pago"], data.get("tipo_pago", "transferencia"), pid))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Marcado como pagado"})

# ─── RUTAS: CLIENTES ──────────────────────────────────────────────────────────

@app.route("/api/clientes", methods=["GET"])
def get_clientes():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM clientes ORDER BY apellido_pat, nombre;")
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

@app.route("/api/clientes", methods=["POST"])
def add_cliente():
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO clientes (nombre, apellido_pat, apellido_mat, telefono, direccion)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id;
    """, (
        data["nombre"], data["apellido_pat"],
        data.get("apellido_mat", ""), data.get("telefono", ""), data.get("direccion", "")
    ))
    nuevo_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return jsonify({"id": nuevo_id}), 201

# ─── RUTAS: AHORROS ───────────────────────────────────────────────────────────

@app.route("/api/ahorros", methods=["GET"])
def get_ahorros():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.id, c.nombre, c.apellido_pat, c.apellido_mat, a.cantidad
        FROM ahorros a JOIN clientes c ON a.cliente_id = c.id
        ORDER BY c.apellido_pat;
    """)
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

# ─── RUTAS: CAJA ──────────────────────────────────────────────────────────────

@app.route("/api/caja", methods=["GET"])
def get_caja():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM caja ORDER BY id;")
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

# ─── RUTAS: PAGOS A PLAZOS ────────────────────────────────────────────────────

@app.route("/api/plazos", methods=["GET"])
def get_plazos():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM pagos_plazos ORDER BY id;")
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

@app.route("/api/plazos/<int:pid>/abonar", methods=["PATCH"])
def abonar_plazo(pid):
    """Registra un abono mensual al artículo a plazos."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE pagos_plazos
        SET meses_pagados = LEAST(meses_pagados + 1, meses_total),
            abonado = abonado + COALESCE(cuota, 0)
        WHERE id = %s
        RETURNING meses_pagados, abonado;
    """, (pid,))
    result = cur.fetchone()
    conn.commit()
    conn.close()
    return jsonify(dict(result))

# ─── RUTA: RESUMEN ────────────────────────────────────────────────────────────

@app.route("/api/resumen", methods=["GET"])
def get_resumen():
    """Devuelve los totales del sistema (para el dashboard)."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM v_resumen;")
    resumen = cur.fetchone()
    conn.close()
    return jsonify(dict(resumen))

# ─── INICIO ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
