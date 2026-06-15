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
        INSERT INTO caja (participante, cliente_id, cuota, capital, fecha_inicio)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id;
    """, (
        participante,
        data["cliente_id"],
  
        data.get("cuota", 0),
        data.get("capital", 0),
        data.get("fecha_inicio", ""),
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
    cur.execute("""
        UPDATE caja SET participante = %s, cuota = %s, capital = %s, fecha_inicio = %s
        WHERE id = %s;
    """, (data["participante"], data["cuota"], data["capital"], data.get("fecha_inicio", ""), cid))
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
        INSERT INTO pagos_plazos (material, costo, meses_total, meses_pagados, cuota, abonado)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id;
    """, (
        data["material"],
        data.get("costo"),
        data["meses_total"],
        data.get("meses_pagados", 0),
        data.get("cuota"),
        data.get("abonado", 0),
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
    cur.execute("""
        UPDATE pagos_plazos
        SET material = %s, costo = %s, meses_total = %s, meses_pagados = %s, cuota = %s, abonado = %s
        WHERE id = %s;
    """, (
        data["material"], data.get("costo"), data["meses_total"],
        data.get("meses_pagados", 0), data.get("cuota"), data.get("abonado", 0), pid
    ))
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

def enviar_correo(destinatario, asunto, cuerpo_html):
    """Envía un correo usando la API de Resend."""
    api_key = os.environ.get("RESEND_API_KEY")
    resp = http_requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "from": "GONZA <onboarding@resend.dev>",
            "to": [destinatario],
            "subject": asunto,
            "html": cuerpo_html,
        },
        timeout=15,
    )
    if resp.status_code >= 400:
        raise Exception(f"Resend error {resp.status_code}: {resp.text}")


@app.route("/api/alertas/enviar-correos", methods=["POST"])
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

    if not alertas:
        conn.close()
        return jsonify({"mensaje": "Sin alertas pendientes, no se enviaron correos"})

    # Destinatarios: administradores y analistas con correo registrado
    cur.execute("""
        SELECT u.correo, u.nombre FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE r.nombre IN ('administrador', 'analista') AND u.activo = TRUE AND u.correo IS NOT NULL AND u.correo != '';
    """)
    destinatarios = cur.fetchall()
    conn.close()

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
