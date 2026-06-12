// ─────────────────────────────────────────────────────────────────────────────
// GONZA - Frontend React conectado a la API Flask+PostgreSQL
//
// CAMBIO PRINCIPAL respecto a la versión original:
// Antes: los datos vivían en memoria (useReducer + initDB)
// Ahora: los datos vienen de la API (fetch a /api/...)
//
// La variable API_BASE apunta al backend. En producción Railway
// la reemplazas con la URL real del backend desplegado.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

// ── URL BASE DE LA API ────────────────────────────────────────────────────────
// En desarrollo local: "http://localhost:5000"
// En Railway: "https://gonza-backend-production.up.railway.app"
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── PALETA DE COLORES ─────────────────────────────────────────────────────────
const C = {
  navy:"#0B1F4B", gold:"#C9A84C", orange:"#E87722", oxford:"#3B3B4F",
  white:"#FFFFFF", lightGray:"#F4F4F6", border:"#D4D4DC",
  goldLight:"#F5EDD3", navyLight:"#E8EDF5", orangeLight:"#FEF0E3",
  red:"#D93025", green:"#1A7F3C", redLight:"#FDE8E8", greenLight:"#E6F4EC",
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = n => n == null ? "—" :
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const today = new Date().toISOString().split("T")[0];

// Función genérica para llamar a la API
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── COMPONENTES BASE ──────────────────────────────────────────────────────────
function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <rect width="80" height="80" rx="14" fill={C.navy}/>
      <path d="M20 54C20 37 30 24 45 24C56 24 62 31 62 39C62 45 57 50 50 50L42 50L42 46L49 46C53 46 58 44 58 39C58 33 53 28 45 28C33 28 24 39 24 54Z" fill={C.gold}/>
      <rect x="38" y="46" width="6" height="12" fill={C.gold}/>
      <rect x="33" y="57" width="18" height="4" rx="2" fill={C.orange}/>
      <circle cx="58" cy="52" r="5" fill={C.orange}/>
    </svg>
  );
}

