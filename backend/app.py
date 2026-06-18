"""
GONZA - Backend API (Flask + PostgreSQL)
Conecta la base de datos SQL con el frontend React.

CAMBIOS v2 (alineación con "Sistema de consulta de pagos"):
- Roles nuevos: consultor (solo lectura de prestamos/caja) y usuario (solo su info)
- CRUD completo de clientes y prestamos (PATCH/DELETE)
- Caja: incluye intereses (4%), fecha, nota, activo
- Ahorros y pagos a plazos: incluyen nota y activo
- Ruta /api/mis-datos para el rol "usuario"
"""

import os
import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
import requests as http_requests

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
        SELECT u.id, u.username, u.nombre, u.password_hash, u.activo,
               u.cliente_id, r.nombre AS rol
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
        "rol": usuario["rol"],
        "cliente_id": usuario["cliente_id"],
    })

def get_usuario_actual(username):
    """Devuelve {rol, cliente_id} del usuario, o None si no existe/inactivo."""
    if not username:
        return None
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT r.nombre AS rol, u.cliente_id FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE u.username = %s AND u.activo = TRUE;
    """, (username,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def get_rol(username):
    """Devuelve el rol del usuario, o None si no existe (compatibilidad)."""
    info = get_usuario_actual(username)
    return info["rol"] if info else None


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


def requiere_lectura(*roles_extra):
    """Decorador para rutas GET: permite administrador y analista siempre,
       y además los roles indicados en roles_extra (ej. 'consultor').
       Si no hay header X-Username, permite el acceso (compatibilidad)."""
    def decorador(f):
        from functools import wraps
        @wraps(f)
        def envoltura(*args, **kwargs):
            username = request.headers.get("X-Username")
            if not username:
                return f(*args, **kwargs)
            rol = get_rol(username)
            if rol is None:
                return jsonify({"error": "No autorizado"}), 401
            if rol not in ("administrador", "analista") + roles_extra:
                return jsonify({"error": "No tienes permiso para ver esta información"}), 403
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
        SELECT u.id, u.username, u.nombre, u.activo, u.correo, u.cliente_id,
               r.nombre AS rol, u.rol_id
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
            INSERT INTO usuarios (username, password_hash, nombre, rol_id, cliente_id, correo)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
        """, (
            data["username"],
            generate_password_hash(data["password"], method="pbkdf2:sha256"),
            data["nombre"],
            data["rol_id"],
            data.get("cliente_id"),
            data.get("correo", ""),
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
    """Activa/desactiva un usuario, cambia su rol, cliente vinculado o resetea su contraseña."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()

    if "activo" in data:
        cur.execute("UPDATE usuarios SET activo = %s WHERE id = %s;", (data["activo"], uid))
    if "rol_id" in data:
        cur.execute("UPDATE usuarios SET rol_id = %s WHERE id = %s;", (data["rol_id"], uid))
    if "cliente_id" in data:
        cur.execute("UPDATE usuarios SET cliente_id = %s WHERE id = %s;", (data["cliente_id"], uid))
    if "correo" in data:
        cur.execute("UPDATE usuarios SET correo = %s WHERE id = %s;", (data["correo"], uid))
    if "nombre" in data:
        cur.execute("UPDATE usuarios SET nombre = %s WHERE id = %s;", (data["nombre"], uid))
    if "password" in data and data["password"]:
        cur.execute("UPDATE usuarios SET password_hash = %s WHERE id = %s;",
                     (generate_password_hash(data["password"], method="pbkdf2:sha256"), uid))

    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Usuario actualizado"})

@app.route("/api/usuarios/<int:uid>", methods=["DELETE"])
@requiere_rol("administrador")
def delete_usuario(uid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM usuarios WHERE id = %s;", (uid,))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Usuario eliminado"})

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
@requiere_lectura("consultor")
def get_prestamos():
    """Devuelve todos los préstamos (incluye fecha de último abono a capital)."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.*,
               (SELECT MAX(pp.fecha_pago) FROM pagos_prestamo pp
                 WHERE pp.prestamo_id = p.id AND pp.monto_capital > 0) AS fecha_abono_capital
        FROM prestamos p
        ORDER BY p.fecha_prestamo DESC;
    """)
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

@app.route("/api/prestamos", methods=["POST"])
@requiere_rol("administrador", "analista")
def add_prestamo():
    """Registra un nuevo préstamo. El deudor debe ser un cliente del catálogo."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()

    # Obtener el nombre completo del cliente seleccionado
    cur.execute("SELECT nombre, apellido_pat, apellido_mat FROM clientes WHERE id = %s;", (data["cliente_id"],))
    cliente = cur.fetchone()
    if not cliente:
        conn.close()
        return jsonify({"error": "Cliente no encontrado"}), 400

    deudor_nombre = f"{cliente['nombre']} {cliente['apellido_pat']} {cliente['apellido_mat'] or ''}".strip()

    cur.execute("""
        INSERT INTO prestamos (deudor_nombre, cliente_id, fecha_prestamo, monto, interes_mensual, nota)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id;
    """, (
        deudor_nombre,
        data["cliente_id"],
        data["fecha_prestamo"],
        data["monto"],
        data["interes_mensual"],
        data.get("nota", "")
    ))
    nuevo_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return jsonify({"id": nuevo_id, "mensaje": "Préstamo registrado"}), 201

@app.route("/api/prestamos/<int:pid>", methods=["PATCH"])
@requiere_rol("administrador", "analista")
def update_prestamo(pid):
    """Edita los datos generales de un préstamo (monto, interés, nota, fecha, estado activo)."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()

    campos = []
    valores = []
    for campo in ("fecha_prestamo", "monto", "interes_mensual", "nota", "activo"):
        if campo in data:
            campos.append(f"{campo} = %s")
            valores.append(data[campo])

    if not campos:
        conn.close()
        return jsonify({"error": "Nada para actualizar"}), 400

    valores.append(pid)
    cur.execute(f"UPDATE prestamos SET {', '.join(campos)} WHERE id = %s;", valores)
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Préstamo actualizado"})

@app.route("/api/prestamos/<int:pid>", methods=["DELETE"])
@requiere_rol("administrador", "analista")
def delete_prestamo(pid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM pagos_prestamo WHERE prestamo_id = %s;", (pid,))
    cur.execute("DELETE FROM prestamos WHERE id = %s;", (pid,))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Préstamo eliminado"})

@app.route("/api/prestamos/<int:pid>/pagar", methods=["PATCH"])
@requiere_rol("administrador", "analista")
def marcar_pagado(pid):
    """Marca un préstamo como pagado (liquidación total)."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE prestamos
        SET pagado = TRUE,
            fecha_pago = %s,
            capital_abonado = monto,
            tipo_pago_id = (SELECT id FROM tipos_pago WHERE nombre = %s)
        WHERE id = %s;
    """, (data["fecha_pago"], data.get("tipo_pago", "transferencia"), pid))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Marcado como pagado"})

@app.route("/api/prestamos/<int:pid>/abono", methods=["POST"])
@requiere_rol("administrador", "analista")
def registrar_abono(pid):
    """Registra un abono parcial (interés y/o capital) a un préstamo."""
    data = request.get_json()
    monto_interes = float(data.get("monto_interes", 0))
    monto_capital = float(data.get("monto_capital", 0))
    fecha_pago = data["fecha_pago"]
    tipo_pago = data.get("tipo_pago", "transferencia")
    nota = data.get("nota", "")

    if monto_interes <= 0 and monto_capital <= 0:
        return jsonify({"error": "Debes registrar al menos un monto mayor a 0"}), 400

    conn = get_db()
    cur = conn.cursor()

    # 1. Guardar el abono en el historial
    cur.execute("""
        INSERT INTO pagos_prestamo (prestamo_id, fecha_pago, monto_interes, monto_capital, tipo_pago_id, nota)
        VALUES (%s, %s, %s, %s, (SELECT id FROM tipos_pago WHERE nombre = %s), %s)
        RETURNING id;
    """, (pid, fecha_pago, monto_interes, monto_capital, tipo_pago, nota))
    nuevo_id = cur.fetchone()["id"]

    # 2. Actualizar el capital abonado del préstamo
    cur.execute("""
        UPDATE prestamos SET capital_abonado = capital_abonado + %s
        WHERE id = %s
        RETURNING monto, capital_abonado;
    """, (monto_capital, pid))
    row = cur.fetchone()

    # 3. Si el capital abonado ya cubre el monto total, marcar como pagado
    if row["capital_abonado"] >= row["monto"] and row["monto"] > 0:
        cur.execute("""
            UPDATE prestamos
            SET pagado = TRUE, fecha_pago = %s,
                tipo_pago_id = (SELECT id FROM tipos_pago WHERE nombre = %s)
            WHERE id = %s;
        """, (fecha_pago, tipo_pago, pid))

    conn.commit()
    conn.close()
    return jsonify({"id": nuevo_id, "mensaje": "Abono registrado"}), 201

@app.route("/api/prestamos/<int:pid>/historial", methods=["GET"])
@requiere_lectura("consultor")
def get_historial_prestamo(pid):
    """Devuelve el historial de abonos de un préstamo."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT pp.id, pp.fecha_pago, pp.monto_interes, pp.monto_capital, pp.nota, tp.nombre AS tipo_pago
        FROM pagos_prestamo pp
        LEFT JOIN tipos_pago tp ON pp.tipo_pago_id = tp.id
        WHERE pp.prestamo_id = %s
        ORDER BY pp.fecha_pago DESC, pp.id DESC;
    """, (pid,))
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

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

@app.route("/api/clientes/<int:cid>", methods=["PATCH"])
@requiere_rol("administrador", "analista")
def update_cliente(cid):
    """Edita los datos de un cliente, incluyendo activar/desactivar."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()

    campos = []
    valores = []
    for campo in ("nombre", "apellido_pat", "apellido_mat", "telefono", "direccion", "activo"):
        if campo in data:
            campos.append(f"{campo} = %s")
            valores.append(data[campo])

    if not campos:
        conn.close()
        return jsonify({"error": "Nada para actualizar"}), 400

    valores.append(cid)
    cur.execute(f"UPDATE clientes SET {', '.join(campos)} WHERE id = %s;", valores)
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Cliente actualizado"})

@app.route("/api/clientes/<int:cid>", methods=["DELETE"])
@requiere_rol("administrador", "analista")
def delete_cliente(cid):
    """Elimina un cliente. Si tiene registros relacionados, sugiere desactivar en su lugar."""
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM clientes WHERE id = %s;", (cid,))
        conn.commit()
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        conn.close()
        return jsonify({
            "error": "No se puede eliminar: el cliente tiene préstamos, ahorros o registros de caja asociados. "
                     "Puedes desactivarlo en su lugar."
        }), 400
    conn.close()
    return jsonify({"mensaje": "Cliente eliminado"})

# ─── RUTAS: AHORROS ───────────────────────────────────────────────────────────

@app.route("/api/ahorros", methods=["GET"])
@requiere_lectura()
def get_ahorros():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.id, a.cliente_id, c.nombre, c.apellido_pat, c.apellido_mat,
               a.cantidad, a.fecha, a.nota, a.activo
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
            INSERT INTO ahorros (cliente_id, cantidad, fecha, nota)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
        """, (
            data["cliente_id"],
            data.get("cantidad", 0),
            data.get("fecha"),
            data.get("nota", ""),
        ))
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
    """Actualiza el monto, nota o estado de ahorro de un cliente."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()

    campos = ["updated_at = CURRENT_TIMESTAMP"]
    valores = []
    for campo in ("cantidad", "nota", "activo", "fecha"):
        if campo in data:
            campos.append(f"{campo} = %s")
            valores.append(data[campo])

    valores.append(aid)
    cur.execute(f"UPDATE ahorros SET {', '.join(campos)} WHERE id = %s;", valores)
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Ahorro actualizado"})

@app.route("/api/ahorros/<int:aid>", methods=["DELETE"])
@requiere_rol("administrador", "analista")
def delete_ahorro(aid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM ahorros WHERE id = %s;", (aid,))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Registro de ahorro eliminado"})

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
@requiere_lectura("consultor")
def get_caja():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM caja ORDER BY id;")
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

