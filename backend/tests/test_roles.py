"""Prueba los decoradores de permisos (requiere_rol, requiere_lectura,
requiere_cron) a través de rutas reales, sin tocar la base de datos:
_obtener_username_autenticado y get_rol se sustituyen directamente."""

import app as app_module


def _autenticar_como(monkeypatch, username, rol):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: (username, None))
    monkeypatch.setattr(app_module, "get_rol", lambda u: rol)


def test_requiere_rol_sin_sesion_devuelve_401(client):
    resp = client.get("/api/usuarios")
    assert resp.status_code == 401


def test_requiere_rol_con_rol_incorrecto_devuelve_403(client, monkeypatch):
    _autenticar_como(monkeypatch, "bob", "consultor")
    resp = client.get("/api/usuarios")
    assert resp.status_code == 403


def test_requiere_rol_con_rol_correcto_permite_pasar(client, monkeypatch, fake_db):
    _autenticar_como(monkeypatch, "ana", "administrador")
    fake_db([])
    resp = client.get("/api/usuarios")
    assert resp.status_code == 200


def test_requiere_lectura_acepta_rol_extra(client, monkeypatch, fake_db):
    # /api/clientes permite roles_extra=("consultor",) además de admin/analista
    _autenticar_como(monkeypatch, "carla", "consultor")
    fake_db([])
    resp = client.get("/api/clientes")
    assert resp.status_code == 200


def test_requiere_lectura_rechaza_rol_no_listado(client, monkeypatch):
    _autenticar_como(monkeypatch, "usuario1", "usuario")
    resp = client.get("/api/clientes")
    assert resp.status_code == 403


def test_requiere_cron_sin_secreto_devuelve_401(client):
    resp = client.post("/api/alertas/enviar-correos")
    assert resp.status_code == 401


def test_requiere_cron_con_secreto_correcto_deja_pasar():
    # Se prueba el decorador de forma aislada (sin pasar por una ruta real que
    # toque la base de datos): envuelve una función dummy y verifica que se
    # ejecuta cuando el header X-Cron-Secret coincide con CRON_SECRET
    # ("secreto_de_prueba", definido en conftest.py).
    llamadas = []

    @app_module.requiere_cron
    def vista_dummy():
        llamadas.append(True)
        return "ok"

    with app_module.app.test_request_context(headers={"X-Cron-Secret": "secreto_de_prueba"}):
        resultado = vista_dummy()

    assert resultado == "ok"
    assert llamadas == [True]