function Card({ children, style }) {
  return <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", ...style }}>{children}</div>;
}
function SectionTitle({ children }) {
  return <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: C.navy, borderLeft: `4px solid ${C.gold}`, paddingLeft: 10 }}>{children}</h2>;
}
function Badge({ children, color = C.navy, bg = C.navyLight }) {
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{children}</span>;
}
function Inp({ label, ...p }) {
  return (
    <div style={{ marginBottom: 9 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: C.oxford, marginBottom: 3, fontWeight: 600 }}>{label}</label>}
      <input {...p} style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.navy, background: C.lightGray, boxSizing: "border-box", ...p.style }}/>
    </div>
  );
}
function Sel({ label, children, ...p }) {
  return (
    <div style={{ marginBottom: 9 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: C.oxford, marginBottom: 3, fontWeight: 600 }}>{label}</label>}
      <select {...p} style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.navy, background: C.lightGray, boxSizing: "border-box" }}>{children}</select>
    </div>
  );
}
function Btn({ children, onClick, color = C.navy, small, loading }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ background: loading ? "#aaa" : color, color: C.white, border: "none", borderRadius: 8, padding: small ? "4px 12px" : "8px 18px", fontSize: small ? 11 : 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
      {loading ? "..." : children}
    </button>
  );
}
function Tabla({ headers, rows, empty = "Sin registros" }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: C.navy }}>{headers.map((h, i) => <th key={i} style={{ color: C.gold, padding: "7px 9px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ textAlign: "center", padding: 16, color: C.oxford }}>{empty}</td></tr>
            : rows.map((r, i) => <tr key={i} style={{ background: i % 2 === 0 ? C.white : C.lightGray }}>{r.map((c, j) => <td key={j} style={{ padding: "6px 9px", color: C.oxford, borderBottom: `1px solid ${C.border}` }}>{c}</td>)}</tr>)
          }
        </tbody>
      </table>
    </div>
  );
}

// Hook genérico para cargar datos de la API
function useApiData(endpoint) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api(endpoint);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

// ── MÓDULO: PRÉSTAMOS ─────────────────────────────────────────────────────────
function ModPrestamos() {
  const { data: prestamos, loading, reload } = useApiData("/api/prestamos");
  const [f, setF] = useState({ deudor_nombre: "", fecha_prestamo: today, monto: "", nota: "" });
  const [saving, setSaving] = useState(false);
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  const activos = prestamos.filter(p => !p.pagado && p.monto > 0);
  const pagados = prestamos.filter(p => p.pagado);
  const totalCartera = activos.reduce((a, p) => a + parseFloat(p.monto || 0), 0);
  const totalIntereses = activos.reduce((a, p) => a + parseFloat(p.interes_mensual || 0), 0);

  async function handleAgregar() {
    if (!f.deudor_nombre || !f.monto) return alert("Nombre y monto requeridos");
    setSaving(true);
    try {
      await api("/api/prestamos", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          monto: parseFloat(f.monto),
          interes_mensual: parseFloat(f.monto) * 0.10,
        }),
      });
      setF({ deudor_nombre: "", fecha_prestamo: today, monto: "", nota: "" });
      reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function handlePagar(pid) {
    const fecha = prompt("Fecha de pago (YYYY-MM-DD):", today) || today;
    try {
      await api(`/api/prestamos/${pid}/pagar`, {
        method: "PATCH",
        body: JSON.stringify({ fecha_pago: fecha, tipo_pago: "transferencia" }),
      });
      reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando préstamos...</p>;

  return (
    <div>
      <SectionTitle>Préstamos</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { l: "Cartera activa", v: fmt(totalCartera), c: C.navy, bg: C.navyLight },
          { l: "Intereses esperados", v: fmt(totalIntereses), c: "#8B6914", bg: C.goldLight },
          { l: "Préstamos pagados", v: pagados.length, c: C.green, bg: C.greenLight },
        ].map((s2, i) => <Card key={i} style={{ background: s2.bg }}><p style={{ margin: 0, fontSize: 11, color: C.oxford }}>{s2.l}</p><p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: s2.c }}>{s2.v}</p></Card>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Registrar préstamo</p>
          <Inp label="Nombre del deudor" value={f.deudor_nombre} onChange={s("deudor_nombre")} placeholder="Nombre completo"/>
          <Inp label="Fecha del préstamo" type="date" value={f.fecha_prestamo} onChange={s("fecha_prestamo")}/>
          <Inp label="Monto prestado ($)" type="number" value={f.monto} onChange={s("monto")}/>
          {f.monto && <div style={{ background: C.goldLight, borderRadius: 8, padding: "7px 10px", fontSize: 12, marginBottom: 8 }}>
            Interés (10%): <b>{fmt(parseFloat(f.monto) * 0.10)}</b>
          </div>}
          <Inp label="Notas" value={f.nota} onChange={s("nota")} placeholder="Observaciones"/>
          <Btn color={C.orange} onClick={handleAgregar} loading={saving}>Registrar préstamo</Btn>
        </Card>
        <Card>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Préstamos activos ({activos.length})</p>
          <Tabla
            headers={["#", "Deudor", "Fecha", "Monto", "Interés (10%)", "Nota", "Acción"]}
            rows={activos.map(p => [
              p.id, p.deudor_nombre, p.fecha_prestamo,
              fmt(p.monto), fmt(p.interes_mensual), p.nota || "—",
              <Btn key={p.id} small color={C.green} onClick={() => handlePagar(p.id)}>✓ Pagado</Btn>
            ])}
          />
        </Card>
      </div>
      {pagados.length > 0 && <Card>
        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Pagados ({pagados.length})</p>
        <Tabla
          headers={["#", "Deudor", "Fecha préstamo", "Monto", "Fecha pago", "Nota"]}
          rows={pagados.map(p => [p.id, p.deudor_nombre, p.fecha_prestamo, fmt(p.monto), p.fecha_pago || "—", p.nota || "—"])}
        />
      </Card>}
    </div>
  );
}

// ── MÓDULO: CLIENTES ──────────────────────────────────────────────────────────
function ModClientes() {
  const { data: clientes, loading, reload } = useApiData("/api/clientes");
  const [f, setF] = useState({ nombre: "", apellido_pat: "", apellido_mat: "", telefono: "", direccion: "" });
  const [saving, setSaving] = useState(false);
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  async function handleAgregar() {
    if (!f.nombre) return alert("Nombre requerido");
    setSaving(true);
    try {
      await api("/api/clientes", { method: "POST", body: JSON.stringify(f) });
      setF({ nombre: "", apellido_pat: "", apellido_mat: "", telefono: "", direccion: "" });
      reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando clientes...</p>;

  return (
    <div>
      <SectionTitle>Clientes</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Registrar cliente</p>
          <Inp label="Nombre(s)" value={f.nombre} onChange={s("nombre")} placeholder="Ej. JUAN"/>
          <Inp label="Apellido paterno" value={f.apellido_pat} onChange={s("apellido_pat")} placeholder="GONZALEZ"/>
          <Inp label="Apellido materno" value={f.apellido_mat} onChange={s("apellido_mat")} placeholder="MENDOZA"/>
          <Inp label="Teléfono" value={f.telefono} onChange={s("telefono")} placeholder="555-0000"/>
          <Inp label="Dirección" value={f.direccion} onChange={s("direccion")} placeholder="Calle y número"/>
          <Btn onClick={handleAgregar} loading={saving}>Guardar</Btn>
        </Card>
        <Card>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Directorio ({clientes.length} clientes)</p>
          <Tabla
            headers={["ID", "Apellido paterno", "Apellido materno", "Nombre", "Teléfono", "Estado"]}
            rows={clientes.map(c => [c.id, c.apellido_pat, c.apellido_mat, c.nombre, c.telefono || "—",
              <Badge key={c.id}>{c.activo ? "Activo" : "Inactivo"}</Badge>])}
          />
        </Card>
      </div>
    </div>
  );
}

// ── MÓDULO: AHORRO ────────────────────────────────────────────────────────────
function ModAhorro() {
  const { data: ahorros, loading } = useApiData("/api/ahorros");
  const total = ahorros.reduce((a, x) => a + parseFloat(x.cantidad || 0), 0);

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando ahorros...</p>;
  return (
    <div>
      <SectionTitle>Ahorro</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        <Card style={{ background: C.navyLight }}>
          <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>Total en ahorros del grupo</p>
          <p style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 700, color: C.navy }}>{fmt(total)}</p>
        </Card>
        <Card>
          <Tabla
            headers={["Apellido P.", "Apellido M.", "Nombre", "Cantidad"]}
            rows={ahorros.map(a => [a.apellido_pat, a.apellido_mat, a.nombre, fmt(a.cantidad)])}
          />
        </Card>
      </div>
    </div>
  );
}