@app.route("/api/caja", methods=["POST"])
@requiere_rol("administrador", "analista")
def add_caja():
    """Agrega un participante a la caja. El participante debe ser un cliente del catálogo."""
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT nombre, apellido_pat, apellido_mat FROM clientes WHERE id = %s;", (data["cliente_id"],))
    cliente = cur.fetchone()
    if not cliente:
        conn.close()
        return jsonify({"error": "Cliente no encontrado"}), 400

    participante = f"{cliente['nombre']} {cliente['apellido_pat']} {cliente['apellido_mat'] or ''}".strip()

    cur.execute("""
        INSERT INTO caja (participante, cliente_id, cuota, capital, fecha_inicio, fecha, nota)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
    """, (
        participante,
        data["cliente_id"],
        data.get("cuota", 0),
        data.get("capital", 0),
        data.get("fecha_inicio", ""),
        data.get("fecha"),
        data.get("nota", ""),
    ))
    nuevo_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return jsonify({"id": nuevo_id}), 201

@app.route("/api/caja/<int:cid>", methods=["PATCH"])
@requiere_rol("administrador", "analista")
def update_caja(cid):
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()

    campos = []
    valores = []
    for campo in ("participante", "cuota", "capital", "fecha_inicio", "fecha", "nota", "activo"):
        if campo in data:
            campos.append(f"{campo} = %s")
            valores.append(data[campo])

    if not campos:
        conn.close()
        return jsonify({"error": "Nada para actualizar"}), 400

    valores.append(cid)
    cur.execute(f"UPDATE caja SET {', '.join(campos)} WHERE id = %s;", valores)
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Actualizado"})

