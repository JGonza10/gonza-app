import subprocess

def obtener_version(stage, archivo):
    resultado = subprocess.run(
        ["git", "show", f":{stage}:{archivo}"],
        capture_output=True
    )
    return resultado.stdout

for archivo in ["app.py", "requirements.txt"]:
    ours = obtener_version(2, archivo).replace(b"\r\n", b"\n")
    theirs = obtener_version(3, archivo).replace(b"\r\n", b"\n")
    if ours == theirs:
        print(f"{archivo}: IDÉNTICOS (solo era diferencia de fin de línea) ✅")
    else:
        print(f"{archivo}: SÍ hay diferencias reales de contenido ⚠️")
