"""Fixtures compartidas. No se conecta a una base de datos real: get_db()
se reemplaza por un doble de prueba configurable por cada test."""

import os
os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
os.environ.setdefault("CRON_SECRET", "secreto_de_prueba")
# SECRET_KEY ahora es obligatoria para que la app arranque (ver app.py); las
# pruebas necesitan un valor propio antes de importar el módulo.
os.environ.setdefault("SECRET_KEY", "clave_de_prueba_no_usar_en_produccion")

import pytest

import app as app_module


class FakeCursor:
    """Cursor falso: .execute() no hace nada, .fetchone()/.fetchall() devuelven
       lo que la prueba haya cargado en la cola con `resultados`."""

    def __init__(self, resultados):
        self._resultados = list(resultados)

    def execute(self, *a, **k):
        pass

    def fetchone(self):
        return self._resultados.pop(0) if self._resultados else None

    def fetchall(self):
        return self._resultados.pop(0) if self._resultados else []


class FakeConn:
    def __init__(self, resultados):
        self._cursor = FakeCursor(resultados)

    def cursor(self):
        return self._cursor

    def commit(self):
        pass

    def close(self):
        pass


@pytest.fixture
def fake_db(monkeypatch):
    """Uso: fake_db(fila1, fila2, ...) — cada llamada a fetchone()/fetchall()
       en la ruta bajo prueba consume el siguiente resultado de la cola, en el
       mismo orden en que la ruta hace sus queries."""
    def _instalar(*resultados):
        conn = FakeConn(list(resultados))
        monkeypatch.setattr(app_module, "get_db", lambda: conn)
        return conn
    return _instalar


@pytest.fixture(autouse=True)
def _sin_rate_limit(monkeypatch):
    """El rate limiting se prueba explícitamente en test_rate_limit.py; en el
       resto de pruebas se desactiva para que no interfiera entre sí (todas
       comparten la misma IP de test client y el mismo almacenamiento)."""
    app_module.app.config["RATELIMIT_ENABLED"] = False
    yield
    app_module.app.config["RATELIMIT_ENABLED"] = False


@pytest.fixture
def client():
    app_module.app.testing = True
    return app_module.app.test_client()
