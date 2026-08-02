"""A diferencia del resto de la suite, aquí SÍ se activa el rate limiting
(el fixture autouse de conftest.py lo desactiva por defecto)."""

from unittest.mock import MagicMock

import app as app_module


def test_login_se_bloquea_tras_exceder_el_limite_por_minuto(client, monkeypatch):
    # Cada intento debe llegar limpio hasta el 401 de "credenciales
    # incorrectas" (no un error de servidor), para aislar que el 429 de la
    # petición 16 viene del rate limiter y no de otra cosa.
    monkeypatch.setattr(app_module, "_cuenta_bloqueada", lambda u: False)
    monkeypatch.setattr(app_module, "_registrar_acceso", lambda u, exito: None)
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = None  # "usuario no existe" -> 401
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    app_module.app.config["RATELIMIT_ENABLED"] = True
    app_module.limiter.reset()
    try:
        codigos = [
            client.post("/api/login", json={"username": "x", "password": "y"}).status_code
            for _ in range(16)
        ]
    finally:
        app_module.limiter.reset()

    # El límite de la ruta es "15 per minute": las primeras 15 llegan al
    # handler y responden 401; la 16 debe ser cortada por el limitador antes
    # de llegar ahí.
    assert codigos[:15] == [401] * 15
    assert codigos[15] == 429
