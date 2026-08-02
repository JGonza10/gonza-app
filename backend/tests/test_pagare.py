from unittest.mock import MagicMock

import app as app_module


def _autenticar_como(monkeypatch, username, rol):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: (username, None))
    monkeypatch.setattr(app_module, "get_rol", lambda u: rol)


def test_fmt_fecha_es_convierte_iso_a_texto():
    assert app_module.fmt_fecha_es("2026-03-05") == "5 de marzo de 2026"


def test_fmt_fecha_es_none_devuelve_guion():
    assert app_module.fmt_fecha_es(None) == "—"


def test_generar_pdf_pagare_produce_un_pdf_valido():
    prestamo = {
        "deudor_nombre": "JUAN PEREZ LOPEZ", "monto": 5000.0, "interes_mensual": 500.0,
        "fecha_prestamo": "2026-01-15", "telefono": "555-123-4567", "direccion": "Calle Falsa 123",
    }
    pdf_bytes = app_module._generar_pdf_pagare(prestamo)
    assert pdf_bytes[:4] == b"%PDF"


def test_descargar_pagare_prestamo_no_encontrado(client, fake_db, monkeypatch):
    _autenticar_como(monkeypatch, "carla", "consultor")
    fake_db(None)

    resp = client.get("/api/prestamos/999/pagare")

    assert resp.status_code == 404


def test_descargar_pagare_devuelve_pdf(client, fake_db, monkeypatch):
    _autenticar_como(monkeypatch, "carla", "consultor")
    fake_db({
        "deudor_nombre": "JUAN PEREZ LOPEZ", "monto": 5000.0, "interes_mensual": 500.0,
        "fecha_prestamo": "2026-01-15", "telefono": "555-123-4567", "direccion": "Calle Falsa 123",
    })

    resp = client.get("/api/prestamos/1/pagare")

    assert resp.status_code == 200
    assert resp.mimetype == "application/pdf"
    assert resp.data[:4] == b"%PDF"