@app.route("/api/caja/<int:cid>", methods=["DELETE"])
@requiere_rol("administrador", "analista")
def delete_caja(cid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM caja WHERE id = %s;", (cid,))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Eliminado"})

# ─── RUTAS: PAGOS A PLAZOS ────────────────────────────────────────────────────

@app.route("/api/plazos", methods=["GET"])
@requiere_lectura()
def get_plazos():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM pagos_plazos ORDER BY id;")
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))

@app.route("/api/plazos", methods=["POST"])
@requiere_rol("administrador", "analista")
def add_plazo():
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO pagos_plazos (material, costo, meses_total, meses_pagados, cuota, abonado, nota, fecha)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
    """, (
        data["material"],
        data.get("costo"),
        data["meses_total"],
        data.get("meses_pagados", 0),
        data.get("cuota"),
        data.get("abonado", 0),
        data.get("nota", ""),
        data.get("fecha"),
    ))
    nuevo_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return jsonify({"id": nuevo_id}), 201

@app.route("/api/plazos/<int:pid>", methods=["PATCH"])
@requiere_rol("administrador", "analista")
def update_plazo(pid):
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()

    campos = []
    valores = []
    for campo in ("material", "costo", "meses_total", "meses_pagados", "cuota", "abonado", "nota", "fecha", "activo"):
        if campo in data:
            campos.append(f"{campo} = %s")
            valores.append(data[campo])

    if not campos:
        conn.close()
        return jsonify({"error": "Nada para actualizar"}), 400

    valores.append(pid)
    cur.execute(f"UPDATE pagos_plazos SET {', '.join(campos)} WHERE id = %s;", valores)
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Actualizado"})

@app.route("/api/plazos/<int:pid>", methods=["DELETE"])
@requiere_rol("administrador", "analista")
def delete_plazo(pid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM pagos_plazos WHERE id = %s;", (pid,))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Eliminado"})

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

# ─── RUTAS: MIS DATOS (rol "usuario") ────────────────────────────────────────

@app.route("/api/mis-datos", methods=["GET"])
@requiere_rol("usuario", "administrador", "analista", "consultor")
def get_mis_datos():
    """Para el rol 'usuario': devuelve préstamos, ahorro y caja del cliente
       vinculado a su cuenta. Otros roles pueden usarlo pasando ?cliente_id=."""
    username = request.headers.get("X-Username")
    info = get_usuario_actual(username)

    cliente_id = request.args.get("cliente_id", type=int)
    if info["rol"] == "usuario":
        cliente_id = info["cliente_id"]

    if not cliente_id:
        return jsonify({"error": "No hay un cliente vinculado a este usuario"}), 400

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT * FROM clientes WHERE id = %s;", (cliente_id,))
    cliente = cur.fetchone()

    cur.execute("""
        SELECT * FROM prestamos WHERE cliente_id = %s ORDER BY fecha_prestamo DESC;
    """, (cliente_id,))
    prestamos = cur.fetchall()

    cur.execute("SELECT * FROM ahorros WHERE cliente_id = %s;", (cliente_id,))
    ahorro = cur.fetchone()

    cur.execute("SELECT * FROM caja WHERE cliente_id = %s;", (cliente_id,))
    caja = cur.fetchall()

    conn.close()
    return jsonify({
        "cliente": dict(cliente) if cliente else None,
        "prestamos": list(prestamos),
        "ahorro": dict(ahorro) if ahorro else None,
        "caja": list(caja),
    })

# ─── RUTAS: ALERTAS Y CONFIGURACIÓN ──────────────────────────────────────────

@app.route("/api/configuracion/dias_anticipacion", methods=["GET"])
def get_dias_anticipacion():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT valor FROM configuracion WHERE clave = 'dias_anticipacion_alerta';")
    row = cur.fetchone()
    conn.close()
    return jsonify({"dias_anticipacion": int(row["valor"]) if row else 2})

@app.route("/api/configuracion/dias_anticipacion", methods=["PATCH"])
@requiere_rol("administrador")
def set_dias_anticipacion(data=None):
    data = request.get_json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE configuracion SET valor = %s WHERE clave = 'dias_anticipacion_alerta';
    """, (str(int(data["dias_anticipacion"])),))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Actualizado"})

