from unittest.mock import MagicMock

import pyotp
from werkzeug.security import generate_password_hash

import app as app_module


def _autenticar_como_admin(monkeypatch):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: ("ana", None))
    monkeypatch.setattr(app_module, "get_rol", lambda u: "administrador")


def test_login_con_2fa_habilitado_sin_codigo_pide_2fa(client, fake_db, monkeypatch):
    monkeypatch.setattr(app_module, "_cuenta_bloqueada", lambda u: False)
    monkeypatch.setattr(app_module, "_registrar_acceso", lambda u, exito: None)
    secreto = pyotp.random_base32()
    fake_db({
        "id": 1, "username": "ana", "nombre": "Ana",
        "password_hash": generate_password_hash("clave-correcta"),
        "activo": True, "cliente_id": None, "rol": "administrador",
        "totp_secret": secreto, "totp_habilitado": True,
    })

    resp = client.post("/api/login", json={"username": "ana", "password": "clave-correcta"})

    assert resp.status_code == 401
    assert resp.get_json()["requiere_2fa"] is True


def test_login_con_2fa_codigo_correcto_permite_entrar(client, fake_db, monkeypatch):
    monkeypatch.setattr(app_module, "_cuenta_bloqueada", lambda u: False)
    monkeypatch.setattr(app_module, "_registrar_acceso", lambda u, exito: None)
    secreto = pyotp.random_base32()
    fake_db({
        "id": 1, "username": "ana", "nombre": "Ana",
        "password_hash": generate_password_hash("clave-correcta"),
        "activo": True, "cliente_id": None, "rol": "administrador",
        "totp_secret": secreto, "totp_habilitado": True,
    })
    codigo_valido = pyotp.TOTP(secreto).now()

    resp = client.post("/api/login", json={
        "username": "ana", "password": "clave-correcta", "totp_code": codigo_valido,
    })

    assert resp.status_code == 200
    assert resp.get_json()["token"]


def test_login_con_2fa_codigo_incorrecto_rechaza(client, fake_db, monkeypatch):
    monkeypatch.setattr(app_module, "_cuenta_bloqueada", lambda u: False)
    monkeypatch.setattr(app_module, "_registrar_acceso", lambda u, exito: None)
    fake_db({
        "id": 1, "username": "ana", "nombre": "Ana",
        "password_hash": generate_password_hash("clave-correcta"),
        "activo": True, "cliente_id": None, "rol": "administrador",
        "totp_secret": pyotp.random_base32(), "totp_habilitado": True,
    })

    resp = client.post("/api/login", json={
        "username": "ana", "password": "clave-correcta", "totp_code": "000000",
    })

    assert resp.status_code == 401


def test_generar_2fa_devuelve_secreto_y_qr(client, monkeypatch):
    _autenticar_como_admin(monkeypatch)
    conn = MagicMock()
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.post("/api/2fa/generar")

    assert resp.status_code == 200
    body = resp.get_json()
    assert len(body["secreto"]) >= 16
    assert body["qr"].startswith("data:image/png;base64,")


def test_activar_2fa_con_codigo_valido(client, monkeypatch):
    _autenticar_como_admin(monkeypatch)
    secreto = pyotp.random_base32()
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = {"totp_secret": secreto}
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.post("/api/2fa/activar", json={"codigo": pyotp.TOTP(secreto).now()})

    assert resp.status_code == 200


def test_activar_2fa_con_codigo_invalido(client, monkeypatch):
    _autenticar_como_admin(monkeypatch)
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = {"totp_secret": pyotp.random_base32()}
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.post("/api/2fa/activar", json={"codigo": "000000"})

    assert resp.status_code == 400


def test_desactivar_2fa_requiere_password_correcta(client, monkeypatch):
    _autenticar_como_admin(monkeypatch)
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = {"password_hash": generate_password_hash("clave-correcta")}
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    malo = client.post("/api/2fa/desactivar", json={"password": "otra-cosa"})
    bueno = client.post("/api/2fa/desactivar", json={"password": "clave-correcta"})

    assert malo.status_code == 401
    assert bueno.status_code == 200
