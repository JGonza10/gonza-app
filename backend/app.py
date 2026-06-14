"""
GONZA - Backend API (Flask + PostgreSQL)
Conecta la base de datos SQL con el frontend React.
"""

import os
import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

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

# ─── RUTAS: AUTENTICACIÓN ─────────────────────────────────────────────────────

@app.route("/api/login", methods=["POST"])
def login():
    """Verifica usuario y contraseña, devuelve datos del usuario y su rol."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.nombre, u.password_hash, u.activo, r.nombre AS rol
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE u.username = %s;
    """, (data.get("username", ""),))
    usuario = cur.fetchone()
    conn.close()

    if not usuario:
        return jsonify({"error": "Usuario o contraseña incorrectos"}), 401

    if not usuario["activo"]:
        return jsonify({"error": "Usuario inactivo"}), 403

    if not check_password_hash(usuario["password_hash"], data.get("password", "")):
        return jsonify({"error": "Usuario o contraseña incorrectos"}), 401

    return jsonify({
        "id": usuario["id"],
        "username": usuario["username"],
        "nombre": usuario["nombre"],
        "rol": usuario["rol"]
    })

def get_rol(username):
    """Devuelve el rol del usuario, o None si no existe."""
    if not username:
        return None
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT r.nombre AS rol FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE u.username = %s AND u.activo = TRUE;
    """, (username,))
    row = cur.fetchone()
    conn.close()
    return row["rol"] if row else None


def requiere_rol(*roles_permitidos):
    """Decorador: bloquea la ruta si el usuario no tiene uno de los roles permitidos.
       El frontend debe enviar el header 'X-Username' con cada petición."""
    def decorador(f):
        from functools import wraps
        @wraps(f)
        def envoltura(*args, **kwargs):
            username = request.headers.get("X-Username")
            rol = get_rol(username)
            if rol is None:
                return jsonify({"error": "No autorizado"}), 401
            if rol not in roles_permitidos:
                return jsonify({"error": "No tienes permiso para esta acción"}), 403
            return f(*args, **kwargs)
        return envoltura
    return decorador

# ─── RUTAS: USUARIOS ──────────────────────────────────────────────────────────

@app.route("/api/usuarios", methods=["GET"])
@requiere_rol("administrador")
def get_usuarios():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.nombre, u.activo, r.nombre AS rol, u.rol_id
        FROM usuarios u JOIN roles r ON u.rol_id = r.id
        ORDER BY u.id;
    """)
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

@app.route("/api/usuarios", methods=["POST"])
@requiere_rol("administrador")
def add_usuario():
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO usuarios (username, password_hash, nombre, rol_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
        """, (
            data["username"],
            generate_password_hash(data["password"], method="pbkdf2:sha256"),
            data["nombre"],
            data["rol_id"],
        ))
        nuevo_id = cur.fetchone()["id"]
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        conn.close()
        return jsonify({"error": "Ese nombre de usuario ya existe"}), 400
    conn.close()
    return jsonify({"id": nuevo_id}), 201

@app.route("/api/usuarios/<int:uid>", methods=["PATCH"])
@requiere_rol("administrador")
def update_usuario(uid):
    """Activa/desactiva un usuario, cambia su rol o resetea su contraseña."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()

    if "activo" in data:
        cur.execute("UPDATE usuarios SET activo = %s WHERE id = %s;", (data["activo"], uid))
    if "rol_id" in data:
        cur.execute("UPDATE usuarios SET rol_id = %s WHERE id = %s;", (data["rol_id"], uid))
    if "password" in data and data["password"]:
        cur.execute("UPDATE usuarios SET password_hash = %s WHERE id = %s;",
                     (generate_password_hash(data["password"], method="pbkdf2:sha256"), uid))

    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Usuario actualizado"})

@app.route("/api/roles", methods=["GET"])
def get_roles():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, nombre FROM roles ORDER BY id;")
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))
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
@requiere_rol("administrador", "analista")
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
@requiere_rol("administrador", "analista")
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
@requiere_rol("administrador", "analista")
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
        SELECT a.id, a.cliente_id, c.nombre, c.apellido_pat, c.apellido_mat, a.cantidad
        FROM ahorros a JOIN clientes c ON a.cliente_id = c.id
        ORDER BY c.apellido_pat;
    """)
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

@app.route("/api/ahorros", methods=["POST"])
@requiere_rol("administrador", "analista")
def add_ahorro():
    """Da de alta el registro de ahorro de un cliente (uno por cliente)."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO ahorros (cliente_id, cantidad)
            VALUES (%s, %s)
            RETURNING id;
        """, (data["cliente_id"], data.get("cantidad", 0)))
        nuevo_id = cur.fetchone()["id"]
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        conn.close()
        return jsonify({"error": "Este cliente ya tiene un registro de ahorro"}), 400
    conn.close()
    return jsonify({"id": nuevo_id}), 201

@app.route("/api/ahorros/<int:aid>", methods=["PATCH"])
@requiere_rol("administrador", "analista")
def update_ahorro(aid):
    """Actualiza el monto de ahorro de un cliente."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE ahorros SET cantidad = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s;
    """, (data["cantidad"], aid))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Ahorro actualizado"})

@app.route("/api/clientes-sin-ahorro", methods=["GET"])
@requiere_rol("administrador", "analista")
def get_clientes_sin_ahorro():
    """Clientes que aún no tienen registro en ahorros (para el formulario de alta)."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT c.id, c.nombre, c.apellido_pat, c.apellido_mat
        FROM clientes c
        WHERE c.id NOT IN (SELECT cliente_id FROM ahorros)
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
@requiere_rol("administrador", "analista")
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
