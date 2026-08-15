"""Refinanciación/reestructuración de préstamos: consolida el saldo (y,
opcionalmente, el interés vencido sin cobrar) de uno o varios préstamos
activos de un mismo cliente en un préstamo nuevo, y cierra los originales."""

from datetime import date
from unittest.mock import MagicMock

import app as app_module


def _autenticar_como(monkeypatch, username, rol):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: (username, None))
    monkeypatch.setattr(app_module, "get_rol", lambda u: rol)


def test_refinanciar_consolida_el_saldo_de_los_prestamos_seleccionados(client, monkeypatch):
    _autenticar_como(monkeypatch, "carla", "administrador")
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.side_effect = [
        {"nombre": "Ana", "apellido_pat": "Lopez", "apellido_mat": ""},  # cliente
        {"id": 55},  # préstamo nuevo (RETURNING id)
    ]
    cur.fetchall.return_value = [
        {"id": 1, "monto": 1000, "capital_abonado": 200, "interes_mensual": 0, "fecha_prestamo": date(2026, 1, 1)},
        {"id": 2, "monto": 500, "capital_abonado": 0, "interes_mensual": 0, "fecha_prestamo": date(2026, 2, 1)},
    ]
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.post("/api/prestamos/refinanciar", json={
        "cliente_id": 7,
        "prestamo_ids": [1, 2],
        "fecha_prestamo": "2026-03-01",
        "interes_mensual": 130,
        "incluir_intereses_pendientes": False,
        "nota": "Consolidación por atraso",
    })

    assert resp.status_code == 201
    body = resp.get_json()
    assert body["id"] == 55
    assert body["monto"] == 1300.0  # (1000-200) + (500-0)


def test_refinanciar_capitaliza_intereses_pendientes_cuando_se_pide(client, monkeypatch):
    _autenticar_como(monkeypatch, "carla", "administrador")
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.side_effect = [
        {"nombre": "Ana", "apellido_pat": "Lopez", "apellido_mat": ""},  # cliente
        {"total": 150},                                                  # SUM interés pendiente
        {"id": 55},                                                      # préstamo nuevo
    ]
    cur.fetchall.return_value = [
        {"id": 1, "monto": 1000, "capital_abonado": 0, "interes_mensual": 0, "fecha_prestamo": date(2026, 1, 1)},
    ]
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.post("/api/prestamos/refinanciar", json={
        "cliente_id": 7,
        "prestamo_ids": [1],
        "fecha_prestamo": "2026-03-01",
        "incluir_intereses_pendientes": True,
    })

    assert resp.status_code == 201
    assert resp.get_json()["monto"] == 1150.0  # 1000 de saldo + 150 de interés capitalizado


def test_refinanciar_rechaza_si_algun_prestamo_no_es_valido(client, monkeypatch):
    _autenticar_como(monkeypatch, "carla", "administrador")
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.return_value = {"nombre": "Ana", "apellido_pat": "Lopez", "apellido_mat": ""}
    # Solo regresa 1 de los 2 préstamos pedidos (el otro ya está pagado, eliminado o es de otro cliente)
    cur.fetchall.return_value = [
        {"id": 1, "monto": 1000, "capital_abonado": 0, "interes_mensual": 0, "fecha_prestamo": date(2026, 1, 1)},
    ]
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.post("/api/prestamos/refinanciar", json={
        "cliente_id": 7,
        "prestamo_ids": [1, 2],
        "fecha_prestamo": "2026-03-01",
    })

    assert resp.status_code == 400
    assert "no son válidos" in resp.get_json()["error"]


def test_refinanciar_requiere_cliente_prestamos_y_fecha(client, monkeypatch):
    _autenticar_como(monkeypatch, "carla", "administrador")

    resp = client.post("/api/prestamos/refinanciar", json={"cliente_id": 7, "prestamo_ids": []})

    assert resp.status_code == 400


def test_refinanciar_rechaza_rol_consultor(client, monkeypatch):
    _autenticar_como(monkeypatch, "carla", "consultor")

    resp = client.post("/api/prestamos/refinanciar", json={
        "cliente_id": 7, "prestamo_ids": [1], "fecha_prestamo": "2026-03-01",
    })

    assert resp.status_code == 403
