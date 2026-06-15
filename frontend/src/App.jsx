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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
  const user = sessionStorage.getItem("gonza_user");
  const username = user ? JSON.parse(user).username : "";
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Username": username,
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}: ${res.statusText}`);
  }
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
      <Card style={{ width: 420, maxHeight: "85vh", overflowY: "auto" }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: C.navy }}>Abono — {prestamo.deudor_nombre}</p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: C.oxford }}>
          Monto del préstamo: <b>{fmt(prestamo.monto)}</b> · Capital abonado: <b>{fmt(prestamo.capital_abonado || 0)}</b> · Saldo restante: <b style={{ color: C.orange }}>{fmt(saldoRestante)}</b>
        </p>

        <Inp label="Fecha del abono" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}/>
        <Inp label="Abono al interés ($)" type="number" value={montoInteres} onChange={e => setMontoInteres(e.target.value)}/>
        <Inp label="Abono al capital ($)" type="number" value={montoCapital} onChange={e => setMontoCapital(e.target.value)}/>
        <Inp label="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} placeholder="Observaciones"/>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Btn color={C.orange} onClick={handleGuardar} loading={saving}>Registrar abono</Btn>
          <Btn color={C.oxford} onClick={onClose}>Cerrar</Btn>
        </div>

        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Historial de abonos</p>
        {loadingHist
          ? <p style={{ fontSize: 12, color: C.oxford }}>Cargando...</p>
          : <Tabla
              headers={["Fecha", "Interés", "Capital", "Nota"]}
              rows={historial.map(h => [h.fecha_pago, fmt(h.monto_interes), fmt(h.monto_capital), h.nota || "—"])}
              empty="Sin abonos registrados"
            />
        }
      </Card>
    </div>
  );
}

function ModPrestamos() {
  const { data: prestamos, loading, reload } = useApiData("/api/prestamos");
  const { data: clientes } = useApiData("/api/clientes");
  const [f, setF] = useState({ cliente_id: "", fecha_prestamo: today, monto: "", nota: "" });
  const [saving, setSaving] = useState(false);
  const [abonoPrestamo, setAbonoPrestamo] = useState(null);
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

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
          { l: "Intereses esperados", v: fmt(totalIntereses), c: "#8B6914", bg: C.goldLight },
          { l: "Préstamos pagados", v: pagados.length, c: C.green, bg: C.greenLight },
        ].map((s2, i) => <Card key={i} style={{ background: s2.bg }}><p style={{ margin: 0, fontSize: 11, color: C.oxford }}>{s2.l}</p><p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: s2.c }}>{s2.v}</p></Card>)}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Registrar préstamo</p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
          <Sel label="Cliente" value={f.cliente_id} onChange={s("cliente_id")}>
            <option value="">Selecciona un cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat} {c.apellido_mat || ""}</option>)}
          </Sel>
          <Inp label="Fecha del préstamo" type="date" value={f.fecha_prestamo} onChange={s("fecha_prestamo")}/>
          <Inp label="Monto prestado ($)" type="number" value={f.monto} onChange={s("monto")}/>
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
        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Préstamos activos ({activos.length})</p>
        <Tabla
          headers={["#", "Deudor", "Fecha", "Monto", "Interés (10%)", "Capital abonado", "Saldo restante", "Nota", "Acciones"]}
          rows={activos.map(p => {
            const saldo = parseFloat(p.monto || 0) - parseFloat(p.capital_abonado || 0);
            return [
              p.id, p.deudor_nombre, p.fecha_prestamo,
              fmt(p.monto), fmt(p.interes_mensual), fmt(p.capital_abonado || 0),
              <b key={`s${p.id}`} style={{ color: saldo <= 0 ? C.green : C.orange }}>{fmt(saldo)}</b>,
              p.nota || "—",
              <div key={`acc${p.id}`} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Btn small color={C.orange} onClick={() => setAbonoPrestamo(p)}>Abonar</Btn>
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
          rows={pagados.map(p => [p.id, p.deudor_nombre, p.fecha_prestamo, fmt(p.monto), p.fecha_pago || "—", p.nota || "—"])}
        />
      </Card>}

      {abonoPrestamo && (
        <ModalAbono
          prestamo={abonoPrestamo}
          onClose={() => setAbonoPrestamo(null)}
          onSaved={() => { setAbonoPrestamo(null); reload(); }}
        />
      )}
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
      reload();
      reloadCSA();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  function empezarEdicion(a) {
    setEditId(a.id);
    setEditValor(a.cantidad);
  }

  async function guardarEdicion(aid) {
    try {
      await api(`/api/ahorros/${aid}`, { method: "PATCH", body: JSON.stringify({ cantidad: parseFloat(editValor || 0) }) });
      setEditId(null);
      reload();
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Dar de alta ahorro</p>
          {clientesSinAhorro.length === 0
            ? <p style={{ fontSize: 12, color: C.oxford }}>Todos los clientes ya tienen registro de ahorro.</p>
            : <>
                <Sel label="Cliente" value={f.cliente_id} onChange={e => setF(x => ({ ...x, cliente_id: e.target.value }))}>
                  <option value="">Selecciona un cliente</option>
                  {clientesSinAhorro.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat} {c.apellido_mat || ""}</option>)}
                </Sel>
                <Inp label="Cantidad inicial ($)" type="number" value={f.cantidad} onChange={e => setF(x => ({ ...x, cantidad: e.target.value }))}/>
                <Btn onClick={handleAgregar} loading={saving}>Dar de alta</Btn>
              </>
          }
        </Card>
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
                : <Btn key={`e${a.id}`} small onClick={() => empezarEdicion(a)}>Editar</Btn>
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
// ── MÓDULO: CAJA ──────────────────────────────────────────────────────────────
function ModCaja() {
  const { data: caja, loading, reload } = useApiData("/api/caja");
  const { data: clientes } = useApiData("/api/clientes");
  const [f, setF] = useState({ cliente_id: "", cuota: "", capital: "", fecha_inicio: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  const totalCapital = caja.reduce((a, c) => a + parseFloat(c.capital || 0), 0);
  const totalCuota = caja.reduce((a, c) => a + parseFloat(c.cuota || 0), 0);

  async function handleAgregar() {
    if (!f.cliente_id) return alert("Selecciona un cliente");
    setSaving(true);
    try {
      await api("/api/caja", {
        method: "POST",
        body: JSON.stringify({
          cliente_id: parseInt(f.cliente_id),
          cuota: parseFloat(f.cuota || 0),
          capital: parseFloat(f.capital || 0),
          fecha_inicio: f.fecha_inicio,
        }),
      });
      setF({ cliente_id: "", cuota: "", capital: "", fecha_inicio: "" });
      reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  function empezarEdicion(c) {
    setEditId(c.id);
    setEditF({ participante: c.participante, cuota: c.cuota, capital: c.capital, fecha_inicio: c.fecha_inicio || "" });
  }

  async function guardarEdicion(cid) {
    try {
      await api(`/api/caja/${cid}`, {
        method: "PATCH",
        body: JSON.stringify({
          participante: editF.participante,
          cuota: parseFloat(editF.cuota || 0),
          capital: parseFloat(editF.capital || 0),
          fecha_inicio: editF.fecha_inicio,
        }),
      });
      setEditId(null);
      reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  async function handleBorrar(cid) {
    if (!window.confirm("¿Eliminar este participante de la caja?")) return;
    try {
      await api(`/api/caja/${cid}`, { method: "DELETE" });
      reload();
    } catch (e) { alert("Error: " + e.message); }
  }

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
          <div style={{ marginBottom: 9 }}>
            <Btn onClick={handleAgregar} loading={saving}>Agregar</Btn>
          </div>
        </div>
      </Card>

      <Card>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Participantes ({caja.length})</p>
        <Tabla
          headers={["No.", "Nombre", "Cuota quincenal", "Capital acumulado", "Inicio", "Acciones"]}
          rows={caja.map((c, i) => {
            if (editId === c.id) {
              return [
                i + 1,
                <input key={`p${c.id}`} value={editF.participante} onChange={e => setEditF(x => ({ ...x, participante: e.target.value }))}
                  style={{ width: 130, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                <input key={`q${c.id}`} type="number" value={editF.cuota} onChange={e => setEditF(x => ({ ...x, cuota: e.target.value }))}
                  style={{ width: 80, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                <input key={`c${c.id}`} type="number" value={editF.capital} onChange={e => setEditF(x => ({ ...x, capital: e.target.value }))}
                  style={{ width: 90, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                <input key={`f${c.id}`} value={editF.fecha_inicio} onChange={e => setEditF(x => ({ ...x, fecha_inicio: e.target.value }))}
                  style={{ width: 70, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                <Btn key={`g${c.id}`} small color={C.green} onClick={() => guardarEdicion(c.id)}>Guardar</Btn>
              ];
            }
            return [
              i + 1, c.participante, fmt(c.cuota), fmt(c.capital), c.fecha_inicio || "—",
              <div key={`acc${c.id}`} style={{ display: "flex", gap: 4 }}>
                <Btn small onClick={() => empezarEdicion(c)}>Editar</Btn>
                <Btn small color={C.red} onClick={() => handleBorrar(c.id)}>Borrar</Btn>
              </div>
            ];
          })}
        />
      </Card>
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
    try {
      await api(`/api/plazos/${pid}/abonar`, { method: "PATCH", body: JSON.stringify({}) });
      reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  async function handleAgregar() {
    if (!f.material || !f.meses_total) return alert("Material y número de meses son requeridos");
    setSaving(true);
    try {
      await api("/api/plazos", {
        method: "POST",
        body: JSON.stringify({
          material: f.material,
          costo: f.costo ? parseFloat(f.costo) : null,
          meses_total: parseInt(f.meses_total),
          meses_pagados: 0,
          cuota: f.cuota ? parseFloat(f.cuota) : null,
          abonado: 0,
        }),
      });
      setF({ material: "", costo: "", meses_total: "", cuota: "" });
      reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  function empezarEdicion(p) {
    setEditId(p.id);
    setEditF({
      material: p.material, costo: p.costo ?? "", meses_total: p.meses_total,
      meses_pagados: p.meses_pagados, cuota: p.cuota ?? "", abonado: p.abonado ?? 0,
    });
  }

  async function guardarEdicion(pid) {
    try {
      await api(`/api/plazos/${pid}`, {
        method: "PATCH",
        body: JSON.stringify({
          material: editF.material,
          costo: editF.costo === "" ? null : parseFloat(editF.costo),
          meses_total: parseInt(editF.meses_total),
          meses_pagados: parseInt(editF.meses_pagados),
          cuota: editF.cuota === "" ? null : parseFloat(editF.cuota),
          abonado: parseFloat(editF.abonado || 0),
        }),
      });
      setEditId(null);
      reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  async function handleBorrar(pid) {
    if (!window.confirm("¿Eliminar este artículo a plazos?")) return;
    try {
      await api(`/api/plazos/${pid}`, { method: "DELETE" });
      reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando plazos...</p>;
  return (
    <div>
      <SectionTitle>Pagos a plazos</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr", gap: 16 }}>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Agregar artículo</p>
          <Inp label="Material" value={f.material} onChange={s("material")} placeholder="Ej. Refrigerador"/>
          <Inp label="Costo total ($)" type="number" value={f.costo} onChange={s("costo")}/>
          <Inp label="Meses totales" type="number" value={f.meses_total} onChange={s("meses_total")}/>
          <Inp label="Cuota mensual ($)" type="number" value={f.cuota} onChange={s("cuota")}/>
          <Btn onClick={handleAgregar} loading={saving}>Agregar</Btn>
        </Card>
        <Card>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Artículos ({plazos.length})</p>
          <Tabla
            headers={["Material", "Costo", "Meses", "Pagados", "Pendientes", "Cuota", "Abonado", "Restante", "Avance", "Acciones"]}
            rows={plazos.map(p => {
              if (editId === p.id) {
                return [
                  <input key={`m${p.id}`} value={editF.material} onChange={e => setEditF(x => ({ ...x, material: e.target.value }))}
                    style={{ width: 100, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                  <input key={`c${p.id}`} type="number" value={editF.costo} onChange={e => setEditF(x => ({ ...x, costo: e.target.value }))}
                    style={{ width: 80, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                  <input key={`mt${p.id}`} type="number" value={editF.meses_total} onChange={e => setEditF(x => ({ ...x, meses_total: e.target.value }))}
                    style={{ width: 55, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                  <input key={`mp${p.id}`} type="number" value={editF.meses_pagados} onChange={e => setEditF(x => ({ ...x, meses_pagados: e.target.value }))}
                    style={{ width: 55, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                  "—",
                  <input key={`cu${p.id}`} type="number" value={editF.cuota} onChange={e => setEditF(x => ({ ...x, cuota: e.target.value }))}
                    style={{ width: 70, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                  <input key={`ab${p.id}`} type="number" value={editF.abonado} onChange={e => setEditF(x => ({ ...x, abonado: e.target.value }))}
                    style={{ width: 80, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}/>,
                  "—", "—",
                  <Btn key={`g${p.id}`} small color={C.green} onClick={() => guardarEdicion(p.id)}>Guardar</Btn>
                ];
              }
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
                <div key={`acc${p.id}`} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {pend > 0
                    ? <Btn small color={C.green} onClick={() => handleAbonar(p.id)}>+ Abono</Btn>
                    : <Badge color={C.green} bg={C.greenLight}>✓ Liquidado</Badge>}
                  <Btn small onClick={() => empezarEdicion(p)}>Editar</Btn>
                  <Btn small color={C.red} onClick={() => handleBorrar(p.id)}>Borrar</Btn>
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
          <Card key={i} onClick={() => irA(s.sec)} style={{ background: s.bg, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "transform .1s" }}>
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
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Distribución del capital del grupo</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={datosDistribucion} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {datosDistribucion.map((d, i) => <Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Top 5 deudores (monto activo)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datosBarras} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tickFormatter={v => fmt(v)} fontSize={10}/>
              <YAxis type="category" dataKey="nombre" width={90} fontSize={10}/>
              <Tooltip formatter={(v) => fmt(v)}/>
              <Bar dataKey="monto" fill={C.orange} radius={[0, 6, 6, 0]} cursor="pointer" onClick={() => irA("prestamos")}/>
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
// ── MÓDULO: USUARIOS ──────────────────────────────────────────────────────────
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
      await api("/api/usuarios", {
        method: "POST",
        body: JSON.stringify({ ...f, rol_id: parseInt(f.rol_id) }),
      });
      setF({ username: "", nombre: "", password: "", rol_id: "" });
      reload();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function handleToggleActivo(uid, activo) {
    try {
      await api(`/api/usuarios/${uid}`, { method: "PATCH", body: JSON.stringify({ activo: !activo }) });
      reload();
    } catch (e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding: 20, color: C.oxford }}>Cargando usuarios...</p>;

  return (
    <div>
      <SectionTitle>Gestión de usuarios</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Nuevo usuario</p>
          <Inp label="Nombre completo" value={f.nombre} onChange={s("nombre")} placeholder="Ej. Juan Pérez"/>
          <Inp label="Usuario (para login)" value={f.username} onChange={s("username")} placeholder="jperez"/>
          <Inp label="Contraseña" type="password" value={f.password} onChange={s("password")} placeholder="••••••••"/>
          <Sel label="Rol" value={f.rol_id} onChange={s("rol_id")}>
            <option value="">Selecciona un rol</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </Sel>
          <Btn onClick={handleAgregar} loading={saving}>Crear usuario</Btn>
        </Card>
        <Card>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Usuarios del sistema ({usuarios.length})</p>
          <Tabla
            headers={["ID", "Nombre", "Usuario", "Rol", "Estado", "Acción"]}
            rows={usuarios.map(u => [
              u.id, u.nombre, u.username, <Badge key={`r${u.id}`}>{u.rol}</Badge>,
              <Badge key={`e${u.id}`} color={u.activo ? C.green : C.red} bg={u.activo ? C.greenLight : C.redLight}>{u.activo ? "Activo" : "Inactivo"}</Badge>,
              <Btn key={`b${u.id}`} small color={u.activo ? C.red : C.green} onClick={() => handleToggleActivo(u.id, u.activo)}>
                {u.activo ? "Desactivar" : "Activar"}
              </Btn>
            ])}
          />
        </Card>
      </div>
    </div>
  );
}

// ── ALERTAS ────────────────────────────────────────────────────────────────
function AlertasBell() {
  const { data: alertas, loading } = useApiData("/api/alertas");
  const [open, setOpen] = useState(false);

  if (loading) return null;

  return (
    <div style={{ position: "relative", marginLeft: 14 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: "transparent", border: "none", cursor: "pointer",
        fontSize: 20, position: "relative", padding: 4,
      }}>
        🔔
        {alertas.length > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2, background: C.red, color: C.white,
            fontSize: 10, fontWeight: 700, borderRadius: "50%", width: 16, height: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{alertas.length}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: 36, right: 0, background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,.2)", width: 300, zIndex: 1000, padding: 12,
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.navy }}>
            Réditos próximos a vencer
          </p>
          {alertas.length === 0
            ? <p style={{ fontSize: 12, color: C.oxford }}>Sin alertas pendientes.</p>
            : alertas.map(a => (
                <div key={a.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "6px 0", fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, color: C.navy }}>{a.deudor_nombre}</span>
                    <Badge color={a.dias_para_corte === 0 ? C.red : C.orange} bg={a.dias_para_corte === 0 ? C.redLight : C.orangeLight}>
                      {a.dias_para_corte === 0 ? "Hoy" : `En ${a.dias_para_corte} día(s)`}
                    </Badge>
                  </div>
                  <div style={{ color: C.oxford, marginTop: 2 }}>
                    Interés: {fmt(a.interes_mensual)} · Corte: {a.proximo_corte}
                  </div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

// ── LOGIN ──────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }
      onLogin(data);
    } catch (e2) {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: C.lightGray, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 320 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
          <Logo size={48}/>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1.5, color: C.gold, marginTop: 8 }}>GONZA</div>
          <div style={{ fontSize: 10, color: C.oxford, letterSpacing: 1, textTransform: "uppercase" }}>Sistema de administración de pagos</div>
        </div>
        <form onSubmit={handleSubmit}>
          <Inp label="Usuario" value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario" autoFocus/>
          <Inp label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
          {error && <div style={{ background: C.redLight, color: C.red, fontSize: 12, padding: "7px 10px", borderRadius: 8, marginBottom: 10 }}>{error}</div>}
          <Btn color={C.orange} loading={loading}>Iniciar sesión</Btn>
        </form>
      </Card>
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
  { id: "usuarios", label: "Usuarios", icon: "🔐", soloAdmin: true },
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
        <Logo size={36}/>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1.5, color: C.gold }}>GONZA</div>
          <div style={{ fontSize: 9, color: "#8fa8c8", letterSpacing: 1, textTransform: "uppercase" }}>Sistema de administración de pagos</div>
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
              color: active ? C.gold : "#b0bcd4", fontSize: 13, fontWeight: active ? 700 : 400,
              cursor: "pointer",
            }}>
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              {m.label}
            </button>
          );
        })}
      </nav>
      <div style={{ minHeight: "calc(100vh - 100px)" }}>
        <main style={{ padding: "20px 22px", overflowY: "auto" }}>
          {sec === "resumen" && <ModResumen irA={setSec}/>}
          {sec === "clientes" && <ModClientes/>}
          {sec === "prestamos" && <ModPrestamos/>}
          {sec === "ahorro" && <ModAhorro/>}
          {sec === "caja" && <ModCaja/>}
          {sec === "plazos" && <ModPagosPlazos/>}
          {sec === "usuarios" && <ModUsuarios/>}
        </main>
      </div>
    </div>
  );
}
