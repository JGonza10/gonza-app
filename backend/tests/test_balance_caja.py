"""/api/reportes/balance-caja: "debe de capital" es monto - abonado de los
préstamos activos y cada préstamo trae su desglose (monto, abonado, saldo,
nota) para poder revisar de dónde sale la cifra de cada persona."""

from unittest.mock import MagicMock

import app as app_module


def _autenticar_como(monkeypatch, username, rol):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: (username, None))
    monkeypatch.setattr(app_module, "get_rol", lambda u: rol)


def test_balance_caja_desglosa_cada_prestamo(client, monkeypatch):
    _autenticar_como(monkeypatch, "carla", "consultor")
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchall.side_effect = [
        [
            {"id": 1, "cliente_id": 7, "deudor_nombre": "Ramon Mejia", "fecha_prestamo": "2026-01-01",
             "monto": 10000, "capital_abonado": 2000, "nota": "", "saldo_capital": 8000},
            {"id": 2, "cliente_id": 7, "deudor_nombre": "Ramon Mejia", "fecha_prestamo": "2026-03-01",
             "monto": 5000, "capital_abonado": 0, "nota": "Refinanciación", "saldo_capital": 5000},
        ],
        [{"cliente_id": 7, "participante": "Ramon Mejia", "aportado": 12000}],
    ]
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.get("/api/reportes/balance-caja")

    assert resp.status_code == 200
    persona = resp.get_json()["personas"][0]
    assert persona["total_prestado"] == 13000.0
    assert persona["total_aportado"] == 12000.0
    assert persona["saldo"] == -1000.0
    assert persona["prestamos"][0]["capital_abonado"] == 2000.0
    assert persona["prestamos"][1]["nota"] == "Refinanciación"