@app.route("/api/alertas", methods=["GET"])
@requiere_lectura("consultor", "usuario")
def get_alertas():
    """Préstamos cuyo próximo corte mensual está dentro de los días de anticipación configurados."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT valor FROM configuracion WHERE clave = 'dias_anticipacion_alerta';")
    row = cur.fetchone()
    dias = int(row["valor"]) if row else 2

    cur.execute("""
        SELECT id, deudor_nombre, monto, interes_mensual,
               fecha_base::text AS fecha_base,
               proximo_corte::text AS proximo_corte,
               (proximo_corte - CURRENT_DATE) AS dias_para_corte
        FROM v_alertas_prestamos
        WHERE (proximo_corte - CURRENT_DATE) BETWEEN 0 AND %s
        ORDER BY proximo_corte;
    """, (dias,))
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))
# ─── ENVÍO DE CORREOS DE ALERTA ───────────────────────────────────────────────

def enviar_correo(destinatario, asunto, cuerpo_html, adjuntos=None):
    """Envía un correo usando la API de Resend.
       adjuntos: lista de dicts {"filename": str, "content": bytes (base64-able)}"""
    import base64
    api_key = os.environ.get("RESEND_API_KEY")
    payload = {
        "from": "GONZA <onboarding@resend.dev>",
        "to": [destinatario],
        "subject": asunto,
        "html": cuerpo_html,
    }
    if adjuntos:
        payload["attachments"] = [
            {"filename": a["filename"], "content": base64.b64encode(a["content"]).decode("ascii")}
            for a in adjuntos
        ]
    resp = http_requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=30,
    )
    if resp.status_code >= 400:
        raise Exception(f"Resend error {resp.status_code}: {resp.text}")


def get_destinatarios_admin():
    """Devuelve correos de administradores y analistas activos."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.correo, u.nombre FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE r.nombre IN ('administrador', 'analista') AND u.activo = TRUE
          AND u.correo IS NOT NULL AND u.correo != '';
    """)
    rows = cur.fetchall()
    conn.close()
    return list(rows)


# ─── PROTECCIÓN CRON JOB ─────────────────────────────────────────────────────
# Las rutas de cron NO usan sesión de usuario sino un secret compartido.
# Define CRON_SECRET en las variables de entorno de Railway (o .env local).
# El cron job debe enviar el header:  X-Cron-Secret: <tu_secret>

def requiere_cron(f):
    """Decorador: permite la petición solo si el header X-Cron-Secret coincide
       con la variable de entorno CRON_SECRET.
       También acepta llamadas de un administrador autenticado (pruebas manuales)."""
    from functools import wraps
    @wraps(f)
    def envoltura(*args, **kwargs):
        cron_secret = os.environ.get("CRON_SECRET", "")

        # 1. Permitir si el header X-Cron-Secret es correcto
        header_secret = request.headers.get("X-Cron-Secret", "")
        if cron_secret and header_secret == cron_secret:
            return f(*args, **kwargs)

        # 2. Permitir si es un administrador autenticado (prueba manual desde UI)
        username = request.headers.get("X-Username", "")
        if username and get_rol(username) == "administrador":
            return f(*args, **kwargs)

        # 3. Si CRON_SECRET no está configurado en el entorno, advertir en lugar de bloquear
        if not cron_secret:
            app.logger.warning(
                "ADVERTENCIA: CRON_SECRET no configurado. "
                "Define esta variable de entorno en Railway para proteger las rutas de cron."
            )
            return f(*args, **kwargs)

        return jsonify({"error": "No autorizado. Se requiere X-Cron-Secret válido."}), 401
    return envoltura


@app.route("/api/alertas/enviar-correos", methods=["POST"])
@requiere_cron
def enviar_correos_alertas():
    """Envía un correo a cada usuario (admin/analista) con las alertas pendientes.
       Pensado para ser llamado por un cron job diario."""
    conn = get_db()
    cur = conn.cursor()

    # Días de anticipación configurados
    cur.execute("SELECT valor FROM configuracion WHERE clave = 'dias_anticipacion_alerta';")
    row = cur.fetchone()
    dias = int(row["valor"]) if row else 2

    # Alertas activas
    cur.execute("""
        SELECT deudor_nombre, monto, interes_mensual,
               proximo_corte::text AS proximo_corte,
               (proximo_corte - CURRENT_DATE) AS dias_para_corte
        FROM v_alertas_prestamos
        WHERE (proximo_corte - CURRENT_DATE) BETWEEN 0 AND %s
        ORDER BY proximo_corte;
    """, (dias,))
    alertas = cur.fetchall()
    conn.close()

    if not alertas:
        return jsonify({"mensaje": "Sin alertas pendientes, no se enviaron correos"})

    destinatarios = get_destinatarios_admin()
    if not destinatarios:
        return jsonify({"mensaje": "Sin destinatarios con correo configurado"}), 200

    # Construir el cuerpo del correo
    filas = "".join([
        f"<tr><td style='padding:6px 10px;border:1px solid #ddd'>{a['deudor_nombre']}</td>"
        f"<td style='padding:6px 10px;border:1px solid #ddd'>${a['interes_mensual']}</td>"
        f"<td style='padding:6px 10px;border:1px solid #ddd'>{a['proximo_corte']}</td>"
        f"<td style='padding:6px 10px;border:1px solid #ddd'>{'Hoy' if a['dias_para_corte']==0 else 'En ' + str(a['dias_para_corte']) + ' día(s)'}</td></tr>"
        for a in alertas
    ])
    cuerpo = f"""
    <h3>Sistema GONZA — Réditos próximos a vencer</h3>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
        <tr style="background:#0B1F4B;color:#C9A84C">
            <th style='padding:6px 10px;border:1px solid #ddd'>Deudor</th>
            <th style='padding:6px 10px;border:1px solid #ddd'>Interés</th>
            <th style='padding:6px 10px;border:1px solid #ddd'>Corte</th>
            <th style='padding:6px 10px;border:1px solid #ddd'>Vence</th>
        </tr>
        {filas}
    </table>
    """

    enviados = 0
    errores = []
    for d in destinatarios:
        try:
            enviar_correo(d["correo"], "GONZA — Alertas de réditos próximos a vencer", cuerpo)
            enviados += 1
        except Exception as e:
            errores.append(f"{d['correo']}: {str(e)}")

    return jsonify({"enviados": enviados, "errores": errores, "alertas": len(alertas)})


# ─── BACKUP DIARIO POR CORREO (CSV / XLSX / SQL) ─────────────────────────────

TABLAS_BACKUP = ["clientes", "prestamos", "pagos_prestamo", "ahorros", "caja", "pagos_plazos", "usuarios", "roles"]


def generar_backup_csv():
    """Devuelve una lista de adjuntos {filename, content} en CSV, uno por tabla."""
    import csv
    import io

    adjuntos = []
    conn = get_db()
    cur = conn.cursor()
    for tabla in TABLAS_BACKUP:
        cur.execute(f"SELECT * FROM {tabla};")
        rows = cur.fetchall()
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
            writer.writeheader()
            for r in rows:
                writer.writerow(dict(r))
        adjuntos.append({"filename": f"{tabla}.csv", "content": buf.getvalue().encode("utf-8")})
    conn.close()
    return adjuntos


def generar_backup_xlsx():
    """Devuelve un único adjunto .xlsx con una hoja por tabla."""
    import io
    from openpyxl import Workbook

    wb = Workbook()
    wb.remove(wb.active)

    conn = get_db()
    cur = conn.cursor()
    for tabla in TABLAS_BACKUP:
        cur.execute(f"SELECT * FROM {tabla};")
        rows = cur.fetchall()
        ws = wb.create_sheet(title=tabla[:31])
        if rows:
            headers = list(rows[0].keys())
            ws.append(headers)
            for r in rows:
                ws.append([str(v) if v is not None else "" for v in r.values()])
    conn.close()

    buf = io.BytesIO()
    wb.save(buf)
    return [{"filename": "gonza_backup.xlsx", "content": buf.getvalue()}]


def generar_backup_sql():
    """Genera un dump en formato SQL (INSERT statements) para cada tabla."""
    import io

    buf = io.StringIO()
    buf.write("-- GONZA backup generado automáticamente\n")

    conn = get_db()
    cur = conn.cursor()
    for tabla in TABLAS_BACKUP:
        cur.execute(f"SELECT * FROM {tabla};")
        rows = cur.fetchall()
        if not rows:
            continue
        cols = list(rows[0].keys())
        buf.write(f"\n-- Tabla: {tabla}\n")
        for r in rows:
            valores = []
            for c in cols:
                v = r[c]
                if v is None:
                    valores.append("NULL")
                elif isinstance(v, (int, float)):
                    valores.append(str(v))
                elif isinstance(v, bool):
                    valores.append("TRUE" if v else "FALSE")
                else:
                    valores.append("'" + str(v).replace("'", "''") + "'")
            buf.write(f"INSERT INTO {tabla} ({', '.join(cols)}) VALUES ({', '.join(valores)});\n")
    conn.close()

    return [{"filename": "gonza_backup.sql", "content": buf.getvalue().encode("utf-8")}]


@app.route("/api/backup/enviar", methods=["POST"])
@requiere_cron
def enviar_backup():
    """Genera un backup de la base de datos y lo envía por correo.
       Body opcional: {"formato": "csv" | "xlsx" | "sql"} (default: csv)
       Pensado para ser llamado por un cron job diario."""
    data = request.get_json(silent=True) or {}
    formato = data.get("formato", "csv")

    if formato == "csv":
        adjuntos = generar_backup_csv()
    elif formato == "xlsx":
        adjuntos = generar_backup_xlsx()
    elif formato == "sql":
        adjuntos = generar_backup_sql()
    else:
        return jsonify({"error": "Formato no soportado. Usa csv, xlsx o sql."}), 400

    destinatarios = get_destinatarios_admin()
    if not destinatarios:
        return jsonify({"mensaje": "Sin destinatarios con correo configurado"}), 200

    cuerpo = f"""
    <h3>Sistema GONZA — Respaldo diario de la base de datos</h3>
    <p>Se adjunta el respaldo en formato <b>{formato.upper()}</b> generado el día de hoy.</p>
    """

    enviados = 0
    errores = []
    for d in destinatarios:
        try:
            enviar_correo(d["correo"], f"GONZA — Respaldo diario ({formato.upper()})", cuerpo, adjuntos=adjuntos)
            enviados += 1
        except Exception as e:
            errores.append(f"{d['correo']}: {str(e)}")

    return jsonify({"enviados": enviados, "errores": errores, "formato": formato})


# ─── INFORME EJECUTIVO POR CORREO ────────────────────────────────────────────

@app.route("/api/resumen/informe", methods=["POST"])
@requiere_cron
def enviar_informe_resumen():
    """Genera un informe ejecutivo (resumen) en HTML y lo envía por correo.
       Pensado para ser llamado por un cron job diario o manual."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM v_resumen;")
    resumen = cur.fetchone()

    cur.execute("""
        SELECT deudor_nombre, SUM(monto) AS total
        FROM prestamos WHERE pagado = FALSE AND monto > 0
        GROUP BY deudor_nombre ORDER BY total DESC LIMIT 5;
    """)
    top_deudores = cur.fetchall()
    conn.close()

    fmt = lambda v: f"${float(v or 0):,.2f}"

    filas_top = "".join([
        f"<tr><td style='padding:6px 10px;border:1px solid #ddd'>{d['deudor_nombre']}</td>"
        f"<td style='padding:6px 10px;border:1px solid #ddd'>{fmt(d['total'])}</td></tr>"
        for d in top_deudores
    ])

    cuerpo = f"""
    <h2 style="color:#0B1F4B">Sistema GONZA — Informe ejecutivo</h2>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;margin-bottom:16px">
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Cartera activa</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{fmt(resumen['cartera_activa'])}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Intereses por cobrar</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{fmt(resumen.get('intereses_por_cobrar', 0))}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Capital caja de ahorro</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{fmt(resumen['total_caja'])}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Intereses caja (4%)</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{fmt(resumen.get('intereses_caja', 0))}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Total de ahorro</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{fmt(resumen['total_ahorros'])}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Préstamos pendientes</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{resumen['prestamos_pendientes']}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Préstamos pagados</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{resumen['prestamos_cobrados']}</b></td></tr>
    </table>
    <h3 style="color:#0B1F4B">Top 5 deudores</h3>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
      <tr style="background:#0B1F4B;color:#C9A84C"><th style='padding:6px 10px;border:1px solid #ddd'>Deudor</th><th style='padding:6px 10px;border:1px solid #ddd'>Monto</th></tr>
      {filas_top}
    </table>
    """

    destinatarios = get_destinatarios_admin()
    if not destinatarios:
        return jsonify({"mensaje": "Sin destinatarios con correo configurado"}), 200

    enviados = 0
    errores = []
    for d in destinatarios:
        try:
            enviar_correo(d["correo"], "GONZA — Informe ejecutivo diario", cuerpo)
            enviados += 1
        except Exception as e:
            errores.append(f"{d['correo']}: {str(e)}")

    return jsonify({"enviados": enviados, "errores": errores})


