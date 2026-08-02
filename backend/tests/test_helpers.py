from datetime import date, datetime, time
from decimal import Decimal

import pytest

import app as app_module


@pytest.mark.parametrize("col,esperado", [
    ({"data_type": "character varying", "character_maximum_length": 100}, "VARCHAR(100)"),
    ({"data_type": "character varying", "character_maximum_length": None}, "VARCHAR"),
    ({"data_type": "numeric", "numeric_precision": 10, "numeric_scale": 2}, "NUMERIC(10,2)"),
    ({"data_type": "numeric", "numeric_precision": None, "numeric_scale": None}, "NUMERIC"),
    ({"data_type": "integer"}, "INTEGER"),
    ({"data_type": "boolean"}, "BOOLEAN"),
])
def test_tipo_columna_sql_tipos_conocidos(col, esperado):
    assert app_module._tipo_columna_sql(col) == esperado


def test_tipo_columna_sql_tipo_desconocido_usa_udt_name():
    col = {"data_type": "tipo_raro", "udt_name": "mi_enum"}
    assert app_module._tipo_columna_sql(col) == "MI_ENUM"


def test_json_default_convierte_date_datetime_time():
    assert app_module._json_default(date(2026, 8, 2)) == "2026-08-02"
    assert app_module._json_default(datetime(2026, 8, 2, 10, 30)) == "2026-08-02T10:30:00"
    assert app_module._json_default(time(10, 30)) == "10:30:00"


def test_json_default_convierte_decimal_a_float():
    resultado = app_module._json_default(Decimal("123.45"))
    assert resultado == 123.45
    assert isinstance(resultado, float)
