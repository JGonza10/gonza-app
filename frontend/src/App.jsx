import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

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

// Convierte YYYY-MM-DD → DD/MM/AAAA para mostrar en pantalla
const fmtFecha = f => {
  if (!f) return "—";
  const s = f.toString().substring(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return f;
  return `${d}/${m}/${y}`;
};

async function api(path, options = {}) {
  const user = sessionStorage.getItem("gonza_user");
  const username = user ? JSON.parse(user).username : "";
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", "X-Username": username },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ── COMPONENTES BASE ──────────────────────────────────────────────────────────
// Logo JGM Gonzas Systems — recreado en SVG con los colores del logo oficial
function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Fondo con gradiente oscuro redondeado */}
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a2e5a"/>
          <stop offset="100%" stopColor="#0B1F4B"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8c96a"/>
          <stop offset="100%" stopColor="#C9A84C"/>
        </linearGradient>
        <linearGradient id="circleGrad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3a6fa8"/>
          <stop offset="100%" stopColor="#1a4a80"/>
        </linearGradient>
      </defs>

      {/* Fondo */}
      <rect width="80" height="80" rx="16" fill="url(#bgGrad)"/>

      {/* Círculo externo dorado */}
      <circle cx="40" cy="38" r="26" stroke="url(#goldGrad)" strokeWidth="2.5" fill="none"/>

      {/* Círculo interno azul */}
      <circle cx="40" cy="38" r="19" stroke="#3a6fa8" strokeWidth="1.5" fill="none"/>

      {/* Nodos decorativos de circuito (esquinas del círculo) */}
      <circle cx="40" cy="12" r="2" fill={C.gold}/>
      <circle cx="64" cy="38" r="2" fill={C.gold}/>
      <circle cx="16" cy="38" r="2" fill={C.gold}/>
      <circle cx="40" cy="64" r="2" fill={C.orange}/>

      {/* Letra J */}
      <path d="M26 26 L26 44 Q26 50 32 50 Q36 50 37 47" stroke={C.gold} strokeWidth="3" strokeLinecap="round" fill="none"/>

      {/* Letra G */}
      <path d="M53 28 Q43 23 38 32 Q34 40 40 46 Q47 52 54 46 L54 39 L47 39" stroke={C.gold} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>

      {/* Letra M (en naranja para distinguir) */}
      <path d="M33 50 L33 43 L38 49 L43 43 L43 50" stroke={C.orange} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>

      {/* Punto naranja pequeño decorativo */}
      <circle cx="57" cy="50" r="3" fill={C.orange}/>
      <circle cx="23" cy="50" r="2" fill={C.orange} opacity="0.7"/>

      {/* Texto GONZA debajo */}
      <text x="40" y="75" textAnchor="middle" fontSize="8" fontWeight="800" letterSpacing="1.5" fill={C.gold} fontFamily="'Segoe UI',sans-serif">GONZA</text>
    </svg>
  );
}

// Logo grande para la pantalla de login — muestra JGM + texto completo
function LogoLogin() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <svg width="100" height="100" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad2" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1a2e5a"/>
            <stop offset="100%" stopColor="#0B1F4B"/>
          </linearGradient>
          <linearGradient id="goldGrad2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8c96a"/>
            <stop offset="100%" stopColor="#C9A84C"/>
          </linearGradient>
        </defs>
        <rect width="80" height="80" rx="16" fill="url(#bgGrad2)"/>
        <circle cx="40" cy="40" r="27" stroke="url(#goldGrad2)" strokeWidth="2.5" fill="none"/>
        <circle cx="40" cy="40" r="20" stroke="#3a6fa8" strokeWidth="1.5" fill="none"/>
        <circle cx="40" cy="13" r="2.2" fill={C.gold}/>
        <circle cx="66" cy="40" r="2.2" fill={C.gold}/>
        <circle cx="14" cy="40" r="2.2" fill={C.gold}/>
        <circle cx="40" cy="67" r="2.2" fill={C.orange}/>
        {/* J */}
        <path d="M26 26 L26 46 Q26 52 32 52 Q37 52 38 48" stroke={C.gold} strokeWidth="3.2" strokeLinecap="round" fill="none"/>
        {/* G */}
        <path d="M55 28 Q44 22 38 32 Q33 41 40 48 Q48 54 56 47 L56 40 L48 40" stroke={C.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* M */}
        <path d="M32 52 L32 44 L38 51 L44 44 L44 52" stroke={C.orange} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="59" cy="52" r="3.5" fill={C.orange}/>
        <circle cx="22" cy="52" r="2.5" fill={C.orange} opacity="0.7"/>
      </svg>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 3, color: C.navy, marginTop: 6, fontFamily: "'Segoe UI',sans-serif" }}>JGM</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, color: "#555", marginTop: -4, fontFamily: "'Segoe UI',sans-serif" }}>Gonzas</div>
      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1, color: C.orange, marginTop: -2, fontFamily: "'Segoe UI',sans-serif" }}>systems</div>
    </div>
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

function useApiData(endpoint) {
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

// ── MÓDULO: PRÉSTAMOS ─────────────────────────────────────────────────────────
function ModalAbono({ prestamo, onClose, onSaved }) {
  const [montoInteres, setMontoInteres] = useState("");
  const [montoCapital, setMontoCapital] = useState("");
  const [fechaPago, setFechaPago] = useState(today);
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: historial, loading: loadingHist } = useApiData(`/api/prestamos/${prestamo.id}/historial`);
  const saldoRestante = parseFloat(prestamo.monto || 0) - parseFloat(prestamo.capital_abonado || 0);

  async function handleGuardar() {
    const mi = parseFloat(montoInteres || 0);
    const mc = parseFloat(montoCapital || 0);
    if (mi <= 0 && mc <= 0) return alert("Ingresa al menos un monto mayor a 0");
    setSaving(true);
    try {
      await api(`/api/prestamos/${prestamo.id}/abono`, {
        method: "POST",
        body: JSON.stringify({ monto_interes: mi, monto_capital: mc, fecha_pago: fechaPago, nota }),
      });
      onSaved();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <Card style={{ width: 440, maxHeight: "85vh", overflowY: "auto" }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: C.navy }}>Abono — {prestamo.deudor_nombre}</p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: C.oxford }}>
          Préstamo: <b>{fmt(prestamo.monto)}</b> · Abonado: <b>{fmt(prestamo.capital_abonado || 0)}</b> · Saldo: <b style={{ color: C.orange }}>{fmt(saldoRestante)}</b>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="Fecha del abono" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}/>
          <Inp label="Abono al interés ($)" type="number" value={montoInteres} onChange={e => setMontoInteres(e.target.value)}/>
          <Inp label="Abono al capital ($)" type="number" value={montoCapital} onChange={e => setMontoCapital(e.target.value)}/>
          <Inp label="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} placeholder="Observaciones"/>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Btn color={C.orange} onClick={handleGuardar} loading={saving}>Registrar abono</Btn>
          <Btn color={C.oxford} onClick={onClose}>Cerrar</Btn>
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Historial de abonos</p>
        {loadingHist ? <p style={{ fontSize: 12, color: C.oxford }}>Cargando...</p>
          : <Tabla headers={["Fecha", "Interés", "Capital", "Nota"]}
              rows={historial.map(h => [fmtFecha(h.fecha_pago), fmt(h.monto_interes), fmt(h.monto_capital), h.nota || "—"])}
              empty="Sin abonos registrados"/>}
      </Card>
    </div>
  );
}