# ─── RUTA: RESUMEN ────────────────────────────────────────────────────────────

@app.route("/api/resumen", methods=["GET"])
@requiere_lectura("consultor")
def get_resumen():
    """Devuelve los totales del sistema (para el dashboard)."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM v_resumen;")
    resumen = cur.fetchone()
    conn.close()
    return jsonify(dict(resumen))

# ─── INICIO ───────────────────────────────────────────────────────────────────

# ─── RUTAS: MOVIMIENTOS DE CAJA ───────────────────────────────────────────────

@app.route("/api/caja/<int:cid>/movimientos", methods=["GET"])
def get_movimientos_caja(cid):
    """
    Devuelve el historial de aportaciones quincenales de un participante.
    Incluye el acumulado progresivo calculado con window function.
    """
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            id,
            fecha::text         AS fecha,
            monto,
            SUM(monto) OVER (
                ORDER BY fecha, id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            )                   AS acumulado,
            nota
        FROM caja_movimientos
        WHERE caja_id = %s
        ORDER BY fecha, id;
    """, (cid,))
    rows = cur.fetchall()
    conn.close()
    return jsonify(list(rows))


@app.route("/api/caja/<int:cid>/movimientos", methods=["POST"])
@requiere_rol("administrador", "analista")
def add_movimiento_caja(cid):
    """
    Registra una nueva aportación quincenal para un participante.
    Espera: { fecha, monto, nota }
    """
    data = request.get_json()

    monto = float(data.get("monto", 0))
    if monto <= 0:
        return jsonify({"error": "El monto debe ser mayor a 0"}), 400

    conn = get_db()
    cur = conn.cursor()

    # Verificar que el participante existe
    cur.execute("SELECT id FROM caja WHERE id = %s;", (cid,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Participante no encontrado"}), 404

    cur.execute("""
        INSERT INTO caja_movimientos (caja_id, fecha, monto, nota)
        VALUES (%s, %s, %s, %s)
        RETURNING id;
    """, (
        cid,
        data.get("fecha", "today"),
        monto,
        data.get("nota", ""),
    ))
    nuevo_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return jsonify({"id": nuevo_id, "mensaje": "Aportación registrada"}), 201


@app.route("/api/caja/<int:cid>/movimientos/<int:mid>", methods=["DELETE"])
@requiere_rol("administrador")
def delete_movimiento_caja(cid, mid):
    """Elimina una aportación específica (solo administradores)."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM caja_movimientos WHERE id = %s AND caja_id = %s;",
        (mid, cid)
    )
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"error": "Movimiento no encontrado"}), 404
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Movimiento eliminado"})


@app.route("/api/caja/resumen", methods=["GET"])
def get_caja_resumen():
    """
    Resumen global de la caja: total acumulado real (suma de movimientos),
    interés proyectado 0.04% anual, y total a entregar.
    """
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            COUNT(*)                        AS total_participantes,
            COALESCE(SUM(c.capital_acumulado), 0)               AS total_acumulado,
            COALESCE(SUM(c.capital_acumulado * 0.0004), 0)      AS total_interes,
            COALESCE(SUM(c.capital_acumulado * 1.0004), 0)      AS total_a_entregar
        FROM caja c;
    """)
    row = cur.fetchone()
    conn.close()
    return jsonify(dict(row))

# ─── RUTAS: RESET DE CONTRASEÑA (acceso público) ─────────────────────────────

@app.route("/api/usuario-existe", methods=["POST"])
def usuario_existe():
    """
    Verifica si un usuario existe (para el flujo de recuperación de contraseña).
    Solo devuelve nombre y username — no expone datos sensibles.
    """
    data = request.get_json()
    username = data.get("username", "").strip()
    if not username:
        return jsonify({"error": "Username requerido"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.nombre, u.activo
        FROM usuarios u
        WHERE u.username = %s;
    """, (username,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Usuario no encontrado"}), 404
    if not row["activo"]:
        return jsonify({"error": "Usuario inactivo"}), 403

    return jsonify({"username": row["username"], "nombre": row["nombre"]})


@app.route("/api/usuarios/reset-password", methods=["POST"])
def reset_password():
    """
    Restablece la contraseña de un usuario dado su username.
    No requiere autenticación (flujo de recuperación desde login).
    La nueva contraseña debe tener al menos 6 caracteres.
    """
    data = request.get_json()
    username = data.get("username", "").strip()
    new_password = data.get("new_password", "")

    if not username or not new_password:
        return jsonify({"error": "Username y nueva contraseña son requeridos"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, activo FROM usuarios WHERE username = %s;", (username,))
    row = cur.fetchone()

    if not row:
        conn.close()
        return jsonify({"error": "Usuario no encontrado"}), 404
    if not row["activo"]:
        conn.close()
        return jsonify({"error": "Usuario inactivo"}), 403

    cur.execute(
        "UPDATE usuarios SET password_hash = %s WHERE username = %s;",
        (generate_password_hash(new_password, method="pbkdf2:sha256"), username)
    )
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Contraseña restablecida correctamente"})


# ─── CORREO COMBINADO (alertas + informe + respaldo en un solo correo) ────────

@app.route("/api/correo/completo", methods=["POST"])
@requiere_cron
def enviar_correo_completo():
    """Genera y envía un único correo con 3 secciones:
       1. Alertas de réditos próximos
       2. Informe ejecutivo
       3. Respaldo de BD como adjunto Excel (.xlsx)
       Acepta body: {"formato": "xlsx" | "csv" | "sql"} (default: xlsx)
    """
    data = request.get_json(silent=True) or {}
    formato = data.get("formato", "xlsx")

    conn = get_db()
    cur = conn.cursor()

    # ── 1. Alertas ────────────────────────────────────────────────────────────
    cur.execute("SELECT valor FROM configuracion WHERE clave = 'dias_anticipacion_alerta';")
    row = cur.fetchone()
    dias = int(row["valor"]) if row else 2

    cur.execute("""
        SELECT deudor_nombre, monto, interes_mensual,
               proximo_corte::text AS proximo_corte,
               (proximo_corte - CURRENT_DATE) AS dias_para_corte
        FROM v_alertas_prestamos
        WHERE (proximo_corte - CURRENT_DATE) BETWEEN 0 AND %s
        ORDER BY proximo_corte;
    """, (dias,))
    alertas = cur.fetchall()

    if alertas:
        filas_alertas = "".join([
            f"<tr>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{a['deudor_nombre']}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>${float(a['interes_mensual'] or 0):,.2f}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{a['proximo_corte']}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{'Hoy' if a['dias_para_corte'] == 0 else f'En {a[\"dias_para_corte\"]} día(s)'}</td>"
            f"</tr>"
            for a in alertas
        ])
        seccion_alertas = f"""
        <h3 style="color:#0B1F4B;border-left:4px solid #C9A84C;padding-left:10px">🔔 Alertas de réditos próximos ({len(alertas)})</h3>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;margin-bottom:24px;width:100%">
          <tr style="background:#0B1F4B;color:#C9A84C">
            <th style='padding:6px 10px;border:1px solid #ddd;text-align:left'>Deudor</th>
            <th style='padding:6px 10px;border:1px solid #ddd;text-align:left'>Interés</th>
            <th style='padding:6px 10px;border:1px solid #ddd;text-align:left'>Corte</th>
            <th style='padding:6px 10px;border:1px solid #ddd;text-align:left'>Vence</th>
          </tr>
          {filas_alertas}
        </table>
        """
    else:
        seccion_alertas = """
        <h3 style="color:#0B1F4B;border-left:4px solid #C9A84C;padding-left:10px">🔔 Alertas de réditos</h3>
        <p style="color:#555;font-size:13px">✅ Sin alertas pendientes en los próximos días.</p>
        """

    # ── 2. Informe ejecutivo ──────────────────────────────────────────────────
    cur.execute("SELECT * FROM v_resumen;")
    resumen = cur.fetchone()

    cur.execute("""
        SELECT deudor_nombre, SUM(monto) AS total
        FROM prestamos WHERE pagado = FALSE AND monto > 0
        GROUP BY deudor_nombre ORDER BY total DESC LIMIT 5;
    """)
    top_deudores = cur.fetchall()
    conn.close()

    fmt_m = lambda v: f"${float(v or 0):,.2f}"

    filas_top = "".join([
        f"<tr>"
        f"<td style='padding:6px 10px;border:1px solid #ddd'>{d['deudor_nombre']}</td>"
        f"<td style='padding:6px 10px;border:1px solid #ddd'>{fmt_m(d['total'])}</td>"
        f"</tr>"
        for d in top_deudores
    ])

    seccion_informe = f"""
    <h3 style="color:#0B1F4B;border-left:4px solid #C9A84C;padding-left:10px">📊 Informe ejecutivo</h3>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;margin-bottom:16px">
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Cartera activa</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{fmt_m(resumen['cartera_activa'])}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Capital caja de ahorro</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{fmt_m(resumen['total_caja'])}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Total de ahorro</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{fmt_m(resumen['total_ahorros'])}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Préstamos pendientes</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{resumen['prestamos_pendientes']}</b></td></tr>
      <tr><td style='padding:6px 10px;border:1px solid #ddd'>Préstamos pagados</td><td style='padding:6px 10px;border:1px solid #ddd'><b>{resumen['prestamos_cobrados']}</b></td></tr>
    </table>
    <h4 style="color:#0B1F4B">Top 5 deudores</h4>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;margin-bottom:24px">
      <tr style="background:#0B1F4B;color:#C9A84C">
        <th style='padding:6px 10px;border:1px solid #ddd;text-align:left'>Deudor</th>
        <th style='padding:6px 10px;border:1px solid #ddd;text-align:left'>Monto</th>
      </tr>
      {filas_top}
    </table>
    """

    # ── 3. Adjunto: respaldo ──────────────────────────────────────────────────
    if formato == "csv":
        adjuntos = generar_backup_csv()
    elif formato == "sql":
        adjuntos = generar_backup_sql()
    else:
        adjuntos = generar_backup_xlsx()
        formato = "xlsx"

    seccion_backup = f"""
    <h3 style="color:#0B1F4B;border-left:4px solid #C9A84C;padding-left:10px">💾 Respaldo de base de datos</h3>
    <p style="font-family:sans-serif;font-size:13px;color:#555">
      Se adjunta el respaldo en formato <b>{formato.upper()}</b> generado hoy.
    </p>
    """

    # ── Cuerpo final ──────────────────────────────────────────────────────────
    from datetime import date
    cuerpo = f"""
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto">
      <div style="background:#0B1F4B;padding:18px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#C9A84C;margin:0">Sistema GONZA</h2>
        <p style="color:#8fa8c8;margin:4px 0 0;font-size:12px">Informe diario automático — {date.today().strftime('%d/%m/%Y')}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
        {seccion_alertas}
        {seccion_informe}
        {seccion_backup}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
        <p style="font-size:11px;color:#aaa">Este correo fue generado automáticamente por el Sistema GONZA.</p>
      </div>
    </div>
    """

    destinatarios = get_destinatarios_admin()
    if not destinatarios:
        return jsonify({"mensaje": "Sin destinatarios con correo configurado"}), 200

    enviados = 0
    errores = []
    for d in destinatarios:
        try:
            enviar_correo(
                d["correo"],
                f"GONZA — Informe diario {date.today().strftime('%d/%m/%Y')}",
                cuerpo,
                adjuntos=adjuntos
            )
            enviados += 1
        except Exception as e:
            errores.append(f"{d['correo']}: {str(e)}")

    return jsonify({
        "enviados": enviados,
        "errores": errores,
        "alertas": len(alertas),
        "formato": formato
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
