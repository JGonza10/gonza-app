from werkzeug.security import generate_password_hash

import app as app_module


def _usuario(**over):
    base = {
        "id": 1, "username": "ana", "nombre": "Ana",
        "password_hash": generate_password_hash("clave-correcta"),
        "activo": True, "cliente_id": None, "rol": "administrador",
        "totp_secret": None, "totp_habilitado": False,
    }
    base.update(over)
    return base


def test_login_exitoso(client, fake_db, monkeypatch):
    monkeypatch.setattr(app_module, "_cuenta_bloqueada", lambda u: False)
    monkeypatch.setattr(app_module, "_registrar_acceso", lambda u, exito: None)
    fake_db(_usuario())

    resp = client.post("/api/login", json={"username": "ana", "password": "clave-correcta"})

    assert resp.status_code == 200
    body = resp.get_json()
    assert body["username"] == "ana"
    assert body["rol"] == "administrador"
    assert body["token"]


def test_login_password_incorrecta(client, fake_db, monkeypatch):
    monkeypatch.setattr(app_module, "_cuenta_bloqueada", lambda u: False)
    monkeypatch.setattr(app_module, "_registrar_acceso", lambda u, exito: None)
    fake_db(_usuario())

    resp = client.post("/api/login", json={"username": "ana", "password": "otra-cosa"})

    assert resp.status_code == 401
    assert "token" not in resp.get_json()


def test_login_usuario_inexistente(client, fake_db, monkeypatch):
    monkeypatch.setattr(app_module, "_cuenta_bloqueada", lambda u: False)
    monkeypatch.setattr(app_module, "_registrar_acceso", lambda u, exito: None)
    fake_db(None)

    resp = client.post("/api/login", json={"username": "fantasma", "password": "x"})

    assert resp.status_code == 401


def test_login_usuario_inactivo(client, fake_db, monkeypatch):
    monkeypatch.setattr(app_module, "_cuenta_bloqueada", lambda u: False)
    monkeypatch.setattr(app_module, "_registrar_acceso", lambda u, exito: None)
    fake_db(_usuario(activo=False))

    resp = client.post("/api/login", json={"username": "ana", "password": "clave-correcta"})

    assert resp.status_code == 403


def test_login_bloqueado_por_intentos_fallidos(client, monkeypatch):
    monkeypatch.setattr(app_module, "_cuenta_bloqueada", lambda u: True)

    resp = client.post("/api/login", json={"username": "ana", "password": "clave-correcta"})

    assert resp.status_code == 429