// ── MODAL: CORTES DE INTERÉS MENSUAL ─────────────────────────────────────────
function ModalCortesInteres({ prestamo, onClose }) {
  const { data: cortes, loading, reload } = useApiData(`/api/prestamos/${prestamo.id}/cortes`);
  const [fechaPago, setFechaPago] = useState(today);
  const [montoPagado, setMontoPagado] = useState("");
  const [tipoPago, setTipoPago] = useState("transferencia");
  const [nota, setNota] = useState("");
  const [corteSeleccionado, setCorteSeleccionado] = useState(null);
  const [saving, setSaving] = useState(false);

  const pendientes = cortes.filter(c => !c.pagado);
  const pagados    = cortes.filter(c =>  c.pagado);
  const totalPendiente = pendientes.reduce((a, c) => a + parseFloat(c.monto_interes || 0), 0);
  const totalCobrado   = cortes.reduce((a, c) => a + parseFloat(c.monto_pagado || 0), 0);

  // Mes en formato legible: "2026-01-01" → "Enero 2026"
  const fmtPeriodo = p => {
    if (!p) return "—";
    const [y, m] = p.toString().substring(0, 10).split("-");
    const meses = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${meses[parseInt(m)]} ${y}`;
  };

  async function handlePagar() {
    if (!corteSeleccionado) return alert("Selecciona un mes para pagar");
    const mp = parseFloat(montoPagado || corteSeleccionado.monto_interes);
    if (mp <= 0) return alert("Ingresa un monto válido");
    setSaving(true);
    try {
      await api(`/api/prestamos/${prestamo.id}/cortes/${corteSeleccionado.id}/pagar`, {
        method: "PATCH",
        body: JSON.stringify({ fecha_pago: fechaPago, monto_pagado: mp, tipo_pago: tipoPago, nota }),
      });
      setCorteSeleccionado(null);
      setMontoPagado("");
      setNota("");
      reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function handleProrrogar(corte) {
    const notaPr = prompt("Nota de prórroga (opcional):", "PRÓRROGA — interés no cobrado") || "PRÓRROGA — interés no cobrado";
    try {
      await api(`/api/prestamos/${prestamo.id}/cortes/${corte.id}/prorrogar`, {
        method: "PATCH",
        body: JSON.stringify({ nota: notaPr }),
      });
      reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px", width: 620, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,.18)" }}>
        {/* Encabezado */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.navy }}>📅 Intereses mensuales — {prestamo.deudor_nombre}</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: C.oxford }}>Monto: <b>{fmt(prestamo.monto)}</b> · Interés mensual: <b>{fmt(prestamo.interes_mensual)}</b></p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: C.oxford }}>✕</button>
        </div>

        {/* Resumen numérico */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
          <div style={{ background: C.redLight, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: 0, fontSize: 10, color: C.oxford }}>Interés pendiente</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: C.red }}>{fmt(totalPendiente)}</p>
            <p style={{ margin: 0, fontSize: 10, color: C.oxford }}>{pendientes.length} mes(es)</p>
          </div>
          <div style={{ background: C.greenLight, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: 0, fontSize: 10, color: C.oxford }}>Interés cobrado</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: C.green }}>{fmt(totalCobrado)}</p>
            <p style={{ margin: 0, fontSize: 10, color: C.oxford }}>{pagados.length} mes(es)</p>
          </div>
          <div style={{ background: C.goldLight, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: 0, fontSize: 10, color: C.oxford }}>Total cortes</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "#8B6914" }}>{cortes.length}</p>
            <p style={{ margin: 0, fontSize: 10, color: C.oxford }}>meses desde el préstamo</p>
          </div>
        </div>

        {/* Panel de pago (si hay corte seleccionado) */}
        {corteSeleccionado && (
          <div style={{ background: C.lightGray, borderRadius: 10, padding: "12px 14px", marginBottom: 14, border: `1px solid ${C.gold}` }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: C.navy }}>
              Registrar pago — {fmtPeriodo(corteSeleccionado.periodo)}
              <span style={{ marginLeft: 8, color: C.oxford, fontWeight: 400 }}>Esperado: {fmt(corteSeleccionado.monto_interes)}</span>
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
              <Inp label="Fecha de pago" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}/>
              <Inp label="Monto pagado ($)" type="number" value={montoPagado}
                placeholder={String(corteSeleccionado.monto_interes)}
                onChange={e => setMontoPagado(e.target.value)}/>
              <div style={{ marginBottom: 9 }}>
                <label style={{ display: "block", fontSize: 12, color: C.oxford, marginBottom: 3, fontWeight: 600 }}>Tipo de pago</label>
                <select value={tipoPago} onChange={e => setTipoPago(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.navy, background: C.lightGray }}>
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <Inp label="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} placeholder="Observaciones"/>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn color={C.green} onClick={handlePagar} loading={saving}>✓ Registrar pago</Btn>
              <Btn color={C.oxford} small onClick={() => setCorteSeleccionado(null)}>Cancelar</Btn>
            </div>
          </div>
        )}

        {/* Tabla de cortes */}
        {loading ? <p style={{ fontSize: 12, color: C.oxford, textAlign: "center", padding: 16 }}>Cargando...</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: C.navy }}>
                {["Mes","Interés esperado","Estado","Pagado","Fecha pago","Nota","Acción"].map((h, i) =>
                  <th key={i} style={{ color: C.gold, padding: "7px 8px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {cortes.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 16, color: C.oxford }}>Sin cortes generados aún</td></tr>
                  : cortes.map((c, i) => {
                      const esPendiente = !c.pagado;
                      const tieneProroga = !c.pagado && c.nota && c.nota.includes("PRÓRROGA");
                      const bgRow = c.pagado ? C.greenLight : (tieneProroga ? C.goldLight : (i % 2 === 0 ? C.white : C.lightGray));
                      return (
                        <tr key={c.id} style={{ background: bgRow }}>
                          <td style={{ padding: "6px 8px", fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                            {fmtPeriodo(c.periodo)}
                          </td>
                          <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>{fmt(c.monto_interes)}</td>
                          <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>
                            {c.pagado
                              ? <Badge color={C.green} bg={C.greenLight}>✓ Pagado</Badge>
                              : tieneProroga
                                ? <Badge color="#8B6914" bg={C.goldLight}>⏸ Prórroga</Badge>
                                : <Badge color={C.red} bg={C.redLight}>⚠ Pendiente</Badge>}
                          </td>
                          <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: c.pagado ? C.green : C.oxford }}>
                            {c.monto_pagado > 0 ? fmt(c.monto_pagado) : "—"}
                          </td>
                          <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                            {fmtFecha(c.fecha_pago)}
                          </td>
                          <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.nota || "—"}
                          </td>
                          <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>
                            {esPendiente && (
                              <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
                                <Btn small color={C.green} onClick={() => { setCorteSeleccionado(c); setMontoPagado(String(c.monto_interes)); }}>
                                  $ Cobrar
                                </Btn>
                                <Btn small color="#8B6914" onClick={() => handleProrrogar(c)}>
                                  ⏸
                                </Btn>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ModPrestamos() {
  const { data: prestamos, loading, reload } = useApiData("/api/prestamos");
  const { data: clientes } = useApiData("/api/clientes");
  const [f, setF] = useState({ cliente_id: "", fecha_prestamo: today, monto: "", nota: "" });
  const [saving, setSaving] = useState(false);
  const [abonoPrestamo, setAbonoPrestamo] = useState(null);
  const [cortesPrestamoModal, setCortesPrestamoModal] = useState(null);
  const [ordenFecha, setOrdenFecha] = useState("desc");
  const [busqueda, setBusqueda] = useState("");   // ← NUEVO: filtro de búsqueda
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  const activosFiltrados = [...prestamos.filter(p => !p.pagado && p.monto > 0)]
    .filter(p => !busqueda || p.deudor_nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => {
      const diff = new Date(a.fecha_prestamo) - new Date(b.fecha_prestamo);
      return ordenFecha === "asc" ? diff : -diff;
    });
  const activos = prestamos.filter(p => !p.pagado && p.monto > 0);
  const pagados = prestamos.filter(p => p.pagado);
  const totalCartera = activos.reduce((a, p) => a + parseFloat(p.monto || 0), 0);
  const totalIntereses = activos.reduce((a, p) => a + parseFloat(p.interes_mensual || 0), 0);

  async function handleAgregar() {
    if (!f.cliente_id || !f.monto) return alert("Cliente y monto requeridos");
    setSaving(true);
    try {
      await api("/api/prestamos", {
        method: "POST",
        body: JSON.stringify({
          cliente_id: parseInt(f.cliente_id),
          fecha_prestamo: f.fecha_prestamo,
          nota: f.nota,
          monto: parseFloat(f.monto),
          interes_mensual: parseFloat(f.monto) * 0.10,
        }),
      });
      setF({ cliente_id: "", fecha_prestamo: today, monto: "", nota: "" });
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
          { l: "Intereses esperados (mes)", v: fmt(totalIntereses), c: "#8B6914", bg: C.goldLight },
          { l: "Préstamos pagados", v: pagados.length, c: C.green, bg: C.greenLight },
        ].map((s2, i) => <Card key={i} style={{ background: s2.bg }}><p style={{ margin: 0, fontSize: 11, color: C.oxford }}>{s2.l}</p><p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: s2.c }}>{s2.v}</p></Card>)}
      </div>

      {/* Formulario horizontal */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Registrar préstamo</p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
          <Sel label="Cliente" value={f.cliente_id} onChange={s("cliente_id")}>
            <option value="">Selecciona un cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat} {c.apellido_mat || ""}</option>)}
          </Sel>
          <Inp label="Fecha del préstamo" type="date" value={f.fecha_prestamo} onChange={s("fecha_prestamo")}/>
          <Inp label="Monto ($)" type="number" value={f.monto} onChange={s("monto")}/>
          <Inp label="Notas" value={f.nota} onChange={s("nota")} placeholder="Observaciones"/>
          <div style={{ marginBottom: 9 }}>
            <Btn color={C.orange} onClick={handleAgregar} loading={saving}>Registrar</Btn>
          </div>
        </div>
        {f.monto && <div style={{ background: C.goldLight, borderRadius: 8, padding: "7px 10px", fontSize: 12, marginTop: -4 }}>
          Interés (10%): <b>{fmt(parseFloat(f.monto) * 0.10)}</b>
        </div>}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        {/* Barra de controles: búsqueda + orden */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.oxford }}>
            Préstamos activos ({activosFiltrados.length}{busqueda ? ` de ${activos.length}` : ""})
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Búsqueda */}
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.oxford }}>🔍</span>
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar deudor..."
                style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.navy, background: C.lightGray, width: 180 }}
              />
              {busqueda && <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: C.oxford }}>✕</button>}
            </div>
            {/* Orden */}
            <button onClick={() => setOrdenFecha(o => o === "asc" ? "desc" : "asc")}
              style={{ display: "flex", alignItems: "center", gap: 5, background: C.navyLight, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 11, color: C.navy, fontWeight: 700, cursor: "pointer" }}>
              📅 {ordenFecha === "asc" ? "↑ Más antiguo" : "↓ Más reciente"}
            </button>
          </div>
        </div>

        <Tabla
          headers={["#", "Deudor", "Fecha", "Monto", "Interés/mes", "Capital abonado", "Saldo", "Nota", "Acciones"]}
          rows={activosFiltrados.map(p => {
            const saldo = parseFloat(p.monto || 0) - parseFloat(p.capital_abonado || 0);
            return [
              p.id, p.deudor_nombre,
              fmtFecha(p.fecha_prestamo),
              fmt(p.monto), fmt(p.interes_mensual), fmt(p.capital_abonado || 0),
              <b key={`s${p.id}`} style={{ color: saldo <= 0 ? C.green : C.orange }}>{fmt(saldo)}</b>,
              p.nota || "—",
              <div key={`acc${p.id}`} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Btn small color="#6B46C1" onClick={() => setCortesPrestamoModal(p)}>📅 Intereses</Btn>
                <Btn small color={C.orange} onClick={() => setAbonoPrestamo(p)}>$ Abonar</Btn>
                <Btn small color={C.green} onClick={() => handlePagar(p.id)}>✓ Liquidar</Btn>
              </div>
            ];
          })}
        />
      </Card>

      {pagados.length > 0 && <Card>
        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Pagados ({pagados.length})</p>
        <Tabla
          headers={["#", "Deudor", "Fecha préstamo", "Monto", "Fecha pago", "Nota"]}
          rows={pagados.map(p => [p.id, p.deudor_nombre, fmtFecha(p.fecha_prestamo), fmt(p.monto), fmtFecha(p.fecha_pago), p.nota || "—"])}
        />
      </Card>}

      {abonoPrestamo && (
        <ModalAbono prestamo={abonoPrestamo} onClose={() => setAbonoPrestamo(null)} onSaved={() => { setAbonoPrestamo(null); reload(); }}/>
      )}
      {cortesPrestamoModal && (
        <ModalCortesInteres prestamo={cortesPrestamoModal} onClose={() => { setCortesPrestamoModal(null); reload(); }}/>
      )}
    </div>
  );
}

// ── MÓDULO: CLIENTES — formulario HORIZONTAL ──────────────────────────────────
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
      {/* Formulario HORIZONTAL en una sola Card */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Registrar cliente</p>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
          <Inp label="Nombre(s)" value={f.nombre} onChange={s("nombre")} placeholder="Ej. JUAN"/>
          <Inp label="Apellido paterno" value={f.apellido_pat} onChange={s("apellido_pat")} placeholder="GONZALEZ"/>
          <Inp label="Apellido materno" value={f.apellido_mat} onChange={s("apellido_mat")} placeholder="MENDOZA"/>
          <Inp label="Teléfono" value={f.telefono} onChange={s("telefono")} placeholder="555-0000"/>
          <Inp label="Dirección" value={f.direccion} onChange={s("direccion")} placeholder="Calle y número"/>
          <div style={{ marginBottom: 9 }}>
            <Btn onClick={handleAgregar} loading={saving}>Guardar</Btn>
          </div>
        </div>
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
  );
}

// ── MÓDULO: AHORRO ────────────────────────────────────────────────────────────
function ModAhorro() {
  const { data: ahorros, loading, reload } = useApiData("/api/ahorros");
  const { data: clientesSinAhorro, reload: reloadCSA } = useApiData("/api/clientes-sin-ahorro");
  const [f, setF] = useState({ cliente_id: "", cantidad: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editValor, setEditValor] = useState("");
  const total = ahorros.reduce((a, x) => a + parseFloat(x.cantidad || 0), 0);

  async function handleAgregar() {
    if (!f.cliente_id) return alert("Selecciona un cliente");
    setSaving(true);
    try {
      await api("/api/ahorros", {
        method: "POST",
        body: JSON.stringify({ cliente_id: parseInt(f.cliente_id), cantidad: parseFloat(f.cantidad || 0) }),
      });
      setF({ cliente_id: "", cantidad: "" });
      reload(); reloadCSA();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function guardarEdicion(aid) {
    try {
      await api(`/api/ahorros/${aid}`, { method: "PATCH", body: JSON.stringify({ cantidad: parseFloat(editValor || 0) }) });
      setEditId(null); reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando ahorros...</p>;
  return (
    <div>
      <SectionTitle>Ahorro</SectionTitle>
      <Card style={{ background: C.navyLight, marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>Total en ahorros del grupo</p>
        <p style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 700, color: C.navy }}>{fmt(total)}</p>
      </Card>
      {clientesSinAhorro.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Dar de alta ahorro</p>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "end" }}>
            <Sel label="Cliente" value={f.cliente_id} onChange={e => setF(x => ({ ...x, cliente_id: e.target.value }))}>
              <option value="">Selecciona un cliente</option>
              {clientesSinAhorro.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat} {c.apellido_mat || ""}</option>)}
            </Sel>
            <Inp label="Cantidad inicial ($)" type="number" value={f.cantidad} onChange={e => setF(x => ({ ...x, cantidad: e.target.value }))}/>
            <div style={{ marginBottom: 9 }}><Btn onClick={handleAgregar} loading={saving}>Dar de alta</Btn></div>
          </div>
        </Card>
      )}
      <Card>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Ahorros por integrante ({ahorros.length})</p>
        <Tabla
          headers={["Apellido P.", "Apellido M.", "Nombre", "Cantidad", "Acción"]}
          rows={ahorros.map(a => [
            a.apellido_pat, a.apellido_mat, a.nombre,
            editId === a.id
              ? <input key={`i${a.id}`} type="number" value={editValor} onChange={e => setEditValor(e.target.value)}
                  style={{ width: 90, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>
              : fmt(a.cantidad),
            editId === a.id
              ? <Btn key={`g${a.id}`} small color={C.green} onClick={() => guardarEdicion(a.id)}>Guardar</Btn>
              : <Btn key={`e${a.id}`} small onClick={() => { setEditId(a.id); setEditValor(a.cantidad); }}>Editar</Btn>
          ])}
        />
      </Card>
    </div>
  );
}

// ── MÓDULO: CAJA — con movimientos quincenales ────────────────────────────────
function ModalMovimientosCaja({ participante, onClose }) {
  const { data: movimientos, loading, reload } = useApiData(`/api/caja/${participante.id}/movimientos`);
  const [fecha, setFecha] = useState(today);
  const [monto, setMonto] = useState(participante.cuota || "");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  const totalAportado = movimientos.reduce((a, m) => a + parseFloat(m.monto || 0), 0);
  const interes = totalAportado * 0.0004;
  const totalConInteres = totalAportado + interes;

  async function handleRegistrar() {
    if (!monto || parseFloat(monto) <= 0) return alert("Ingresa un monto válido");
    setSaving(true);
    try {
      await api(`/api/caja/${participante.id}/movimientos`, {
        method: "POST",
        body: JSON.stringify({ fecha, monto: parseFloat(monto), nota }),
      });
      setNota(""); reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px", width: 580, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>{participante.participante}</p>
            <p style={{ margin: 0, fontSize: 12, color: C.oxford }}>Cuota quincenal: <b>{fmt(participante.cuota)}</b></p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: C.oxford }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
          <div style={{ background: C.navyLight, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: 0, fontSize: 10, color: C.oxford }}>Total aportado</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: C.navy }}>{fmt(totalAportado)}</p>
          </div>
          <div style={{ background: C.goldLight, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: 0, fontSize: 10, color: C.oxford }}>Interés (0.04% anual)</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "#8B6914" }}>{fmt(interes)}</p>
          </div>
          <div style={{ background: C.greenLight, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: 0, fontSize: 10, color: C.oxford }}>Total a entregar</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: C.green }}>{fmt(totalConInteres)}</p>
          </div>
        </div>
        <div style={{ background: C.lightGray, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Registrar aportación quincenal</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: 8, alignItems: "end" }}>
            <Inp label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
            <Inp label="Monto ($)" type="number" value={monto} onChange={e => setMonto(e.target.value)}/>
            <Inp label="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej. pago adelantado"/>
            <div style={{ marginBottom: 9 }}><Btn color={C.orange} onClick={handleRegistrar} loading={saving}>+ Agregar</Btn></div>
          </div>
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Historial ({movimientos.length} registros)</p>
        {loading ? <p style={{ fontSize: 12, color: C.oxford, textAlign: "center", padding: 12 }}>Cargando...</p>
          : <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: C.navy }}>
                  {["#","Fecha","Monto","Acumulado","Nota"].map((h,i) => <th key={i} style={{ color: C.gold, padding: "6px 8px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {movimientos.length === 0
                    ? <tr><td colSpan={5} style={{ textAlign: "center", padding: 16, color: C.oxford }}>Sin aportaciones registradas</td></tr>
                    : movimientos.map((m, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? C.white : C.lightGray }}>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{i+1}</td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{fmtFecha(m.fecha)}</td>
                        <td style={{ padding: "5px 8px", color: C.navy, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{fmt(m.monto)}</td>
                        <td style={{ padding: "5px 8px", color: C.green, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{fmt(m.acumulado)}</td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{m.nota || "—"}</td>
                      </tr>))
                  }
                </tbody>
                {movimientos.length > 0 && (
                  <tfoot><tr style={{ background: C.navyLight }}>
                    <td colSpan={2} style={{ padding: "7px 8px", fontWeight: 700, color: C.navy, fontSize: 12 }}>TOTAL APORTADO</td>
                    <td colSpan={3} style={{ padding: "7px 8px", fontWeight: 700, color: C.navy, fontSize: 13 }}>{fmt(totalAportado)}</td>
                  </tr></tfoot>
                )}
              </table>
            </div>
        }
      </div>
    </div>
  );
}

function ModCaja() {
  const { data: caja, loading, reload } = useApiData("/api/caja");
  const { data: clientes } = useApiData("/api/clientes");
  const [f, setF] = useState({ cliente_id: "", cuota: "", capital: "", fecha_inicio: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});
  const [modalParticipante, setModalParticipante] = useState(null);
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  const totalCapital = caja.reduce((a, c) => a + parseFloat(c.capital || 0), 0);
  const totalCuota = caja.reduce((a, c) => a + parseFloat(c.cuota || 0), 0);
  const interesProyectado = totalCapital * 0.04;

  async function handleAgregar() {
    if (!f.cliente_id) return alert("Selecciona un cliente");
    setSaving(true);
    try {
      await api("/api/caja", {
        method: "POST",
        body: JSON.stringify({ cliente_id: parseInt(f.cliente_id), cuota: parseFloat(f.cuota || 0), capital: parseFloat(f.capital || 0), fecha_inicio: f.fecha_inicio }),
      });
      setF({ cliente_id: "", cuota: "", capital: "", fecha_inicio: "" });
      reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function guardarEdicion(cid) {
    try {
      await api(`/api/caja/${cid}`, {
        method: "PATCH",
        body: JSON.stringify({ participante: editF.participante, cuota: parseFloat(editF.cuota || 0), capital: parseFloat(editF.capital || 0), fecha_inicio: editF.fecha_inicio }),
      });
      setEditId(null); reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  async function handleBorrar(cid) {
    if (!window.confirm("¿Eliminar este participante de la caja?")) return;
    try { await api(`/api/caja/${cid}`, { method: "DELETE" }); reload(); }
    catch (e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando caja...</p>;

  return (
    <div>
      <SectionTitle>Caja de ahorro</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        <Card style={{ background: C.navyLight }}>
          <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>Capital total acumulado</p>
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, color: C.navy }}>{fmt(totalCapital)}</p>
        </Card>
        <Card style={{ background: C.goldLight }}>
          <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>Aportación quincenal total</p>
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, color: "#8B6914" }}>{fmt(totalCuota)}</p>
        </Card>
        <Card style={{ background: C.greenLight }}>
          <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>Interés anual proyectado (0.04%)</p>
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, color: C.green }}>{fmt(interesProyectado)}</p>
        </Card>
      </div>

      {/* Formulario HORIZONTAL */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Agregar participante</p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <Sel label="Cliente" value={f.cliente_id} onChange={s("cliente_id")}>
            <option value="">Selecciona un cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat} {c.apellido_mat || ""}</option>)}
          </Sel>
          <Inp label="Cuota quincenal ($)" type="number" value={f.cuota} onChange={s("cuota")}/>
          <Inp label="Capital acumulado ($)" type="number" value={f.capital} onChange={s("capital")}/>
          <Inp label="Fecha de inicio" value={f.fecha_inicio} onChange={s("fecha_inicio")} placeholder="15-ene"/>
          <div style={{ marginBottom: 9 }}><Btn onClick={handleAgregar} loading={saving}>Agregar</Btn></div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.oxford }}>Participantes ({caja.length})</p>
          <div style={{ background: C.navyLight, borderRadius: 8, padding: "5px 12px", fontSize: 11, color: C.navy, fontWeight: 600 }}>
            📋 Clic en "Movimientos" para registrar aportaciones quincenales
          </div>
        </div>
        <Tabla
          headers={["No.", "Nombre", "Cuota quincenal", "Capital acumulado", "Interés (0.04%)", "Total estimado", "Inicio", "Acciones"]}
          rows={caja.map((c, i) => {
            const interes = parseFloat(c.capital || 0) * 0.0004;
            const totalEstimado = parseFloat(c.capital || 0) + interes;
            if (editId === c.id) {
              return [
                i+1,
                <input key={`p${c.id}`} value={editF.participante} onChange={e => setEditF(x=>({...x,participante:e.target.value}))} style={{width:120,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                <input key={`q${c.id}`} type="number" value={editF.cuota} onChange={e => setEditF(x=>({...x,cuota:e.target.value}))} style={{width:80,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                <input key={`ca${c.id}`} type="number" value={editF.capital} onChange={e => setEditF(x=>({...x,capital:e.target.value}))} style={{width:90,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                "—","—",
                <input key={`f${c.id}`} value={editF.fecha_inicio} onChange={e => setEditF(x=>({...x,fecha_inicio:e.target.value}))} style={{width:70,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                <Btn key={`g${c.id}`} small color={C.green} onClick={() => guardarEdicion(c.id)}>Guardar</Btn>
              ];
            }
            return [
              i+1, c.participante, fmt(c.cuota), fmt(c.capital),
              <span key={`int${c.id}`} style={{color:"#8B6914",fontWeight:700}}>{fmt(interes)}</span>,
              <span key={`tot${c.id}`} style={{color:C.green,fontWeight:700}}>{fmt(totalEstimado)}</span>,
              c.fecha_inicio || "—",
              <div key={`acc${c.id}`} style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                <Btn small color={C.orange} onClick={() => setModalParticipante(c)}>📋 Movimientos</Btn>
                <Btn small onClick={() => { setEditId(c.id); setEditF({participante:c.participante,cuota:c.cuota,capital:c.capital,fecha_inicio:c.fecha_inicio||""}); }}>Editar</Btn>
                <Btn small color={C.red} onClick={() => handleBorrar(c.id)}>Borrar</Btn>
              </div>
            ];
          })}
        />
        <div style={{ borderTop: `2px solid ${C.border}`, marginTop: 8, paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.oxford }}>TOTALES GRUPO</div>
          <div style={{ fontSize: 12 }}>Capital: <span style={{ fontWeight: 700, color: C.navy }}>{fmt(totalCapital)}</span></div>
          <div style={{ fontSize: 12 }}>Con interés: <span style={{ fontWeight: 700, color: C.green }}>{fmt(totalCapital + interesProyectado)}</span></div>
        </div>
      </Card>

      {modalParticipante && (
        <ModalMovimientosCaja participante={modalParticipante} onClose={() => { setModalParticipante(null); reload(); }}/>
      )}
    </div>
  );
}

// ── MÓDULO: PAGOS A PLAZOS ────────────────────────────────────────────────────
function ModPagosPlazos() {
  const { data: plazos, loading, reload } = useApiData("/api/plazos");
  const [f, setF] = useState({ material: "", costo: "", meses_total: "", cuota: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  async function handleAbonar(pid) {
    try { await api(`/api/plazos/${pid}/abonar`, { method: "PATCH", body: JSON.stringify({}) }); reload(); }
    catch (e) { alert("Error: " + e.message); }
  }

  async function handleAgregar() {
    if (!f.material || !f.meses_total) return alert("Material y meses son requeridos");
    setSaving(true);
    try {
      await api("/api/plazos", {
        method: "POST",
        body: JSON.stringify({ material: f.material, costo: f.costo ? parseFloat(f.costo) : null, meses_total: parseInt(f.meses_total), meses_pagados: 0, cuota: f.cuota ? parseFloat(f.cuota) : null, abonado: 0 }),
      });
      setF({ material: "", costo: "", meses_total: "", cuota: "" }); reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function guardarEdicion(pid) {
    try {
      await api(`/api/plazos/${pid}`, {
        method: "PATCH",
        body: JSON.stringify({ material: editF.material, costo: editF.costo===""?null:parseFloat(editF.costo), meses_total: parseInt(editF.meses_total), meses_pagados: parseInt(editF.meses_pagados), cuota: editF.cuota===""?null:parseFloat(editF.cuota), abonado: parseFloat(editF.abonado||0) }),
      });
      setEditId(null); reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  async function handleBorrar(pid) {
    if (!window.confirm("¿Eliminar este artículo?")) return;
    try { await api(`/api/plazos/${pid}`, { method: "DELETE" }); reload(); }
    catch (e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando plazos...</p>;
  return (
    <div>
      <SectionTitle>Pagos a plazos</SectionTitle>
      {/* Formulario HORIZONTAL */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Agregar artículo</p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <Inp label="Material / Artículo" value={f.material} onChange={s("material")} placeholder="Ej. Refrigerador"/>
          <Inp label="Costo total ($)" type="number" value={f.costo} onChange={s("costo")}/>
          <Inp label="Meses totales" type="number" value={f.meses_total} onChange={s("meses_total")}/>
          <Inp label="Cuota mensual ($)" type="number" value={f.cuota} onChange={s("cuota")}/>
          <div style={{ marginBottom: 9 }}><Btn onClick={handleAgregar} loading={saving}>Agregar</Btn></div>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <Card>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Artículos ({plazos.length})</p>
          <Tabla
            headers={["Material","Costo","Meses","Pagados","Pendientes","Cuota","Abonado","Restante","Avance","Acciones"]}
            rows={plazos.map(p => {
              if (editId === p.id) {
                return [
                  <input key={`m${p.id}`} value={editF.material} onChange={e=>setEditF(x=>({...x,material:e.target.value}))} style={{width:100,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                  <input key={`c${p.id}`} type="number" value={editF.costo} onChange={e=>setEditF(x=>({...x,costo:e.target.value}))} style={{width:80,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                  <input key={`mt${p.id}`} type="number" value={editF.meses_total} onChange={e=>setEditF(x=>({...x,meses_total:e.target.value}))} style={{width:55,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                  <input key={`mp${p.id}`} type="number" value={editF.meses_pagados} onChange={e=>setEditF(x=>({...x,meses_pagados:e.target.value}))} style={{width:55,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                  "—",
                  <input key={`cu${p.id}`} type="number" value={editF.cuota} onChange={e=>setEditF(x=>({...x,cuota:e.target.value}))} style={{width:70,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                  <input key={`ab${p.id}`} type="number" value={editF.abonado} onChange={e=>setEditF(x=>({...x,abonado:e.target.value}))} style={{width:80,padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}/>,
                  "—","—",
                  <Btn key={`g${p.id}`} small color={C.green} onClick={() => guardarEdicion(p.id)}>Guardar</Btn>
                ];
              }
              const pend = p.meses_total - p.meses_pagados;
              const rest = (p.costo||0) - (p.abonado||0);
              const pct = p.meses_total ? Math.round((p.meses_pagados/p.meses_total)*100) : 0;
              return [
                p.material, fmt(p.costo), p.meses_total, p.meses_pagados, pend, fmt(p.cuota), fmt(p.abonado), fmt(rest),
                <div key={`bar${p.id}`} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{background:C.border,borderRadius:6,height:8,width:60}}>
                    <div style={{background:pct>=100?C.green:C.orange,width:`${Math.min(pct,100)}%`,height:8,borderRadius:6}}/>
                  </div>
                  <span style={{fontSize:10}}>{pct}%</span>
                </div>,
                <div key={`acc${p.id}`} style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {pend>0 ? <Btn small color={C.green} onClick={()=>handleAbonar(p.id)}>+ Abono</Btn>
                           : <Badge color={C.green} bg={C.greenLight}>✓ Liquidado</Badge>}
                  <Btn small onClick={()=>{setEditId(p.id);setEditF({material:p.material,costo:p.costo??"",meses_total:p.meses_total,meses_pagados:p.meses_pagados,cuota:p.cuota??"",abonado:p.abonado??0});}}>Editar</Btn>
                  <Btn small color={C.red} onClick={()=>handleBorrar(p.id)}>Borrar</Btn>
                </div>
              ];
            })}
          />
        </Card>
      </div>
    </div>
  );
}

// ── MÓDULO: RESUMEN ───────────────────────────────────────────────────────────
function ModResumen({ irA }) {
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
  const datosDistribucion = [
    { name: "Cartera activa", value: totalCartera, color: C.navy },
    { name: "Ahorros", value: totalAhorros, color: C.green },
    { name: "Caja", value: totalCaja, color: C.orange },
  ].filter(d => d.value > 0);
  const datosBarras = topDeudores.map(([nombre, monto]) => ({ nombre, monto }));

  return (
    <div>
      <SectionTitle>Resumen ejecutivo — GONZA</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { l: "Cartera activa prestada", v: fmt(totalCartera), c: C.navy, bg: C.navyLight, i: "💼", sec: "prestamos" },
          { l: "Intereses por cobrar (mensual)", v: fmt(totalIntereses), c: "#8B6914", bg: C.goldLight, i: "📊", sec: "prestamos" },
          { l: "Total ahorros del grupo", v: fmt(totalAhorros), c: C.green, bg: C.greenLight, i: "🏦", sec: "ahorro" },
          { l: "Capital caja de ahorro", v: fmt(totalCaja), c: C.orange, bg: C.orangeLight, i: "💰", sec: "caja" },
        ].map((s, i) => (
          <Card key={i} onClick={() => irA(s.sec)} style={{ background: s.bg, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <span style={{ fontSize: 28 }}>{s.i}</span>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>{s.l}</p>
              <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</p>
            </div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Distribución del capital</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={datosDistribucion} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                {datosDistribucion.map((d, i) => <Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip formatter={v => fmt(v)}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Top 5 deudores</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datosBarras} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tickFormatter={v => fmt(v)} fontSize={10}/>
              <YAxis type="category" dataKey="nombre" width={90} fontSize={10}/>
              <Tooltip formatter={v => fmt(v)}/>
              <Bar dataKey="monto" fill={C.orange} radius={[0,6,6,0]} cursor="pointer" onClick={() => irA("prestamos")}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card onClick={() => irA("prestamos")} style={{ cursor: "pointer" }}>
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
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Ranking de deudores</p>
          {topDeudores.map(([nombre, monto], i) => {
            const maxM = topDeudores[0][1] || 1;
            return (
              <div key={nombre} style={{ marginBottom: 10, cursor: "pointer" }} onClick={() => irA("prestamos")}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: C.oxford }}>{i+1}. {nombre}</span>
                  <span style={{ fontWeight: 700, color: C.navy }}>{fmt(monto)}</span>
                </div>
                <div style={{ background: C.border, borderRadius: 6, height: 7 }}>
                  <div style={{ background: i===0?C.orange:C.navy, width: `${(monto/maxM)*100}%`, height: 7, borderRadius: 6 }}/>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ── MÓDULO: USUARIOS — formulario HORIZONTAL ──────────────────────────────────
function ModUsuarios() {
  const { data: usuarios, loading, reload } = useApiData("/api/usuarios");
  const { data: roles } = useApiData("/api/roles");
  const [f, setF] = useState({ username: "", nombre: "", password: "", rol_id: "" });
  const [saving, setSaving] = useState(false);
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  async function handleAgregar() {
    if (!f.username || !f.nombre || !f.password || !f.rol_id) return alert("Todos los campos son requeridos");
    setSaving(true);
    try {
      await api("/api/usuarios", { method: "POST", body: JSON.stringify({ ...f, rol_id: parseInt(f.rol_id) }) });
      setF({ username: "", nombre: "", password: "", rol_id: "" }); reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function handleToggleActivo(uid, activo) {
    try { await api(`/api/usuarios/${uid}`, { method: "PATCH", body: JSON.stringify({ activo: !activo }) }); reload(); }
    catch (e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando usuarios...</p>;

  return (
    <div>
      <SectionTitle>Gestión de usuarios</SectionTitle>
      {/* Formulario HORIZONTAL en una Card completa */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Nuevo usuario</p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr 1fr auto", gap: 10, alignItems: "end" }}>
          <Inp label="Nombre completo" value={f.nombre} onChange={s("nombre")} placeholder="Ej. Juan Pérez"/>
          <Inp label="Usuario (login)" value={f.username} onChange={s("username")} placeholder="jperez"/>
          <Inp label="Contraseña" type="password" value={f.password} onChange={s("password")} placeholder="••••••••"/>
          <Sel label="Rol" value={f.rol_id} onChange={s("rol_id")}>
            <option value="">Selecciona un rol</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </Sel>
          <div style={{ marginBottom: 9 }}><Btn onClick={handleAgregar} loading={saving}>Crear usuario</Btn></div>
        </div>
      </Card>
      <Card>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Usuarios del sistema ({usuarios.length})</p>
        <Tabla
          headers={["ID", "Nombre", "Usuario", "Rol", "Estado", "Acción"]}
          rows={usuarios.map(u => [
            u.id, u.nombre, u.username,
            <Badge key={`r${u.id}`}>{u.rol}</Badge>,
            <Badge key={`e${u.id}`} color={u.activo?C.green:C.red} bg={u.activo?C.greenLight:C.redLight}>{u.activo?"Activo":"Inactivo"}</Badge>,
            <Btn key={`b${u.id}`} small color={u.activo?C.red:C.green} onClick={()=>handleToggleActivo(u.id,u.activo)}>
              {u.activo?"Desactivar":"Activar"}
            </Btn>
          ])}
        />
      </Card>
    </div>
  );
}

// ── MÓDULO: CONFIGURACIÓN ─────────────────────────────────────────────────────
function ModConfiguracion() {
  const [dias, setDias] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCorreo, setSavingCorreo] = useState(false);
  const [msg, setMsg] = useState("");
  const [formatoBackup, setFormatoBackup] = useState("xlsx");

  useEffect(() => {
    api("/api/configuracion/dias_anticipacion")
      .then(d => { setDias(d.dias_anticipacion); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleGuardar() {
    const v = parseInt(dias);
    if (isNaN(v) || v < 0) return alert("Ingresa un número válido de días");
    setSaving(true);
    try {
      await api("/api/configuracion/dias_anticipacion", {
        method: "PATCH",
        body: JSON.stringify({ dias_anticipacion: v }),
      });
      setMsg("✅ Configuración guardada correctamente");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  // Envía UN SOLO correo con las 3 secciones: alertas + informe + respaldo adjunto
  async function handleEnviarCorreoCombinado() {
    if (!window.confirm(
      "¿Enviar correo completo ahora?\n\nUn solo correo con:\n• 🔔 Alertas de réditos\n• 📊 Informe ejecutivo\n• 💾 Respaldo en " + formatoBackup.toUpperCase()
    )) return;
    setSavingCorreo(true);
    try {
      const res = await api("/api/correo/completo", {
        method: "POST",
        body: JSON.stringify({ formato: formatoBackup }),
      });
      const errores = res.errores || [];
      const lineas = [
        `✅ Correo enviado a ${res.enviados ?? 0} destinatario(s)`,
        `🔔 Alertas incluidas: ${res.alertas ?? 0}`,
        `💾 Respaldo adjunto: ${(res.formato || formatoBackup).toUpperCase()}`,
      ];
      if (errores.length) lineas.push("⚠️ Errores: " + errores.join(", "));
      alert(lineas.join("\n"));
    } catch (e) { alert("Error al enviar: " + e.message); }
    finally { setSavingCorreo(false); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando configuración...</p>;

  return (
    <div>
      <SectionTitle>Configuración del sistema</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Alertas — días de anticipación */}
        <Card>
          <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: C.navy }}>⚙️ Alertas de réditos</p>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: C.oxford, lineHeight: 1.6 }}>
            Define con cuántos días de anticipación aparecen las alertas de cobro de interés mensual en el sistema y en los correos.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
            <Inp
              label="Días de anticipación para alertas"
              type="number"
              value={dias}
              onChange={e => setDias(e.target.value)}
              placeholder="Ej. 2"
            />
            <div style={{ marginBottom: 9 }}>
              <Btn color={C.orange} onClick={handleGuardar} loading={saving}>Guardar</Btn>
            </div>
          </div>
          {msg && <div style={{ background: C.greenLight, color: C.green, fontSize: 12, padding: "7px 10px", borderRadius: 8, marginTop: 4 }}>{msg}</div>}
        </Card>

        {/* Correo combinado */}
        <Card>
          <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: C.navy }}>📧 Envío de correos</p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: C.oxford, lineHeight: 1.6 }}>
            Los correos de alerta se envían automáticamente cada día a las <b>8:00 AM</b> (cron job). También puedes enviarlos manualmente ahora.
          </p>

          {/* Selector de formato del respaldo */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.oxford, marginBottom: 6 }}>
              Formato del respaldo adjunto:
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {["xlsx", "csv", "sql"].map(f => (
                <button key={f} onClick={() => setFormatoBackup(f)} style={{
                  padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: `2px solid ${formatoBackup === f ? C.orange : C.border}`,
                  background: formatoBackup === f ? C.orangeLight : C.lightGray,
                  color: formatoBackup === f ? C.orange : C.oxford,
                }}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Botón principal */}
          <Btn color={C.navy} onClick={handleEnviarCorreoCombinado} loading={savingCorreo}>
            📨 Enviar correo completo ahora
          </Btn>

          {/* Detalle de lo que incluye */}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { icon: "🔔", texto: "Alertas de réditos próximos a vencer" },
              { icon: "📊", texto: "Informe ejecutivo (cartera, caja, top deudores)" },
              { icon: "💾", texto: `Respaldo de base de datos en ${formatoBackup.toUpperCase()}` },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.lightGray, borderRadius: 8, padding: "6px 10px", fontSize: 12, color: C.oxford }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.texto}
              </div>
            ))}
          </div>

          <div style={{ background: C.goldLight, borderRadius: 8, padding: "8px 12px", marginTop: 12, fontSize: 11, color: "#8B6914" }}>
            <b>Destinatarios:</b> todos los usuarios con rol <b>administrador</b> o <b>analista</b> que tengan correo registrado en la base de datos.
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── ALERTAS BELL ──────────────────────────────────────────────────────────────
function AlertasBell() {
  const { data: alertas, loading } = useApiData("/api/alertas");
  const [open, setOpen] = useState(false);
  if (loading) return null;
  return (
    <div style={{ position: "relative", marginLeft: 14 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20, position: "relative", padding: 4 }}>
        🔔
        {alertas.length > 0 && (
          <span style={{ position: "absolute", top: -2, right: -2, background: C.red, color: C.white, fontSize: 10, fontWeight: 700, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{alertas.length}</span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", top: 36, right: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,.2)", width: 300, zIndex: 1000, padding: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.navy }}>Réditos próximos a vencer</p>
          {alertas.length === 0
            ? <p style={{ fontSize: 12, color: C.oxford }}>Sin alertas pendientes.</p>
            : alertas.map(a => (
              <div key={a.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "6px 0", fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, color: C.navy }}>{a.deudor_nombre}</span>
                  <Badge color={a.dias_para_corte===0?C.red:C.orange} bg={a.dias_para_corte===0?C.redLight:C.orangeLight}>
                    {a.dias_para_corte===0?"Hoy":`En ${a.dias_para_corte} día(s)`}
                  </Badge>
                </div>
                <div style={{ color: C.oxford, marginTop: 2 }}>Interés: {fmt(a.interes_mensual)} · Corte: {fmtFecha(a.proximo_corte)}</div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── LOGIN CON "OLVIDÉ MI CONTRASEÑA" ─────────────────────────────────────────
function ModalResetPassword({ onClose }) {
  const [username, setUsername] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1); // 1=buscar usuario, 2=nueva contraseña
  const [userData, setUserData] = useState(null);
  const [msg, setMsg] = useState("");

  async function handleBuscar() {
    if (!username.trim()) return alert("Ingresa tu nombre de usuario");
    setSaving(true);
    try {
      // Verificar que el usuario existe consultando los roles (endpoint público)
      // Usamos el endpoint de login con una contraseña incorrecta para saber si el usuario existe
      const res = await fetch(`${API_BASE}/api/usuario-existe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.ok) {
        alert("Usuario no encontrado. Verifica el nombre de usuario.");
        return;
      }
      const data = await res.json();
      setUserData(data);
      setStep(2);
    } catch (e) {
      alert("Error de conexión: " + e.message);
    } finally { setSaving(false); }
  }

  async function handleReset() {
    if (!newPass || newPass.length < 6) return alert("La contraseña debe tener al menos 6 caracteres");
    if (newPass !== confirmPass) return alert("Las contraseñas no coinciden");
    setSaving(true);
    try {
      await api(`/api/usuarios/reset-password`, {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), new_password: newPass }),
      });
      setMsg("✅ Contraseña restablecida correctamente. Ya puedes iniciar sesión.");
      setStep(3);
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <Card style={{ width: 360 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.navy }}>🔑 Restablecer contraseña</p>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: C.oxford }}>✕</button>
        </div>

        {step === 1 && (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: C.oxford }}>
              Ingresa tu nombre de usuario para continuar.
            </p>
            <Inp label="Nombre de usuario" value={username} onChange={e => setUsername(e.target.value)} placeholder="Ej. jgonzalez" autoFocus/>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn color={C.orange} onClick={handleBuscar} loading={saving}>Continuar</Btn>
              <Btn color={C.oxford} onClick={onClose}>Cancelar</Btn>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ background: C.navyLight, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12 }}>
              Usuario encontrado: <b style={{ color: C.navy }}>{userData?.nombre || username}</b>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: C.oxford }}>
              Define una nueva contraseña. Mínimo 6 caracteres.
            </p>
            <Inp label="Nueva contraseña" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="••••••••"/>
            <Inp label="Confirmar contraseña" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="••••••••"/>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn color={C.orange} onClick={handleReset} loading={saving}>Restablecer</Btn>
              <Btn color={C.oxford} onClick={onClose}>Cancelar</Btn>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ background: C.greenLight, color: C.green, fontSize: 13, padding: "12px 14px", borderRadius: 8, marginBottom: 14 }}>{msg}</div>
            <Btn color={C.navy} onClick={onClose}>Volver al login</Btn>
          </>
        )}
      </Card>
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al iniciar sesión"); return; }
      onLogin(data);
    } catch (e2) { setError("No se pudo conectar con el servidor"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: C.lightGray, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 320 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
          <LogoLogin/>
          <div style={{ fontSize: 11, color: C.oxford, letterSpacing: 1, textTransform: "uppercase", marginTop: 10, textAlign: "center" }}>Sistema de administración de pagos</div>
        </div>
        <form onSubmit={handleSubmit}>
          <Inp label="Usuario" value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario" autoFocus/>
          <Inp label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
          {error && <div style={{ background: C.redLight, color: C.red, fontSize: 12, padding: "7px 10px", borderRadius: 8, marginBottom: 10 }}>{error}</div>}
          <Btn color={C.orange} loading={loading}>Iniciar sesión</Btn>
        </form>
        {/* NUEVO: enlace olvidé mi contraseña */}
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={() => setShowReset(true)} style={{ background: "transparent", border: "none", color: C.navy, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </Card>
      {showReset && <ModalResetPassword onClose={() => setShowReset(false)}/>}
    </div>
  );
}

// ── MENÚ Y APP PRINCIPAL ──────────────────────────────────────────────────────
const MENU = [
  { id: "resumen",     label: "Resumen",          icon: "📊" },
  { id: "clientes",   label: "Clientes",          icon: "👥" },
  { id: "prestamos",  label: "Préstamos",         icon: "💼" },
  { id: "ahorro",     label: "Ahorro",            icon: "🏦" },
  { id: "caja",       label: "Caja",              icon: "💰" },
  { id: "plazos",     label: "Pagos a plazos",    icon: "📅" },
  { id: "usuarios",   label: "Usuarios",          icon: "🔐", soloAdmin: true },
  { id: "config",     label: "Configuración",     icon: "⚙️",  soloAdmin: true },
];

export default function App() {
  const [sec, setSec] = useState("resumen");
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("gonza_user");
    return saved ? JSON.parse(saved) : null;
  });

  function handleLogin(userData) {
    sessionStorage.setItem("gonza_user", JSON.stringify(userData));
    setUser(userData);
  }
  function handleLogout() {
    sessionStorage.removeItem("gonza_user");
    setUser(null);
  }

  if (!user) return <Login onLogin={handleLogin}/>;

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: C.lightGray, minHeight: "100vh" }}>
      <div style={{ background: C.navy, padding: "0 20px", display: "flex", alignItems: "center", gap: 14, height: 56, boxShadow: "0 2px 6px rgba(0,0,0,.3)" }}>
        <Logo size={40}/>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 2, color: C.gold, lineHeight: 1.1 }}>JGM</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a0b8d8", letterSpacing: 0.5, lineHeight: 1.1 }}>Gonzas <span style={{ color: C.orange }}>systems</span></div>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ textAlign: "right", marginRight: 14 }}>
          <div style={{ fontSize: 12, color: C.white, fontWeight: 700 }}>{user.nombre}</div>
          <div style={{ fontSize: 10, color: C.gold, textTransform: "uppercase" }}>{user.rol}</div>
        </div>
        <AlertasBell/>
        <Btn small color={C.orange} onClick={handleLogout}>Salir</Btn>
        <div style={{ fontSize: 11, color: "#8fa8c8", marginLeft: 14 }}>
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>
      <nav style={{ background: C.oxford, display: "flex", flexWrap: "wrap", boxShadow: "0 2px 4px rgba(0,0,0,.2)" }}>
        {MENU.filter(m => !m.soloAdmin || user.rol === "administrador").map(m => {
          const active = sec === m.id;
          return (
            <button key={m.id} onClick={() => setSec(m.id)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "11px 18px",
              background: active ? C.navy : "transparent", border: "none",
              borderBottom: active ? `3px solid ${C.gold}` : "3px solid transparent",
              color: active ? C.gold : "#b0bcd4", fontSize: 13, fontWeight: active ? 700 : 400, cursor: "pointer",
            }}>
              <span style={{ fontSize: 15 }}>{m.icon}</span>{m.label}
            </button>
          );
        })}
      </nav>
      <main style={{ padding: "20px 22px", overflowY: "auto", minHeight: "calc(100vh - 100px)" }}>
        {sec === "resumen"   && <ModResumen irA={setSec}/>}
        {sec === "clientes"  && <ModClientes/>}
        {sec === "prestamos" && <ModPrestamos/>}
        {sec === "ahorro"    && <ModAhorro/>}
        {sec === "caja"      && <ModCaja/>}
        {sec === "plazos"    && <ModPagosPlazos/>}
        {sec === "usuarios"  && <ModUsuarios/>}
        {sec === "config"    && <ModConfiguracion/>}
      </main>
    </div>
  );
}
