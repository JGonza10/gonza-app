from unittest.mock import MagicMock, patch

import app as app_module


def test_normalizar_telefono_agrega_codigo_de_pais_mx():
    assert app_module._normalizar_telefono_mx("555-123-4567") == "+525551234567"


def test_normalizar_telefono_respeta_codigo_de_pais_existente():
    assert app_module._normalizar_telefono_mx("+52 555 123 4567") == "+525551234567"


def test_normalizar_telefono_invalido_devuelve_none():
    assert app_module._normalizar_telefono_mx("") is None
    assert app_module._normalizar_telefono_mx("123") is None
    assert app_module._normalizar_telefono_mx(None) is None


def test_enviar_whatsapp_sin_credenciales_no_intenta_red(monkeypatch):
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    ok, motivo = app_module.enviar_whatsapp("5551234567", "hola")
    assert ok is False
    assert "no configurado" in motivo


def test_enviar_whatsapp_con_credenciales_llama_a_twilio(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "sid123")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "token123")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

    respuesta_falsa = MagicMock(status_code=201, text="")
    with patch.object(app_module.http_requests, "post", return_value=respuesta_falsa) as mock_post:
        ok, motivo = app_module.enviar_whatsapp("5551234567", "hola")

    assert ok is True
    assert motivo is None
    args, kwargs = mock_post.call_args
    assert kwargs["data"]["To"] == "whatsapp:+525551234567"
    assert kwargs["auth"] == ("sid123", "token123")
