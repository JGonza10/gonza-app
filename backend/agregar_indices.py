"""
agregar_indices.py
Agrega índices en las columnas que el sistema consulta con más frecuencia
(llaves foráneas usadas en WHERE/JOIN). Seguro de correr las veces que
quieras: usa IF NOT EXISTS, así que nunca duplica ni rompe nada.

Uso:
  $env:DATABASE_URL="postgresql://usuario:password@host:puerto/db"
  python agregar_indices.py
"""

import os
import sys
import psycopg2

INDICES = [
    ("idx_prestamos_cliente_id", 'CREATE INDEX IF NOT EXISTS idx_prestamos_cliente_id ON prestamos (cliente_id);'),
    ("idx_ahorros_cliente_id", 'CREATE INDEX IF NOT EXISTS idx_ahorros_cliente_id ON ahorros (cliente_id);'),
    ("idx_caja_cliente_id", 'CREATE INDEX IF NOT EXISTS idx_caja_cliente_id ON caja (cliente_id);'),
    ("idx_pagos_prestamo_prestamo_id", 'CREATE INDEX IF NOT EXISTS idx_pagos_prestamo_prestamo_id ON pagos_prestamo (prestamo_id);'),
    ("idx_cortes_interes_prestamo_id", 'CREATE INDEX IF NOT EXISTS idx_cortes_interes_prestamo_id ON cortes_interes (prestamo_id);'),
    ("idx_pagos_plazos_prestamo_id", 'CREATE INDEX IF NOT EXISTS idx_pagos_plazos_prestamo_id ON pagos_plazos (prestamo_id);'),
    ("idx_caja_movimientos_caja_id", 'CREATE INDEX IF NOT EXISTS idx_caja_movimientos_caja_id ON caja_movimientos (caja_id);'),
    ("idx_usuarios_username", 'CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios (username);'),
    ("idx_prestamos_deudor_nombre_lower", 'CREATE INDEX IF NOT EXISTS idx_prestamos_deudor_nombre_lower ON prestamos (LOWER(deudor_nombre));'),
]


def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("❌ Falta la variable de entorno DATABASE_URL.")
        print('   Configúrala así en PowerShell: $env:DATABASE_URL="postgresql://..."')
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    cur = conn.cursor()

    print("Revisando índices existentes...\n")
    for nombre, sql in INDICES:
        cur.execute("SELECT 1 FROM pg_indexes WHERE indexname = %s;", (nombre,))
        ya_existe = cur.fetchone() is not None
        cur.execute(sql)
        estado = "ya existía" if ya_existe else "✅ creado"
        print(f"  {nombre}: {estado}")

    conn.close()
    print("\nListo. La base de datos ahora tiene índices en las columnas más consultadas.")


if __name__ == "__main__":
    main()
