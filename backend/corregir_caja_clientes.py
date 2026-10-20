"""
Revisa que cada integrante de la caja esté ligado a SU cliente (cliente_id único).

Compara el nombre del participante de cada caja contra el catálogo de
clientes. Si el cliente_id no corresponde y hay exactamente un cliente con ese
nombre, propone corregirlo. Sin --aplicar solo muestra lo que haría.

Uso (producción):
    railway run -p <ID del proyecto gonza-app> -e production -s Postgres -- venv\\Scripts\\python.exe corregir_caja_clientes.py [--aplicar]
"""
import os
import sys
import unicodedata
from collections import defaultdict

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv


def normalizar(texto):
    sin_acentos = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return " ".join(sin_acentos.upper().split())


def main(aplicar):
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows no imprime ⚠ ni →
    load_dotenv()
    url = os.environ.get("DATABASE_PUBLIC_URL") or os.environ["DATABASE_URL"]
    conn = psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)
    if not aplicar:
        conn.set_session(readonly=True)
    cur = conn.cursor()

    cur.execute("SELECT id, nombre, apellido_pat, apellido_mat FROM clientes;")
    por_nombre = defaultdict(list)
    nombre_de = {}
    for c in cur.fetchall():
        completo = normalizar(f"{c['nombre']} {c['apellido_pat']} {c['apellido_mat'] or ''}")
        por_nombre[completo].append(c["id"])
        nombre_de[c["id"]] = completo

    cur.execute("""
        SELECT id, participante, cliente_id FROM caja
        WHERE eliminado_en IS NULL ORDER BY id;
    """)
    cajas = cur.fetchall()

    cambios = []
    for cj in cajas:
        candidatos = por_nombre.get(normalizar(cj["participante"]), [])
        if cj["cliente_id"] in candidatos:
            continue
        if len(candidatos) == 1:
            cambios.append((cj, candidatos[0]))
        else:
            actual = nombre_de.get(cj["cliente_id"], "—")
            print(f"⚠ Caja #{cj['id']} '{cj['participante']}' ligada a #{cj['cliente_id']} ({actual}); "
                  f"clientes con ese nombre: {candidatos or 'ninguno'} → revisar a mano")

    for cj, nuevo in cambios:
        print(f"Caja #{cj['id']} '{cj['participante']}': cliente #{cj['cliente_id']} "
              f"({nombre_de.get(cj['cliente_id'], '—')}) → #{nuevo}")
        if aplicar:
            cur.execute("UPDATE caja SET cliente_id = %s WHERE id = %s;", (nuevo, cj["id"]))
            cur.execute(
                "INSERT INTO auditoria (tabla, registro_id, accion, usuario, detalle) VALUES (%s, %s, %s, %s, %s);",
                ("caja", cj["id"], "editar", "script:corregir_caja_clientes",
                 psycopg2.extras.Json({"cliente_id_anterior": cj["cliente_id"], "cliente_id": nuevo})),
            )

    # Después de los cambios, ningún cliente debe tener dos cajas activas
    finales = {cj["id"]: cj["cliente_id"] for cj in cajas}
    finales.update({cj["id"]: nuevo for cj, nuevo in cambios})
    conteo = defaultdict(list)
    for caja_id, cid in finales.items():
        conteo[cid].append(caja_id)
    repetidos = {cid: ids for cid, ids in conteo.items() if cid is not None and len(ids) > 1}
    for cid, ids in repetidos.items():
        print(f"⚠ Cliente #{cid} ({nombre_de.get(cid, '—')}) seguiría con varias cajas: {ids}")

    print(f"\n{len(cajas)} cajas revisadas, {len(cambios)} por corregir, {len(repetidos)} clientes repetidos.")
    if aplicar:
        conn.commit()
        print("Cambios guardados.")
    else:
        print("Modo revisión: no se cambió nada (usa --aplicar).")
    conn.close()


if __name__ == "__main__":
    main("--aplicar" in sys.argv)