// ── MÓDULO: CAJA ──────────────────────────────────────────────────────────────
function ModCaja() {
  const { data: caja, loading } = useApiData("/api/caja");
  const totalCapital = caja.reduce((a, c) => a + parseFloat(c.capital || 0), 0);
  const totalCuota = caja.reduce((a, c) => a + parseFloat(c.cuota || 0), 0);

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando caja...</p>;
  return (
    <div>
      <SectionTitle>Caja de ahorro</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 14 }}>
        <Card style={{ background: C.navyLight }}>
          <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>Capital total acumulado</p>
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, color: C.navy }}>{fmt(totalCapital)}</p>
        </Card>
        <Card style={{ background: C.goldLight }}>
          <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>Aportación quincenal total</p>
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, color: "#8B6914" }}>{fmt(totalCuota)}</p>
        </Card>
      </div>
      <Card>
        <Tabla
          headers={["No.", "Nombre", "Cuota quincenal", "Capital acumulado", "Inicio"]}
          rows={caja.map((c, i) => [i + 1, c.participante, fmt(c.cuota), fmt(c.capital), c.fecha_inicio || "—"])}
        />
      </Card>
    </div>
  );
}

// ── MÓDULO: PAGOS A PLAZOS ────────────────────────────────────────────────────
function ModPagosPlazos() {
  const { data: plazos, loading, reload } = useApiData("/api/plazos");

  async function handleAbonar(pid) {
    try {
      await api(`/api/plazos/${pid}/abonar`, { method: "PATCH", body: JSON.stringify({}) });
      reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando plazos...</p>;
  return (
    <div>
      <SectionTitle>Pagos a plazos</SectionTitle>
      <Card>
        <Tabla
          headers={["Material", "Costo", "Meses", "Pagados", "Pendientes", "Cuota", "Abonado", "Restante", "Avance", "Acción"]}
          rows={plazos.map(p => {
            const pend = p.meses_total - p.meses_pagados;
            const rest = (p.costo || 0) - (p.abonado || 0);
            const pct = p.meses_total ? Math.round((p.meses_pagados / p.meses_total) * 100) : 0;
            return [
              p.material, fmt(p.costo), p.meses_total, p.meses_pagados, pend,
              fmt(p.cuota), fmt(p.abonado), fmt(rest),
              <div key={`bar${p.id}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ background: C.border, borderRadius: 6, height: 8, width: 60 }}>
                  <div style={{ background: pct >= 100 ? C.green : C.orange, width: `${Math.min(pct, 100)}%`, height: 8, borderRadius: 6 }}/>
                </div>
                <span style={{ fontSize: 10 }}>{pct}%</span>
              </div>,
              pend > 0
                ? <Btn key={`btn${p.id}`} small color={C.green} onClick={() => handleAbonar(p.id)}>+ Abono</Btn>
                : <Badge key={`ok${p.id}`} color={C.green} bg={C.greenLight}>✓ Liquidado</Badge>
            ];
          })}
        />
      </Card>
    </div>
  );
}

// ── MÓDULO: RESUMEN ───────────────────────────────────────────────────────────
function ModResumen() {
  const { data: prestamos, loading: lp } = useApiData("/api/prestamos");
  const { data: ahorros, loading: la } = useApiData("/api/ahorros");
  const { data: caja, loading: lc } = useApiData("/api/caja");

  if (lp || la || lc) return <p style={{ padding: 20, color: C.oxford }}>Cargando resumen...</p>;

  const activos = prestamos.filter(p => !p.pagado && p.monto > 0);
  const totalCartera = activos.reduce((a, p) => a + parseFloat(p.monto || 0), 0);
  const totalIntereses = activos.reduce((a, p) => a + parseFloat(p.interes_mensual || 0), 0);
  const totalAhorros = ahorros.reduce((a, x) => a + parseFloat(x.cantidad || 0), 0);
  const totalCaja = caja.reduce((a, c) => a + parseFloat(c.capital || 0), 0);

  const porDeudor = {};
  activos.forEach(p => { porDeudor[p.deudor_nombre] = (porDeudor[p.deudor_nombre] || 0) + parseFloat(p.monto); });
  const topDeudores = Object.entries(porDeudor).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <SectionTitle>Resumen ejecutivo — GONZA</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { l: "Cartera activa prestada", v: fmt(totalCartera), c: C.navy, bg: C.navyLight, i: "💼" },
          { l: "Intereses por cobrar (mensual)", v: fmt(totalIntereses), c: "#8B6914", bg: C.goldLight, i: "📊" },
          { l: "Total ahorros del grupo", v: fmt(totalAhorros), c: C.green, bg: C.greenLight, i: "🏦" },
          { l: "Capital caja de ahorro", v: fmt(totalCaja), c: C.orange, bg: C.orangeLight, i: "💰" },
        ].map((s, i) => (
          <Card key={i} style={{ background: s.bg, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>{s.i}</span>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>{s.l}</p>
              <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</p>
            </div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Indicadores generales</p>
          {[
            ["Préstamos activos", activos.length, C.orange],
            ["Préstamos pagados", prestamos.filter(p => p.pagado).length, C.green],
            ["Participantes caja", caja.length, C.navy],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, padding: "6px 0", fontSize: 12 }}>
              <span style={{ color: C.oxford }}>{l}</span>
              <span style={{ fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
        </Card>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Top 5 deudores (monto activo)</p>
          {topDeudores.map(([nombre, monto], i) => {
            const maxM = topDeudores[0][1] || 1;
            return (
              <div key={nombre} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: C.oxford }}>{i + 1}. {nombre}</span>
                  <span style={{ fontWeight: 700, color: C.navy }}>{fmt(monto)}</span>
                </div>
                <div style={{ background: C.border, borderRadius: 6, height: 7 }}>
                  <div style={{ background: i === 0 ? C.orange : C.navy, width: `${(monto / maxM) * 100}%`, height: 7, borderRadius: 6 }}/>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ── MENÚ Y APP PRINCIPAL ──────────────────────────────────────────────────────
const MENU = [
  { id: "resumen", label: "Resumen", icon: "📊" },
  { id: "clientes", label: "Clientes", icon: "👥" },
  { id: "prestamos", label: "Préstamos", icon: "💼" },
  { id: "ahorro", label: "Ahorro", icon: "🏦" },
  { id: "caja", label: "Caja", icon: "💰" },
  { id: "plazos", label: "Pagos a plazos", icon: "📅" },
];

export default function App() {
  const [sec, setSec] = useState("resumen");

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: C.lightGray, minHeight: "100vh" }}>
      <div style={{ background: C.navy, padding: "0 20px", display: "flex", alignItems: "center", gap: 14, height: 56, boxShadow: "0 2px 6px rgba(0,0,0,.3)" }}>
        <Logo size={36}/>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1.5, color: C.gold }}>GONZA</div>
          <div style={{ fontSize: 9, color: "#8fa8c8", letterSpacing: 1, textTransform: "uppercase" }}>Sistema de administración de pagos</div>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 11, color: "#8fa8c8" }}>
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>
      <div style={{ display: "flex", minHeight: "calc(100vh - 56px)" }}>
        <nav style={{ width: 185, background: C.oxford, padding: "12px 0", flexShrink: 0 }}>
          {MENU.map(m => {
            const active = sec === m.id;
            return (
              <button key={m.id} onClick={() => setSec(m.id)} style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 16px",
                background: active ? C.navy : "transparent", border: "none",
                borderLeft: active ? `3px solid ${C.gold}` : "3px solid transparent",
                color: active ? C.gold : "#b0bcd4", fontSize: 13, fontWeight: active ? 700 : 400,
                cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ fontSize: 15 }}>{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </nav>
        <main style={{ flex: 1, padding: "20px 22px", overflowY: "auto" }}>
          {sec === "resumen" && <ModResumen/>}
          {sec === "clientes" && <ModClientes/>}
          {sec === "prestamos" && <ModPrestamos/>}
          {sec === "ahorro" && <ModAhorro/>}
          {sec === "caja" && <ModCaja/>}
          {sec === "plazos" && <ModPagosPlazos/>}
        </main>
      </div>
    </div>
  );
}
