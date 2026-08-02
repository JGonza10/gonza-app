"""_datos_informe_deudor ahora busca por cliente_id, no por el texto de
deudor_nombre (que es una foto del nombre al crear cada préstamo y puede
variar entre dos préstamos del mismo cliente si su registro se editó
mientras tanto — ese desajuste hacía que un cliente con 2 préstamos a veces
solo mostrara 1 en el informe)."""

from unittest.mock import MagicMock

import app as app_module


def _autenticar_como(monkeypatch, username, rol):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: (username, None))
    monkeypatch.setattr(app_module, "get_rol", lambda u: rol)


def test_datos_informe_deudor_usa_cliente_id_no_el_nombre(monkeypatch):
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.return_value = {"nombre": "Juana Ignacia", "apellido_pat": "Ramirez", "apellido_mat": "Alvarez"}
    # Dos préstamos con deudor_nombre distinto (uno antes y otro después de
    # editar el apellido materno del cliente), ambos deben aparecer porque
    # el filtro es por cliente_id, no por el texto del nombre.
    cur.fetchall.side_effect = [
        [
            {"id": 1, "deudor_nombre": "Juana Ignacia Ramirez", "fecha_prestamo": "2026-01-01",
             "monto": 1000, "interes_mensual": 100, "pagado": False, "fecha_pago": None,
             "nota": "", "capital_abonado": 0, "saldo_capital": 1000, "tipo_pago": None},
            {"id": 2, "deudor_nombre": "Juana Ignacia Ramirez Alvarez", "fecha_prestamo": "2026-02-01",
             "monto": 2000, "interes_mensual": 200, "pagado": False, "fecha_pago": None,
             "nota": "", "capital_abonado": 0, "saldo_capital": 2000, "tipo_pago": None},
        ],
        [],  # cortes_interes
        [],  # pagos_prestamo
    ]
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    datos = app_module._datos_informe_deudor(cliente_id=7)

    assert len(datos["prestamos"]) == 2
    assert datos["deudor"] == "Juana Ignacia Ramirez Alvarez"  # nombre ACTUAL del cliente, no una foto vieja
    assert datos["resumen"]["total_prestado"] == 3000.0

    # La consulta de préstamos filtró por cliente_id, no por deudor_nombre
    sql_prestamos = cur.execute.call_args_list[1].args[0]
    assert "cliente_id" in sql_prestamos
    assert "deudor_nombre" not in sql_prestamos.split("WHERE")[1]


def test_get_informe_deudor_ruta_usa_cliente_id(client, monkeypatch):
    _autenticar_como(monkeypatch, "carla", "consultor")
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.return_value = {"nombre": "Ana", "apellido_pat": "Lopez", "apellido_mat": ""}
    cur.fetchall.side_effect = [[], [], []]
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.get("/api/clientes/7/informe-deudor")

    assert resp.status_code == 200
    assert resp.get_json()["deudor"] == "Ana Lopez"
