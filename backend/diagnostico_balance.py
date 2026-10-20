"""
Diagnóstico de solo lectura del balance caja vs préstamos de una persona.

Uso (contra producción, con las variables del servicio Postgres de Railway):
    railway run -p <ID del proyecto gonza-app> -e production -s Postgres -- venv/Scripts/python.exe diagnostico_balance.py "ramon mejia"

La conexión se abre en modo READ ONLY: no puede modificar nada.
"""
import os
import sys

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv


# Quita acentos en SQL sin depender de la extensión unaccent
SIN_ACENTOS = "translate(({}), 'áéíóúÁÉÍÓÚüÜ', 'aeiouAEIOUuU')"


def conectar():
    load_dotenv()
    # Fuera de Railway solo la URL pública es alcanzable
    url = os.environ.get("DATABASE_PUBLIC_URL") or os.environ["DATABASE_URL"]
    conn = psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.set_session(readonly=True)
    return conn


def main(texto):
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows no imprime ⚠
    patron = "%" + "%".join(texto.split()) + "%"
    conn = conectar()
    cur = conn.cursor()

    cur.execute(f"""
        SELECT id, nombre, apellido_pat, apellido_mat FROM clientes
        WHERE {SIN_ACENTOS.format("nombre || ' ' || apellido_pat || ' ' || COALESCE(apellido_mat, '')")}
              ILIKE {SIN_ACENTOS.format("%s")};
    """, (patron,))
    clientes = cur.fetchall()
    if not clientes:
        print("Sin clientes que coincidan con", texto)

    for cl in clientes:
        nombre = f"{cl['nombre']} {cl['apellido_pat']} {cl['apellido_mat'] or ''}".strip()
        print(f"\n=== Cliente #{cl['id']}: {nombre} ===")

        cur.execute("""
            SELECT id, fecha_prestamo, monto, capital_abonado, (monto - capital_abonado) AS saldo,
                   interes_mensual, pagado, eliminado_en, nota
            FROM prestamos WHERE cliente_id = %s ORDER BY fecha_prestamo, id;
        """, (cl["id"],))
        print("\n-- Préstamos (todos) --")
        for p in cur.fetchall():
            estado = "BORRADO" if p["eliminado_en"] else ("pagado" if p["pagado"] else "ACTIVO")
            print(f"#{p['id']} {p['fecha_prestamo']} monto={p['monto']} abonado={p['capital_abonado']} "
                  f"saldo={p['saldo']} int={p['interes_mensual']} [{estado}] {p['nota'] or ''}")
            cur.execute("""
                SELECT fecha_pago, monto_interes, monto_capital, nota FROM pagos_prestamo
                WHERE prestamo_id = %s ORDER BY fecha_pago, id;
            """, (p["id"],))
            pagos = cur.fetchall()
            suma_cap = sum(x["monto_capital"] or 0 for x in pagos)
            for x in pagos:
                print(f"    abono {x['fecha_pago']} interés={x['monto_interes']} capital={x['monto_capital']} {x['nota'] or ''}")
            if suma_cap != (p["capital_abonado"] or 0):
                print(f"    ⚠ suma de abonos a capital ({suma_cap}) ≠ capital_abonado ({p['capital_abonado']})")

        cur.execute("""
            SELECT id, participante, activo, eliminado_en FROM caja WHERE cliente_id = %s ORDER BY id;
        """, (cl["id"],))
        print("\n-- Caja --")
        for cj in cur.fetchall():
            print(f"Caja #{cj['id']} {cj['participante']} activo={cj['activo']} borrada={bool(cj['eliminado_en'])}")
            cur.execute("""
                SELECT fecha, monto, nota, eliminado_en FROM caja_movimientos
                WHERE caja_id = %s ORDER BY fecha, id;
            """, (cj["id"],))
            total = 0
            for m in cur.fetchall():
                marca = " (BORRADO)" if m["eliminado_en"] else ""
                if not m["eliminado_en"]:
                    total += m["monto"] or 0
                print(f"    {m['fecha']} {m['monto']} {m['nota'] or ''}{marca}")
            print(f"    total vigente = {total}")

    # Préstamos a su nombre sin cliente_id (el balance no los cuenta)
    cur.execute(f"""
        SELECT id, deudor_nombre, monto, capital_abonado, pagado FROM prestamos
        WHERE cliente_id IS NULL AND eliminado_en IS NULL
          AND {SIN_ACENTOS.format("deudor_nombre")} ILIKE {SIN_ACENTOS.format("%s")};
    """, (patron,))
    sueltos = cur.fetchall()
    if sueltos:
        print("\n⚠ Préstamos sin cliente_id (no salen en el balance):")
        for p in sueltos:
            print("   ", dict(p))

    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Uso: python diagnostico_balance.py \"nombre a buscar\"")
    main(" ".join(sys.argv[1:]))
