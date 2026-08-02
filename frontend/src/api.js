// api.js — Llamadas al backend Flask y hooks reutilizables por todos los módulos.
import { useState, useEffect, useCallback, useContext, createContext } from "react";
import { API_BASE, C } from "./theme";

// ── CONFIRMACIÓN GLOBAL (reemplaza window.confirm) ──────────────────────────
// Uso: const confirm = useConfirm(); ... if (!(await confirm("¿Seguro?"))) return;
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [pedido, setPedido] = useState(null); // { mensaje, resolve }

  const confirm = useCallback((mensaje) => {
    return new Promise((resolve) => setPedido({ mensaje, resolve }));
  }, []);

  function responder(valor) {
    pedido?.resolve(valor);
    setPedido(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pedido && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,75,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: "22px 24px", width: 340, maxWidth: "90vw", boxShadow: "0 12px 40px rgba(0,0,0,.35)" }}>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: C.oxford, whiteSpace: "pre-line", lineHeight: 1.5 }}>{pedido.mensaje}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => responder(false)} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.cardBg, color: C.oxford, cursor: "pointer", fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={() => responder(true)} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: C.red, color: C.white, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

// ── LLAMADAS AL BACKEND ───────────────────────────────────────────────────────
export async function api(path, options = {}) {
  const user = sessionStorage.getItem("gonza_user");
  const token = user ? JSON.parse(user).token : "";
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    ...options,
  });
  if (res.status === 401) {
    // Token inválido o expirado: cerrar sesión y regresar al login
    sessionStorage.removeItem("gonza_user");
    const body = await res.json().catch(() => ({}));
    window.location.reload();
    throw new Error(body.error || "Sesión expirada, inicia sesión de nuevo");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export function useApiData(endpoint) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api(endpoint)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

// ── PAGINACIÓN (en cliente, sin tocar el backend) ────────────────────────────
// Uso: const { itemsPagina, Paginador } = usePaginacion(lista, 15);
export function usePaginacion(items, porPagina = 15) {
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);

  // Si la lista cambia de tamaño (búsqueda, alta, baja) y la página actual queda fuera de rango, regresa a la 1
  useEffect(() => { if (pagina > totalPaginas) setPagina(1); }, [totalPaginas]); // eslint-disable-line

  const inicio = (paginaSegura - 1) * porPagina;
  const itemsPagina = items.slice(inicio, inicio + porPagina);

  function Paginador() {
    if (totalPaginas <= 1) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaSegura === 1}
          style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: paginaSegura === 1 ? C.lightGray : C.cardBg, color: C.navy, cursor: paginaSegura === 1 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
          ← Anterior
        </button>
        <span style={{ fontSize: 12, color: C.oxford }}>Página <b>{paginaSegura}</b> de <b>{totalPaginas}</b> · {items.length} registros</span>
        <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas}
          style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: paginaSegura === totalPaginas ? C.lightGray : C.cardBg, color: C.navy, cursor: paginaSegura === totalPaginas ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
          Siguiente →
        </button>
      </div>
    );
  }

  return { pagina: paginaSegura, totalPaginas, itemsPagina, Paginador };
}
