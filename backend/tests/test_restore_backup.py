"""/api/configuracion/restore solo debe ejecutar un .sql que lleve la firma
que el propio sistema le pone en /api/configuracion/backup — nunca cualquier
archivo que alguien suba. Sin esta firma, un admin con la sesión comprometida
podía usar el restore como una puerta trasera de ejecución de SQL arbitrario
(incluida ejecución de comandos en el servidor de BD vía COPY ... TO/FROM
PROGRAM)."""

from io import BytesIO
from unittest.mock import MagicMock

import app as app_module


def _autenticar_como(monkeypatch, username, rol):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: (username, None))
    monkeypatch.setattr(app_module, "get_rol", lambda u: rol)


def _subir(client, contenido, nombre="backup.sql"):
    return client.post(
        "/api/configuracion/restore",
        data={"archivo": (BytesIO(contenido.encode("utf-8")), nombre)},
        content_type="multipart/form-data",
    )


def _firmar(cuerpo):
    return app_module._firmador_backup.get_signature(cuerpo.encode("utf-8")).decode("ascii")


def test_restore_rechaza_sql_sin_firma(client, monkeypatch):
    _autenticar_como(monkeypatch, "admin", "administrador")
    conn = MagicMock()
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = _subir(client, "DROP TABLE usuarios; -- sin firma del sistema")

    assert resp.status_code == 400
    assert "firma" in resp.get_json()["error"].lower()
    conn.cursor.return_value.execute.assert_not_called()


def test_restore_rechaza_firma_inventada(client, monkeypatch):
    _autenticar_como(monkeypatch, "admin", "administrador")
    conn = MagicMock()
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    contenido = (
        "BEGIN;\nCREATE TABLE x (id int);\nCOMMIT;\n"
        f"{app_module.MARCADOR_FIRMA_BACKUP} firma-inventada\n"
    )

    resp = _subir(client, contenido)

    assert resp.status_code == 400
    assert "firma" in resp.get_json()["error"].lower()
    conn.cursor.return_value.execute.assert_not_called()


def test_restore_rechaza_backup_legitimo_modificado(client, monkeypatch):
    """Backup real, pero alterado después de firmarse (ej. alguien le agregó
       un DROP a mano) — la firma ya no coincide con el contenido."""
    _autenticar_como(monkeypatch, "admin", "administrador")
    conn = MagicMock()
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    cuerpo = "BEGIN;\nCREATE TABLE x (id int);\nCOMMIT;\n"
    firma = _firmar(cuerpo)
    alterado = cuerpo.replace("CREATE TABLE x", "CREATE TABLE x; DROP TABLE usuarios")
    contenido = alterado + f"{app_module.MARCADOR_FIRMA_BACKUP} {firma}\n"

    resp = _subir(client, contenido)

    assert resp.status_code == 400
    conn.cursor.return_value.execute.assert_not_called()


def test_restore_acepta_backup_legitimo(client, monkeypatch):
    _autenticar_como(monkeypatch, "admin", "administrador")
    conn = MagicMock()
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    cuerpo = "BEGIN;\nCREATE TABLE x (id int);\nCOMMIT;\n"
    firma = _firmar(cuerpo)
    contenido = cuerpo + f"{app_module.MARCADOR_FIRMA_BACKUP} {firma}\n"

    resp = _subir(client, contenido)

    assert resp.status_code == 200
    conn.cursor.return_value.execute.assert_called_once_with(cuerpo)
    conn.commit.assert_called_once()
