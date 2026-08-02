from decimal import Decimal
from unittest.mock import MagicMock

import app as app_module


def _autenticar_como(monkeypatch, username, rol):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: (username, None))
    monkeypatch.setattr(app_module, "get_rol", lambda u: rol)


def test_money_convierte_float_sin_arrastrar_imprecision_binaria():
    # float(1234.55) internamente no es exacto; Decimal(1234.55) heredaría ese
    # error. _money debe pasar por str() primero para evitarlo.
    assert app_module._money(1234.55) == Decimal("1234.55")


def test_money_redondea_a_centavos():
    assert app_module._money("10.999") == Decimal("11.00")
    assert app_module._money(10.001) == Decimal("10.00")


def test_money_acepta_string_y_entero():
    assert app_module._money("500") == Decimal("500.00")
    assert app_module._money(500) == Decimal("500.00")


def test_money_none_o_vacio_usa_default_cero():
    assert app_module._money(None) == Decimal("0.00")
    assert app_module._money("") == Decimal("0.00")


def test_money_respeta_default_personalizado():
    assert app_module._money(None, default="100") == Decimal("100.00")


def test_add_prestamo_guarda_monto_como_decimal(client, monkeypatch):
    _autenticar_como(monkeypatch, "ana", "administrador")
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.side_effect = [
        {"nombre": "Juan", "apellido_pat": "Perez", "apellido_mat": "Lopez"},
        {"id": 42},
    ]
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.post("/api/prestamos", json={
        "cliente_id": 1, "fecha_prestamo": "2026-01-01", "monto": 1234.555, "interes_mensual": 123.455,
    })

    assert resp.status_code == 201
    # call 0 = SELECT del cliente, call 1 = INSERT INTO prestamos
    insert_sql, params = cur.execute.call_args_list[1].args
    assert params[3] == Decimal("1234.56")  # redondeo bancario estándar de Decimal.quantize
    assert params[4] == Decimal("123.46")


def test_add_plazo_costo_nulo_no_se_convierte_en_cero(client, monkeypatch):
    _autenticar_como(monkeypatch, "ana", "administrador")
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.return_value = {"id": 7}
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.post("/api/plazos", json={"material": "Refrigerador", "meses_total": 12, "costo": None, "cuota": None})

    assert resp.status_code == 201
    _, params = cur.execute.call_args_list[0].args
    assert params[1] is None  # costo sigue siendo NULL, no 0.00
    assert params[4] is None  # cuota igual
