"""Verifica que los DELETE se conviertan en UPDATE ... SET eliminado_en (borrado
suave) y que cada mutación quede registrada en la tabla auditoria. No usa una
base de datos real: se captura el SQL ejecutado con un cursor de prueba."""

from unittest.mock import MagicMock

import app as app_module


def _autenticar_como(monkeypatch, username, rol):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: (username, None))
    monkeypatch.setattr(app_module, "get_rol", lambda u: rol)


def _sql_ejecutados(cur):
    return [str(c.args[0]) for c in cur.execute.call_args_list]


def test_registrar_auditoria_inserta_con_usuario_actual(monkeypatch):
    monkeypatch.setattr(app_module, "_obtener_username_autenticado", lambda: ("ana", None))
    cur = MagicMock()

    with app_module.app.test_request_context():
        app_module._registrar_auditoria(cur, "prestamos", 7, "eliminar")

    cur.execute.assert_called_once()
    sql, params = cur.execute.call_args.args
    assert "INSERT INTO auditoria" in sql
    assert params[0:4] == ("prestamos", 7, "eliminar", "ana")


def test_delete_prestamo_no_hace_delete_fisico(client, monkeypatch):
    _autenticar_como(monkeypatch, "ana", "administrador")
    conn = MagicMock()
    monkeypatch.setattr(app_module, "get_db", lambda: conn)
    cur = conn.cursor.return_value

    resp = client.delete("/api/prestamos/5")

    assert resp.status_code == 200
    sqls = _sql_ejecutados(cur)
    assert any("UPDATE prestamos SET eliminado_en = NOW()" in s for s in sqls)
    assert not any(s.strip().upper().startswith("DELETE") for s in sqls)
    assert any("INSERT INTO auditoria" in s for s in sqls)


def test_delete_cliente_no_hace_delete_fisico(client, monkeypatch):
    _autenticar_como(monkeypatch, "ana", "administrador")
    conn = MagicMock()
    monkeypatch.setattr(app_module, "get_db", lambda: conn)
    cur = conn.cursor.return_value

    resp = client.delete("/api/clientes/9")

    assert resp.status_code == 200
    sqls = _sql_ejecutados(cur)
    assert any("UPDATE clientes SET eliminado_en = NOW()" in s for s in sqls)
    assert not any(s.strip().upper().startswith("DELETE") for s in sqls)


def test_get_prestamos_filtra_eliminados(client, monkeypatch):
    _autenticar_como(monkeypatch, "ana", "administrador")
    conn = MagicMock()
    conn.cursor.return_value.fetchall.return_value = []
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.get("/api/prestamos")

    assert resp.status_code == 200
    sql = conn.cursor.return_value.execute.call_args.args[0]
    assert "eliminado_en IS NULL" in sql


def test_add_prestamo_registra_auditoria_de_creacion(client, monkeypatch):
    _autenticar_como(monkeypatch, "ana", "administrador")
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.side_effect = [
        {"nombre": "Juan", "apellido_pat": "Perez", "apellido_mat": "Lopez"},  # SELECT cliente
        {"id": 42},  # RETURNING id del INSERT
    ]
    monkeypatch.setattr(app_module, "get_db", lambda: conn)

    resp = client.post("/api/prestamos", json={
        "cliente_id": 1, "fecha_prestamo": "2026-01-01", "monto": 1000, "interes_mensual": 100,
    })

    assert resp.status_code == 201
    sqls = _sql_ejecutados(cur)
    assert any("INSERT INTO auditoria" in s for s in sqls)
    ultimo_insert_auditoria = cur.execute.call_args_list[-1]
    assert ultimo_insert_auditoria.args[1][0:3] == ("prestamos", 42, "crear")
