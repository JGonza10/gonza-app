// ─────────────────────────────────────────────────────────────────────────────
// GONZA - Frontend React v2
// Cambios: roles (consultor/usuario), CRUD completo, buscadores,
// módulo Mi Cuenta, módulo Configuración, columnas nuevas (caja/ahorro/plazos)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── PALETA ────────────────────────────────────────────────────────────────────
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

async function api(path, options = {}) {
  const user = sessionStorage.getItem("gonza_user");
  const username = user ? JSON.parse(user).username : "";
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", "X-Username": username },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
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

const Card = ({ children, style }) =>
  <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", ...style }}>{children}</div>;

const SectionTitle = ({ children }) =>
  <h2 style={{ margin:"0 0 14px", fontSize:17, fontWeight:700, color:C.navy, borderLeft:`4px solid ${C.gold}`, paddingLeft:10 }}>{children}</h2>;

const Badge = ({ children, color=C.navy, bg=C.navyLight }) =>
  <span style={{ background:bg, color, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap" }}>{children}</span>;

const Inp = ({ label, ...p }) => (
  <div style={{ marginBottom:9 }}>
    {label && <label style={{ display:"block", fontSize:12, color:C.oxford, marginBottom:3, fontWeight:600 }}>{label}</label>}
    <input {...p} style={{ width:"100%", padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, color:C.navy, background:C.lightGray, boxSizing:"border-box", ...p.style }}/>
  </div>
);

const Sel = ({ label, children, ...p }) => (
  <div style={{ marginBottom:9 }}>
    {label && <label style={{ display:"block", fontSize:12, color:C.oxford, marginBottom:3, fontWeight:600 }}>{label}</label>}
    <select {...p} style={{ width:"100%", padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, color:C.navy, background:C.lightGray, boxSizing:"border-box" }}>{children}</select>
  </div>
);

const Btn = ({ children, onClick, color=C.navy, small, loading, disabled }) => (
  <button onClick={onClick} disabled={loading || disabled}
    style={{ background: loading||disabled ? "#aaa" : color, color:C.white, border:"none", borderRadius:8,
      padding: small ? "4px 12px" : "8px 18px", fontSize: small ? 11 : 13, fontWeight:700,
      cursor: loading||disabled ? "not-allowed" : "pointer" }}>
    {loading ? "..." : children}
  </button>
);

const Tabla = ({ headers, rows, empty="Sin registros" }) => (
  <div style={{ overflowX:"auto" }}>
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
      <thead><tr style={{ background:C.navy }}>
        {headers.map((h,i) => <th key={i} style={{ color:C.gold, padding:"7px 9px", textAlign:"left", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>)}
      </tr></thead>
      <tbody>
        {rows.length === 0
          ? <tr><td colSpan={headers.length} style={{ textAlign:"center", padding:16, color:C.oxford }}>{empty}</td></tr>
          : rows.map((r,i) => <tr key={i} style={{ background: i%2===0 ? C.white : C.lightGray }}>
              {r.map((c,j) => <td key={j} style={{ padding:"6px 9px", color:C.oxford, borderBottom:`1px solid ${C.border}` }}>{c}</td>)}
            </tr>)
        }
      </tbody>
    </table>
  </div>
);

// Buscador reutilizable
const Buscador = ({ value, onChange, placeholder="Buscar..." }) => (
  <input value={value} onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{ padding:"7px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13,
      color:C.navy, background:C.lightGray, width:220, marginBottom:10 }}/>
);

// Hook genérico de datos
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

// Modal genérico
const Modal = ({ children, onClose, title }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"flex",
    alignItems:"center", justifyContent:"center", zIndex:1000 }}>
    <Card style={{ width:460, maxHeight:"88vh", overflowY:"auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span style={{ fontWeight:700, color:C.navy, fontSize:15 }}>{title}</span>
        <button onClick={onClose} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:C.oxford }}>✕</button>
      </div>
      {children}
    </Card>
  </div>
);

// ── MÓDULO: RESUMEN ───────────────────────────────────────────────────────────
function ModResumen({ irA }) {
  const { data: prestamos, loading: lp } = useApiData("/api/prestamos");
  const { data: ahorros, loading: la } = useApiData("/api/ahorros");
  const { data: caja, loading: lc } = useApiData("/api/caja");
  if (lp || la || lc) return <p style={{ padding:20, color:C.oxford }}>Cargando resumen...</p>;

  const activos = prestamos.filter(p => !p.pagado && p.monto > 0);
  const totalCartera = activos.reduce((a,p) => a + parseFloat(p.monto||0), 0);
  const totalIntereses = activos.reduce((a,p) => a + parseFloat(p.interes_mensual||0), 0);
  const totalAhorros = ahorros.reduce((a,x) => a + parseFloat(x.cantidad||0), 0);
  const totalCaja = caja.filter(c => c.activo !== false).reduce((a,c) => a + parseFloat(c.capital||0), 0);
  const interesesCaja = caja.filter(c => c.activo !== false).reduce((a,c) => a + parseFloat(c.intereses||c.capital*0.04||0), 0);

  const porDeudor = {};
  activos.forEach(p => { porDeudor[p.deudor_nombre] = (porDeudor[p.deudor_nombre]||0) + parseFloat(p.monto); });
  const topDeudores = Object.entries(porDeudor).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const datosDistribucion = [
    { name:"Cartera", value:totalCartera, color:C.navy },
    { name:"Ahorros", value:totalAhorros, color:C.green },
    { name:"Caja",    value:totalCaja,    color:C.orange },
  ].filter(d => d.value > 0);

  return (
    <div>
      <SectionTitle>Resumen ejecutivo — GONZA</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:16 }}>
        {[
          { l:"Cartera activa prestada",      v:fmt(totalCartera),   c:C.navy,    bg:C.navyLight,   i:"💼", sec:"prestamos" },
          { l:"Intereses por cobrar (mensual)",v:fmt(totalIntereses), c:"#8B6914", bg:C.goldLight,   i:"📊", sec:"prestamos" },
          { l:"Total ahorros del grupo",       v:fmt(totalAhorros),   c:C.green,   bg:C.greenLight,  i:"🏦", sec:"ahorro"    },
          { l:"Capital caja de ahorro",        v:fmt(totalCaja),      c:C.orange,  bg:C.orangeLight, i:"💰", sec:"caja"      },
          { l:"Intereses caja (4%)",           v:fmt(interesesCaja),  c:"#8B6914", bg:C.goldLight,   i:"📈", sec:"caja"      },
        ].map((s,i) => (
          <Card key={i} onClick={() => irA(s.sec)}
            style={{ background:s.bg, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
            <span style={{ fontSize:26 }}>{s.i}</span>
            <div>
              <p style={{ margin:0, fontSize:11, color:C.oxford }}>{s.l}</p>
              <p style={{ margin:"2px 0 0", fontSize:18, fontWeight:700, color:s.c }}>{s.v}</p>
            </div>
          </Card>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Distribución del capital</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={datosDistribucion} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                {datosDistribucion.map((d,i) => <Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip formatter={v => fmt(v)}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Top 5 deudores</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topDeudores.map(([nombre,monto]) => ({ nombre, monto }))} layout="vertical">
              <XAxis type="number" tickFormatter={v => fmt(v)} fontSize={10}/>
              <YAxis type="category" dataKey="nombre" width={90} fontSize={10}/>
              <Tooltip formatter={v => fmt(v)}/>
              <Bar dataKey="monto" fill={C.orange} radius={[0,6,6,0]} onClick={() => irA("prestamos")}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ── MÓDULO: CLIENTES ──────────────────────────────────────────────────────────
function ModClientes() {
  const { data: clientes, loading, reload } = useApiData("/api/clientes");
  const [f, setF] = useState({ nombre:"", apellido_pat:"", apellido_mat:"", telefono:"", direccion:"" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});
  const [buscar, setBuscar] = useState("");
  const s = k => e => setF(x => ({ ...x, [k]:e.target.value }));

  const filtrados = clientes.filter(c =>
    `${c.nombre} ${c.apellido_pat} ${c.apellido_mat}`.toLowerCase().includes(buscar.toLowerCase())
  );

  async function handleAgregar() {
    if (!f.nombre) return alert("Nombre requerido");
    setSaving(true);
    try { await api("/api/clientes", { method:"POST", body:JSON.stringify(f) }); setF({ nombre:"", apellido_pat:"", apellido_mat:"", telefono:"", direccion:"" }); reload(); }
    catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function handleToggleActivo(c) {
    try { await api(`/api/clientes/${c.id}`, { method:"PATCH", body:JSON.stringify({ activo:!c.activo }) }); reload(); }
    catch (e) { alert("Error: " + e.message); }
  }

  async function handleBorrar(id) {
    if (!window.confirm("¿Eliminar cliente? Si tiene registros relacionados se sugerirá desactivarlo.")) return;
    try { await api(`/api/clientes/${id}`, { method:"DELETE" }); reload(); }
    catch (e) { alert(e.message); }
  }

  async function guardarEdicion(id) {
    try { await api(`/api/clientes/${id}`, { method:"PATCH", body:JSON.stringify(editF) }); setEditId(null); reload(); }
    catch (e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding:20, color:C.oxford }}>Cargando clientes...</p>;
  return (
    <div>
      <SectionTitle>Clientes</SectionTitle>
      <Card style={{ marginBottom:14 }}>
        <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Registrar cliente</p>
        <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 0.9fr 1.5fr auto", gap:10, alignItems:"end" }}>
          <Inp label="Nombre(s)"        value={f.nombre}       onChange={s("nombre")}       placeholder="JUAN"/>
          <Inp label="Apellido paterno" value={f.apellido_pat} onChange={s("apellido_pat")} placeholder="GONZALEZ"/>
          <Inp label="Apellido materno" value={f.apellido_mat} onChange={s("apellido_mat")} placeholder="MENDOZA"/>
          <Inp label="Teléfono"         value={f.telefono}     onChange={s("telefono")}     placeholder="555-0000"/>
          <Inp label="Dirección"        value={f.direccion}    onChange={s("direccion")}    placeholder="Calle y número"/>
          <div style={{ marginBottom:9 }}><Btn onClick={handleAgregar} loading={saving}>Guardar</Btn></div>
        </div>
      </Card>
      <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.oxford }}>Directorio ({clientes.length})</p>
            <Buscador value={buscar} onChange={setBuscar} placeholder="Buscar cliente..."/>
          </div>
          <Tabla
            headers={["ID","Apellido P.","Apellido M.","Nombre","Teléfono","Estado","Acciones"]}
            rows={filtrados.map(c => {
              if (editId === c.id) return [
                c.id,
                <input key="ap" value={editF.apellido_pat||""} onChange={e => setEditF(x=>({...x,apellido_pat:e.target.value}))} style={{ width:90, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                <input key="am" value={editF.apellido_mat||""} onChange={e => setEditF(x=>({...x,apellido_mat:e.target.value}))} style={{ width:90, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                <input key="nm" value={editF.nombre||""}       onChange={e => setEditF(x=>({...x,nombre:e.target.value}))}       style={{ width:110, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                <input key="tl" value={editF.telefono||""}     onChange={e => setEditF(x=>({...x,telefono:e.target.value}))}     style={{ width:80, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                "—",
                <Btn key="g" small color={C.green} onClick={() => guardarEdicion(c.id)}>Guardar</Btn>
              ];
              return [
                c.id, c.apellido_pat, c.apellido_mat||"—", c.nombre, c.telefono||"—",
                <Badge key="e" color={c.activo ? C.green : C.red} bg={c.activo ? C.greenLight : C.redLight}>{c.activo ? "Activo" : "Inactivo"}</Badge>,
                <div key="a" style={{ display:"flex", gap:4 }}>
                  <Btn small onClick={() => { setEditId(c.id); setEditF({...c}); }}>Editar</Btn>
                  <Btn small color={c.activo ? C.red : C.green} onClick={() => handleToggleActivo(c)}>{c.activo ? "Desactivar" : "Activar"}</Btn>
                  <Btn small color={C.red} onClick={() => handleBorrar(c.id)}>Borrar</Btn>
                </div>
              ];
            })}
          />
      </Card>
    </div>
  );
}

// ── MÓDULO: PRÉSTAMOS ─────────────────────────────────────────────────────────
function ModalAbono({ prestamo, onClose, onSaved }) {
  const [montoInteres, setMontoInteres] = useState("");
  const [montoCapital, setMontoCapital] = useState("");
  const [fechaPago, setFechaPago] = useState(today);
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: historial, loading: loadingHist } = useApiData(`/api/prestamos/${prestamo.id}/historial`);
  const saldo = parseFloat(prestamo.monto||0) - parseFloat(prestamo.capital_abonado||0);

  async function handleGuardar() {
    const mi = parseFloat(montoInteres||0), mc = parseFloat(montoCapital||0);
    if (mi <= 0 && mc <= 0) return alert("Ingresa al menos un monto mayor a 0");
    setSaving(true);
    try { await api(`/api/prestamos/${prestamo.id}/abono`, { method:"POST", body:JSON.stringify({ monto_interes:mi, monto_capital:mc, fecha_pago:fechaPago, nota }) }); onSaved(); }
    catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }
  return (
    <Modal title={`Abono — ${prestamo.deudor_nombre}`} onClose={onClose}>
      <p style={{ margin:"0 0 12px", fontSize:12, color:C.oxford }}>
        Monto: <b>{fmt(prestamo.monto)}</b> · Abonado: <b>{fmt(prestamo.capital_abonado||0)}</b> · Saldo: <b style={{ color:C.orange }}>{fmt(saldo)}</b>
      </p>
      <Inp label="Fecha del abono" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}/>
      <Inp label="Abono al interés ($)" type="number" value={montoInteres} onChange={e => setMontoInteres(e.target.value)}/>
      <Inp label="Abono al capital ($)" type="number" value={montoCapital} onChange={e => setMontoCapital(e.target.value)}/>
      <Inp label="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)}/>
      <div style={{ marginBottom:14 }}><Btn color={C.orange} onClick={handleGuardar} loading={saving}>Registrar abono</Btn></div>
      <p style={{ margin:"0 0 6px", fontSize:12, fontWeight:700, color:C.oxford }}>Historial</p>
      {loadingHist ? <p style={{ fontSize:12 }}>Cargando...</p> :
        <Tabla headers={["Fecha","Interés","Capital","Nota"]}
          rows={historial.map(h => [h.fecha_pago, fmt(h.monto_interes), fmt(h.monto_capital), h.nota||"—"])}
          empty="Sin abonos"/>}
    </Modal>
  );
}

function ModalEditarPrestamo({ prestamo, onClose, onSaved }) {
  const [f, setF] = useState({
    fecha_prestamo: prestamo.fecha_prestamo, monto: prestamo.monto,
    interes_mensual: prestamo.interes_mensual, nota: prestamo.nota||"", activo: prestamo.activo !== false,
  });
  const [saving, setSaving] = useState(false);
  const s = k => e => setF(x => ({ ...x, [k]:e.target.value }));
  async function handleGuardar() {
    setSaving(true);
    try { await api(`/api/prestamos/${prestamo.id}`, { method:"PATCH", body:JSON.stringify({ ...f, monto:parseFloat(f.monto), interes_mensual:parseFloat(f.interes_mensual) }) }); onSaved(); }
    catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }
  return (
    <Modal title={`Editar — ${prestamo.deudor_nombre}`} onClose={onClose}>
      <Inp label="Fecha del préstamo" type="date" value={f.fecha_prestamo} onChange={s("fecha_prestamo")}/>
      <Inp label="Monto ($)" type="number" value={f.monto} onChange={s("monto")}/>
      <Inp label="Interés mensual ($)" type="number" value={f.interes_mensual} onChange={s("interes_mensual")}/>
      <Inp label="Nota" value={f.nota} onChange={s("nota")}/>
      <div style={{ marginBottom:10 }}>
        <label style={{ fontSize:12, color:C.oxford, fontWeight:600 }}>
          <input type="checkbox" checked={f.activo} onChange={e => setF(x=>({...x, activo:e.target.checked}))} style={{ marginRight:6 }}/>
          Préstamo activo
        </label>
      </div>
      <Btn color={C.orange} onClick={handleGuardar} loading={saving}>Guardar cambios</Btn>
    </Modal>
  );
}

function ModPrestamos({ soloLectura }) {
  const { data: prestamos, loading, reload } = useApiData("/api/prestamos");
  const { data: clientes } = useApiData("/api/clientes");
  const [f, setF] = useState({ cliente_id:"", fecha_prestamo:today, monto:"", nota:"" });
  const [saving, setSaving] = useState(false);
  const [abonoP, setAbonoP] = useState(null);
  const [editP, setEditP] = useState(null);
  const [buscar, setBuscar] = useState("");
  const s = k => e => setF(x => ({ ...x, [k]:e.target.value }));

  const activos = prestamos.filter(p => !p.pagado && p.monto > 0);
  const pagados = prestamos.filter(p => p.pagado);
  const totalCartera  = activos.reduce((a,p) => a + parseFloat(p.monto||0), 0);
  const totalIntereses = activos.reduce((a,p) => a + parseFloat(p.interes_mensual||0), 0);

  const filtrados = activos.filter(p =>
    p.deudor_nombre.toLowerCase().includes(buscar.toLowerCase())
  );

  async function handleAgregar() {
    if (!f.cliente_id || !f.monto) return alert("Cliente y monto requeridos");
    setSaving(true);
    try {
      await api("/api/prestamos", { method:"POST", body:JSON.stringify({ cliente_id:parseInt(f.cliente_id), fecha_prestamo:f.fecha_prestamo, nota:f.nota, monto:parseFloat(f.monto), interes_mensual:parseFloat(f.monto)*0.10 }) });
      setF({ cliente_id:"", fecha_prestamo:today, monto:"", nota:"" }); reload();
    } catch(e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function handlePagar(pid) {
    const fecha = prompt("Fecha de liquidación (YYYY-MM-DD):", today) || today;
    try { await api(`/api/prestamos/${pid}/pagar`, { method:"PATCH", body:JSON.stringify({ fecha_pago:fecha, tipo_pago:"transferencia" }) }); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }

  async function handleBorrar(pid) {
    if (!window.confirm("¿Eliminar este préstamo y su historial de abonos?")) return;
    try { await api(`/api/prestamos/${pid}`, { method:"DELETE" }); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding:20, color:C.oxford }}>Cargando préstamos...</p>;
  return (
    <div>
      <SectionTitle>Préstamos</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
        {[
          { l:"Cartera activa",       v:fmt(totalCartera),   c:C.navy,    bg:C.navyLight },
          { l:"Intereses esperados",  v:fmt(totalIntereses), c:"#8B6914", bg:C.goldLight },
          { l:"Préstamos pagados",    v:pagados.length,      c:C.green,   bg:C.greenLight },
        ].map((s2,i) => <Card key={i} style={{ background:s2.bg }}><p style={{ margin:0, fontSize:11, color:C.oxford }}>{s2.l}</p><p style={{ margin:"2px 0 0", fontSize:20, fontWeight:700, color:s2.c }}>{s2.v}</p></Card>)}
      </div>

      {!soloLectura && (
        <Card style={{ marginBottom:16 }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Registrar préstamo</p>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 2fr auto", gap:10, alignItems:"end" }}>
            <Sel label="Cliente" value={f.cliente_id} onChange={s("cliente_id")}>
              <option value="">Selecciona un cliente</option>
              {clientes.filter(c=>c.activo!==false).map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat}</option>)}
            </Sel>
            <Inp label="Fecha" type="date" value={f.fecha_prestamo} onChange={s("fecha_prestamo")}/>
            <Inp label="Monto ($)" type="number" value={f.monto} onChange={s("monto")}/>
            <Inp label="Nota" value={f.nota} onChange={s("nota")} placeholder="Observaciones"/>
            <div style={{ marginBottom:9 }}><Btn color={C.orange} onClick={handleAgregar} loading={saving}>Registrar</Btn></div>
          </div>
          {f.monto && <div style={{ background:C.goldLight, borderRadius:8, padding:"7px 10px", fontSize:12 }}>Interés (10%): <b>{fmt(parseFloat(f.monto)*0.10)}</b></div>}
        </Card>
      )}

      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.oxford }}>Préstamos activos ({activos.length})</p>
          <Buscador value={buscar} onChange={setBuscar} placeholder="Buscar deudor..."/>
        </div>
        <Tabla
          headers={["#","Deudor","Fecha","Monto","Interés","Saldo","Últ. abono capital","Nota","Acciones"]}
          rows={filtrados.map(p => {
            const saldo = parseFloat(p.monto||0) - parseFloat(p.capital_abonado||0);
            return [
              p.id, p.deudor_nombre, p.fecha_prestamo, fmt(p.monto), fmt(p.interes_mensual),
              <b key="s" style={{ color: saldo<=0 ? C.green : C.orange }}>{fmt(saldo)}</b>,
              p.fecha_abono_capital || "—",
              p.nota || "—",
              soloLectura
                ? <Badge key="lr" color={C.navy}>Solo lectura</Badge>
                : <div key="acc" style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    <Btn small color={C.orange} onClick={() => setAbonoP(p)}>Abonar</Btn>
                    <Btn small color={C.green}  onClick={() => handlePagar(p.id)}>✓ Liquidar</Btn>
                    <Btn small                  onClick={() => setEditP(p)}>Editar</Btn>
                    <Btn small color={C.red}    onClick={() => handleBorrar(p.id)}>Borrar</Btn>
                  </div>
            ];
          })}
        />
      </Card>

      {pagados.length > 0 && <Card>
        <p style={{ margin:"0 0 6px", fontSize:13, fontWeight:700, color:C.oxford }}>Pagados ({pagados.length})</p>
        <Tabla headers={["#","Deudor","Fecha préstamo","Monto","Fecha pago","Nota"]}
          rows={pagados.map(p=>[p.id,p.deudor_nombre,p.fecha_prestamo,fmt(p.monto),p.fecha_pago||"—",p.nota||"—"])}/>
      </Card>}

      {abonoP && <ModalAbono prestamo={abonoP} onClose={() => setAbonoP(null)} onSaved={() => { setAbonoP(null); reload(); }}/>}
      {editP  && <ModalEditarPrestamo prestamo={editP} onClose={() => setEditP(null)} onSaved={() => { setEditP(null); reload(); }}/>}
    </div>
  );
}

// ── MÓDULO: AHORRO ────────────────────────────────────────────────────────────
function ModAhorro() {
  const { data: ahorros, loading, reload } = useApiData("/api/ahorros");
  const { data: clientesSinAhorro, reload: reloadCSA } = useApiData("/api/clientes-sin-ahorro");
  const [f, setF] = useState({ cliente_id:"", cantidad:"", nota:"", fecha:today });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});

  const total = ahorros.filter(a=>a.activo!==false).reduce((a,x) => a + parseFloat(x.cantidad||0), 0);

  async function handleAgregar() {
    if (!f.cliente_id) return alert("Selecciona un cliente");
    setSaving(true);
    try { await api("/api/ahorros", { method:"POST", body:JSON.stringify({ cliente_id:parseInt(f.cliente_id), cantidad:parseFloat(f.cantidad||0), nota:f.nota, fecha:f.fecha }) }); setF({ cliente_id:"", cantidad:"", nota:"", fecha:today }); reload(); reloadCSA(); }
    catch(e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function guardarEdicion(aid) {
    try { await api(`/api/ahorros/${aid}`, { method:"PATCH", body:JSON.stringify(editF) }); setEditId(null); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }

  async function handleBorrar(aid) {
    if (!window.confirm("¿Eliminar registro de ahorro?")) return;
    try { await api(`/api/ahorros/${aid}`, { method:"DELETE" }); reload(); reloadCSA(); }
    catch(e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding:20, color:C.oxford }}>Cargando ahorros...</p>;
  return (
    <div>
      <SectionTitle>Ahorro</SectionTitle>
      <Card style={{ background:C.navyLight, marginBottom:16 }}>
        <p style={{ margin:0, fontSize:11, color:C.oxford }}>Total en ahorros del grupo (activos)</p>
        <p style={{ margin:"2px 0 0", fontSize:24, fontWeight:700, color:C.navy }}>{fmt(total)}</p>
      </Card>

      {clientesSinAhorro.length > 0 && (
        <Card style={{ marginBottom:16 }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Dar de alta ahorro</p>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1.5fr auto", gap:10, alignItems:"end" }}>
            <Sel label="Cliente" value={f.cliente_id} onChange={e => setF(x=>({...x,cliente_id:e.target.value}))}>
              <option value="">Selecciona un cliente</option>
              {clientesSinAhorro.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat}</option>)}
            </Sel>
            <Inp label="Cantidad ($)" type="number" value={f.cantidad} onChange={e => setF(x=>({...x,cantidad:e.target.value}))}/>
            <Inp label="Fecha" type="date" value={f.fecha} onChange={e => setF(x=>({...x,fecha:e.target.value}))}/>
            <Inp label="Nota" value={f.nota} onChange={e => setF(x=>({...x,nota:e.target.value}))} placeholder="Observaciones"/>
            <div style={{ marginBottom:9 }}><Btn onClick={handleAgregar} loading={saving}>Dar de alta</Btn></div>
          </div>
        </Card>
      )}

      <Card>
        <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.oxford }}>Ahorros por integrante ({ahorros.length})</p>
        <Tabla
          headers={["Apellido P.","Apellido M.","Nombre","Cantidad","Fecha","Nota","Estado","Acción"]}
          rows={ahorros.map(a => {
            if (editId === a.id) return [
              a.apellido_pat, a.apellido_mat, a.nombre,
              <input key="c" type="number" value={editF.cantidad} onChange={e => setEditF(x=>({...x,cantidad:e.target.value}))} style={{ width:90, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
              <input key="f" type="date" value={editF.fecha||today} onChange={e => setEditF(x=>({...x,fecha:e.target.value}))} style={{ width:110, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
              <input key="n" value={editF.nota||""} onChange={e => setEditF(x=>({...x,nota:e.target.value}))} style={{ width:110, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
              "—",
              <Btn key="g" small color={C.green} onClick={() => guardarEdicion(a.id)}>Guardar</Btn>
            ];
            return [
              a.apellido_pat, a.apellido_mat||"—", a.nombre, fmt(a.cantidad),
              a.fecha || "—", a.nota || "—",
              <Badge key="e" color={a.activo!==false ? C.green : C.red} bg={a.activo!==false ? C.greenLight : C.redLight}>{a.activo!==false ? "Activo" : "Inactivo"}</Badge>,
              <div key="a" style={{ display:"flex", gap:4 }}>
                <Btn small onClick={() => { setEditId(a.id); setEditF({cantidad:a.cantidad, nota:a.nota||"", fecha:a.fecha||today, activo:a.activo!==false}); }}>Editar</Btn>
                <Btn small color={C.red} onClick={() => handleBorrar(a.id)}>Borrar</Btn>
              </div>
            ];
          })}
        />
      </Card>
    </div>
  );
}

// ── MÓDULO: CAJA ──────────────────────────────────────────────────────────────
function ModCaja({ soloLectura }) {
  const { data: caja, loading, reload } = useApiData("/api/caja");
  const { data: clientes } = useApiData("/api/clientes");
  const [f, setF] = useState({ cliente_id:"", cuota:"", capital:"", fecha_inicio:"", fecha:today, nota:"" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});
  const s = k => e => setF(x => ({ ...x, [k]:e.target.value }));

  const activos = caja.filter(c => c.activo !== false);
  const totalCapital = activos.reduce((a,c) => a + parseFloat(c.capital||0), 0);
  const totalCuota   = activos.reduce((a,c) => a + parseFloat(c.cuota||0),   0);
  const totalIntereses = activos.reduce((a,c) => a + parseFloat(c.intereses || c.capital*0.04 || 0), 0);

  async function handleAgregar() {
    if (!f.cliente_id) return alert("Selecciona un cliente");
    setSaving(true);
    try { await api("/api/caja", { method:"POST", body:JSON.stringify({ cliente_id:parseInt(f.cliente_id), cuota:parseFloat(f.cuota||0), capital:parseFloat(f.capital||0), fecha_inicio:f.fecha_inicio, fecha:f.fecha, nota:f.nota }) }); setF({ cliente_id:"", cuota:"", capital:"", fecha_inicio:"", fecha:today, nota:"" }); reload(); }
    catch(e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function guardarEdicion(cid) {
    try { await api(`/api/caja/${cid}`, { method:"PATCH", body:JSON.stringify({ ...editF, cuota:parseFloat(editF.cuota||0), capital:parseFloat(editF.capital||0) }) }); setEditId(null); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }

  async function handleBorrar(cid) {
    if (!window.confirm("¿Eliminar este participante de la caja?")) return;
    try { await api(`/api/caja/${cid}`, { method:"DELETE" }); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding:20, color:C.oxford }}>Cargando caja...</p>;
  return (
    <div>
      <SectionTitle>Caja de ahorro</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
        <Card style={{ background:C.navyLight }}><p style={{ margin:0, fontSize:11, color:C.oxford }}>Capital total acumulado</p><p style={{ margin:"2px 0 0", fontSize:22, fontWeight:700, color:C.navy }}>{fmt(totalCapital)}</p></Card>
        <Card style={{ background:C.goldLight }}><p style={{ margin:0, fontSize:11, color:C.oxford }}>Aportación quincenal total</p><p style={{ margin:"2px 0 0", fontSize:22, fontWeight:700, color:"#8B6914" }}>{fmt(totalCuota)}</p></Card>
        <Card style={{ background:C.orangeLight }}><p style={{ margin:0, fontSize:11, color:C.oxford }}>Intereses (4% del capital)</p><p style={{ margin:"2px 0 0", fontSize:22, fontWeight:700, color:C.orange }}>{fmt(totalIntereses)}</p></Card>
      </div>

      {!soloLectura && (
        <Card style={{ marginBottom:16 }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Agregar participante</p>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1.5fr auto", gap:10, alignItems:"end" }}>
            <Sel label="Cliente" value={f.cliente_id} onChange={s("cliente_id")}>
              <option value="">Selecciona cliente</option>
              {clientes.filter(c=>c.activo!==false).map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat}</option>)}
            </Sel>
            <Inp label="Cuota quincenal ($)" type="number" value={f.cuota} onChange={s("cuota")}/>
            <Inp label="Capital ($)" type="number" value={f.capital} onChange={s("capital")}/>
            <Inp label="Inicio" value={f.fecha_inicio} onChange={s("fecha_inicio")} placeholder="15-ene"/>
            <Inp label="Fecha registro" type="date" value={f.fecha} onChange={s("fecha")}/>
            <Inp label="Nota" value={f.nota} onChange={s("nota")} placeholder="Observaciones"/>
            <div style={{ marginBottom:9 }}><Btn onClick={handleAgregar} loading={saving}>Agregar</Btn></div>
          </div>
          {f.capital && <div style={{ background:C.goldLight, borderRadius:8, padding:"7px 10px", fontSize:12 }}>Intereses estimados (4%): <b>{fmt(parseFloat(f.capital)*0.04)}</b></div>}
        </Card>
      )}

      <Card>
        <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.oxford }}>Participantes ({caja.length})</p>
        <Tabla
          headers={["No.","Nombre","Cuota quincenal","Capital","Intereses (4%)","Inicio","Nota","Estado","Acciones"]}
          rows={caja.map((c,i) => {
            const intereses = parseFloat(c.intereses || c.capital*0.04 || 0);
            if (editId === c.id) return [
              i+1,
              <input key="p" value={editF.participante||""} onChange={e=>setEditF(x=>({...x,participante:e.target.value}))} style={{ width:120, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
              <input key="q" type="number" value={editF.cuota||0} onChange={e=>setEditF(x=>({...x,cuota:e.target.value}))} style={{ width:70, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
              <input key="ca" type="number" value={editF.capital||0} onChange={e=>setEditF(x=>({...x,capital:e.target.value}))} style={{ width:80, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
              "—",
              <input key="fi" value={editF.fecha_inicio||""} onChange={e=>setEditF(x=>({...x,fecha_inicio:e.target.value}))} style={{ width:70, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
              <input key="n" value={editF.nota||""} onChange={e=>setEditF(x=>({...x,nota:e.target.value}))} style={{ width:100, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
              "—",
              <Btn key="g" small color={C.green} onClick={() => guardarEdicion(c.id)}>Guardar</Btn>
            ];
            return [
              i+1, c.participante, fmt(c.cuota),
              fmt(c.capital),
              <b key="int" style={{ color:C.orange }}>{fmt(intereses)}</b>,
              c.fecha_inicio||"—", c.nota||"—",
              <Badge key="st" color={c.activo!==false ? C.green : C.red} bg={c.activo!==false ? C.greenLight : C.redLight}>{c.activo!==false ? "Activo" : "Inactivo"}</Badge>,
              soloLectura ? "—" :
              <div key="acc" style={{ display:"flex", gap:4 }}>
                <Btn small onClick={() => { setEditId(c.id); setEditF({...c}); }}>Editar</Btn>
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
  const [f, setF] = useState({ material:"", costo:"", meses_total:"", cuota:"", nota:"", fecha:today });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});
  const s = k => e => setF(x => ({ ...x, [k]:e.target.value }));

  async function handleAbonar(pid) {
    try { await api(`/api/plazos/${pid}/abonar`, { method:"PATCH", body:JSON.stringify({}) }); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }
  async function handleAgregar() {
    if (!f.material || !f.meses_total) return alert("Material y meses requeridos");
    setSaving(true);
    try { await api("/api/plazos", { method:"POST", body:JSON.stringify({ material:f.material, costo:f.costo?parseFloat(f.costo):null, meses_total:parseInt(f.meses_total), cuota:f.cuota?parseFloat(f.cuota):null, abonado:0, nota:f.nota, fecha:f.fecha }) }); setF({ material:"", costo:"", meses_total:"", cuota:"", nota:"", fecha:today }); reload(); }
    catch(e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }
  async function guardarEdicion(pid) {
    try { await api(`/api/plazos/${pid}`, { method:"PATCH", body:JSON.stringify({ ...editF, costo:editF.costo===""?null:parseFloat(editF.costo), meses_total:parseInt(editF.meses_total), meses_pagados:parseInt(editF.meses_pagados), cuota:editF.cuota===""?null:parseFloat(editF.cuota), abonado:parseFloat(editF.abonado||0) }) }); setEditId(null); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }
  async function handleBorrar(pid) {
    if (!window.confirm("¿Eliminar este artículo a plazos?")) return;
    try { await api(`/api/plazos/${pid}`, { method:"DELETE" }); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding:20, color:C.oxford }}>Cargando plazos...</p>;
  return (
    <div>
      <SectionTitle>Pagos a plazos</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2.5fr", gap:16 }}>
        <Card style={{ marginBottom:14, gridColumn:"1 / -1" }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Agregar artículo</p>
          <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 0.8fr 1fr 1fr 1.5fr auto", gap:10, alignItems:"end" }}>
            <Inp label="Material" value={f.material} onChange={s("material")} placeholder="Ej. Refrigerador"/>
            <Inp label="Costo total ($)" type="number" value={f.costo} onChange={s("costo")}/>
            <Inp label="Meses" type="number" value={f.meses_total} onChange={s("meses_total")}/>
            <Inp label="Cuota mensual ($)" type="number" value={f.cuota} onChange={s("cuota")}/>
            <Inp label="Fecha registro" type="date" value={f.fecha} onChange={s("fecha")}/>
            <Inp label="Nota" value={f.nota} onChange={s("nota")} placeholder="Observaciones"/>
            <div style={{ marginBottom:9 }}><Btn onClick={handleAgregar} loading={saving}>Agregar</Btn></div>
          </div>
        </Card>
        <Card style={{ gridColumn:"1 / -1" }}>
          <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.oxford }}>Artículos ({plazos.length})</p>
          <Tabla
            headers={["Material","Costo","Meses","Pagados","Cuota","Abonado","Restante","Nota","Avance","Acciones"]}
            rows={plazos.map(p => {
              if (editId === p.id) return [
                <input key="m" value={editF.material} onChange={e=>setEditF(x=>({...x,material:e.target.value}))} style={{ width:90, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                <input key="c" type="number" value={editF.costo??""} onChange={e=>setEditF(x=>({...x,costo:e.target.value}))} style={{ width:70, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                <input key="mt" type="number" value={editF.meses_total} onChange={e=>setEditF(x=>({...x,meses_total:e.target.value}))} style={{ width:50, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                <input key="mp" type="number" value={editF.meses_pagados} onChange={e=>setEditF(x=>({...x,meses_pagados:e.target.value}))} style={{ width:50, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                <input key="cu" type="number" value={editF.cuota??""} onChange={e=>setEditF(x=>({...x,cuota:e.target.value}))} style={{ width:65, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                <input key="ab" type="number" value={editF.abonado??0} onChange={e=>setEditF(x=>({...x,abonado:e.target.value}))} style={{ width:70, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                "—",
                <input key="n" value={editF.nota||""} onChange={e=>setEditF(x=>({...x,nota:e.target.value}))} style={{ width:90, padding:"4px 6px", border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>,
                "—",
                <Btn key="g" small color={C.green} onClick={() => guardarEdicion(p.id)}>Guardar</Btn>
              ];
              const pend = p.meses_total - p.meses_pagados;
              const rest = (p.costo||0) - (p.abonado||0);
              const pct  = p.meses_total ? Math.round((p.meses_pagados/p.meses_total)*100) : 0;
              return [
                p.material, fmt(p.costo), p.meses_total, p.meses_pagados,
                fmt(p.cuota), fmt(p.abonado), fmt(rest), p.nota||"—",
                <div key="bar" style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ background:C.border, borderRadius:6, height:8, width:60 }}>
                    <div style={{ background: pct>=100 ? C.green : C.orange, width:`${Math.min(pct,100)}%`, height:8, borderRadius:6 }}/>
                  </div>
                  <span style={{ fontSize:10 }}>{pct}%</span>
                </div>,
                <div key="acc" style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {pend > 0 ? <Btn small color={C.green} onClick={() => handleAbonar(p.id)}>+ Abono</Btn>
                             : <Badge color={C.green} bg={C.greenLight}>✓ Liquidado</Badge>}
                  <Btn small onClick={() => { setEditId(p.id); setEditF({...p}); }}>Editar</Btn>
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

// ── MÓDULO: USUARIOS ──────────────────────────────────────────────────────────
function ModUsuarios() {
  const { data: usuarios, loading, reload } = useApiData("/api/usuarios");
  const { data: roles }   = useApiData("/api/roles");
  const { data: clientes } = useApiData("/api/clientes");
  const [f, setF] = useState({ username:"", nombre:"", password:"", rol_id:"", cliente_id:"", correo:"" });
  const [saving, setSaving] = useState(false);
  const s = k => e => setF(x => ({ ...x, [k]:e.target.value }));

  async function handleAgregar() {
    if (!f.username || !f.nombre || !f.password || !f.rol_id) return alert("Todos los campos son requeridos");
    setSaving(true);
    try { await api("/api/usuarios", { method:"POST", body:JSON.stringify({ ...f, rol_id:parseInt(f.rol_id), cliente_id:f.cliente_id?parseInt(f.cliente_id):null }) }); setF({ username:"", nombre:"", password:"", rol_id:"", cliente_id:"", correo:"" }); reload(); }
    catch(e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  }

  async function handleToggleActivo(uid, activo) {
    try { await api(`/api/usuarios/${uid}`, { method:"PATCH", body:JSON.stringify({ activo:!activo }) }); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }

  async function handleBorrar(uid) {
    if (!window.confirm("¿Eliminar este usuario?")) return;
    try { await api(`/api/usuarios/${uid}`, { method:"DELETE" }); reload(); }
    catch(e) { alert("Error: " + e.message); }
  }

  if (loading) return <p style={{ padding:20, color:C.oxford }}>Cargando usuarios...</p>;
  return (
    <div>
      <SectionTitle>Gestión de usuarios</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.6fr", gap:16 }}>
        <Card style={{ marginBottom:14, gridColumn:"1 / -1" }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Nuevo usuario</p>
          <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr 1.5fr 0.8fr 1.5fr auto", gap:10, alignItems:"end" }}>
            <Inp label="Nombre completo"    value={f.nombre}   onChange={s("nombre")}   placeholder="Ej. Juan Pérez"/>
            <Inp label="Usuario (login)"    value={f.username} onChange={s("username")} placeholder="jperez"/>
            <Inp label="Contraseña" type="password" value={f.password} onChange={s("password")} placeholder="••••••••"/>
            <Inp label="Correo electrónico" value={f.correo}   onChange={s("correo")}   placeholder="correo@ejemplo.com"/>
            <Sel label="Rol" value={f.rol_id} onChange={s("rol_id")}>
              <option value="">Rol</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </Sel>
            <Sel label="Cliente vinculado" value={f.cliente_id} onChange={s("cliente_id")}>
              <option value="">— Sin vincular —</option>
              {clientes.filter(c=>c.activo!==false).map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat}</option>)}
            </Sel>
            <div style={{ marginBottom:9 }}><Btn onClick={handleAgregar} loading={saving}>Crear</Btn></div>
          </div>
        </Card>
        <Card style={{ gridColumn:"1 / -1" }}>
          <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.oxford }}>Usuarios del sistema ({usuarios.length})</p>
          <Tabla
            headers={["ID","Nombre","Usuario","Correo","Rol","Cliente vinculado","Estado","Acciones"]}
            rows={usuarios.map(u => [
              u.id, u.nombre, u.username, u.correo||"—",
              <Badge key="r">{u.rol}</Badge>,
              u.cliente_id ? `ID ${u.cliente_id}` : "—",
              <Badge key="e" color={u.activo?C.green:C.red} bg={u.activo?C.greenLight:C.redLight}>{u.activo?"Activo":"Inactivo"}</Badge>,
              <div key="acc" style={{ display:"flex", gap:4 }}>
                <Btn small color={u.activo?C.red:C.green} onClick={() => handleToggleActivo(u.id, u.activo)}>{u.activo?"Desactivar":"Activar"}</Btn>
                <Btn small color={C.red} onClick={() => handleBorrar(u.id)}>Borrar</Btn>
              </div>
            ])}
          />
        </Card>
      </div>
    </div>
  );
}

// ── MÓDULO: MI CUENTA (rol usuario) ──────────────────────────────────────────
function ModMiCuenta({ user }) {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/mis-datos")
      .then(d => { setDatos(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding:20, color:C.oxford }}>Cargando tus datos...</p>;
  if (!datos || !datos.cliente) return <Card><p style={{ color:C.red }}>No hay datos vinculados a tu cuenta. Contacta al administrador.</p></Card>;

  const { cliente, prestamos, ahorro, caja } = datos;
  const activos = prestamos.filter(p => !p.pagado && p.monto > 0);
  const totalDeuda = activos.reduce((a,p) => a + parseFloat(p.monto||0) - parseFloat(p.capital_abonado||0), 0);

  return (
    <div>
      <SectionTitle>Mi cuenta — {cliente.nombre} {cliente.apellido_pat}</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
        <Card style={{ background:C.navyLight }}>
          <p style={{ margin:0, fontSize:11, color:C.oxford }}>Deuda total activa</p>
          <p style={{ margin:"2px 0 0", fontSize:22, fontWeight:700, color:C.navy }}>{fmt(totalDeuda)}</p>
        </Card>
        <Card style={{ background:C.greenLight }}>
          <p style={{ margin:0, fontSize:11, color:C.oxford }}>Mi ahorro</p>
          <p style={{ margin:"2px 0 0", fontSize:22, fontWeight:700, color:C.green }}>{ahorro ? fmt(ahorro.cantidad) : "—"}</p>
        </Card>
        <Card style={{ background:C.orangeLight }}>
          <p style={{ margin:0, fontSize:11, color:C.oxford }}>Participaciones en caja</p>
          <p style={{ margin:"2px 0 0", fontSize:22, fontWeight:700, color:C.orange }}>{caja.length}</p>
        </Card>
      </div>

      <Card style={{ marginBottom:16 }}>
        <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.oxford }}>Mis préstamos activos ({activos.length})</p>
        <Tabla
          headers={["#","Fecha","Monto","Interés mensual","Saldo","Nota"]}
          rows={activos.map(p => {
            const saldo = parseFloat(p.monto||0) - parseFloat(p.capital_abonado||0);
            return [p.id, p.fecha_prestamo, fmt(p.monto), fmt(p.interes_mensual), <b key="s" style={{ color:C.orange }}>{fmt(saldo)}</b>, p.nota||"—"];
          })}
          empty="Sin préstamos activos"
        />
      </Card>

      {caja.length > 0 && <Card>
        <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.oxford }}>Mis registros en caja</p>
        <Tabla
          headers={["#","Cuota quincenal","Capital","Intereses (4%)","Inicio"]}
          rows={caja.map(c => [c.id, fmt(c.cuota), fmt(c.capital), fmt(c.intereses || c.capital*0.04), c.fecha_inicio||"—"])}
        />
      </Card>}
    </div>
  );
}

// ── MÓDULO: CONFIGURACIÓN (solo admin) ───────────────────────────────────────
function ModConfiguracion() {
  const [dias, setDias] = useState("");
  const [loadingDias, setLoadingDias] = useState(true);
  const [savingDias, setSavingDias] = useState(false);
  const [backupFmt, setBackupFmt] = useState("xlsx");
  const [loadingAction, setLoadingAction] = useState("");

  useEffect(() => {
    api("/api/configuracion/dias_anticipacion")
      .then(d => { setDias(d.dias_anticipacion); setLoadingDias(false); })
      .catch(() => setLoadingDias(false));
  }, []);

  async function handleGuardarDias() {
    setSavingDias(true);
    try { await api("/api/configuracion/dias_anticipacion", { method:"PATCH", body:JSON.stringify({ dias_anticipacion:parseInt(dias) }) }); alert("Guardado correctamente."); }
    catch(e) { alert("Error: " + e.message); }
    finally { setSavingDias(false); }
  }

  async function handleAccion(ruta, body, label) {
    setLoadingAction(label);
    try {
      const res = await api(ruta, { method:"POST", body:JSON.stringify(body) });
      alert(`✅ ${label} completado. Enviados: ${res.enviados ?? res.mensaje ?? "OK"}`);
    } catch(e) { alert("Error: " + e.message); }
    finally { setLoadingAction(""); }
  }

  return (
    <div>
      <SectionTitle>Configuración del sistema</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        <Card>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Alertas de cobro</p>
          {loadingDias
            ? <p style={{ fontSize:12, color:C.oxford }}>Cargando...</p>
            : <>
                <Inp label="Días de anticipación para alertas" type="number" value={dias} onChange={e => setDias(e.target.value)}/>
                <Btn color={C.navy} onClick={handleGuardarDias} loading={savingDias}>Guardar</Btn>
                <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                  <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:C.oxford }}>Enviar alertas ahora</p>
                  <Btn color={C.orange} loading={loadingAction==="Alertas"} onClick={() => handleAccion("/api/alertas/enviar-correos", {}, "Alertas")}>
                    Enviar correos de alertas
                  </Btn>
                </div>
              </>}
        </Card>

        <Card>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.oxford }}>Respaldo de base de datos</p>
          <Sel label="Formato del respaldo" value={backupFmt} onChange={e => setBackupFmt(e.target.value)}>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV (múltiples archivos)</option>
            <option value="sql">SQL (INSERT statements)</option>
          </Sel>
          <Btn color={C.navy} loading={loadingAction==="Backup"} onClick={() => handleAccion("/api/backup/enviar", { formato:backupFmt }, "Backup")}>
            Enviar respaldo por correo
          </Btn>

          <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
            <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:C.oxford }}>Informe ejecutivo</p>
            <p style={{ margin:"0 0 8px", fontSize:11, color:C.oxford }}>Envía el resumen completo (cartera, intereses, caja, top deudores) a todos los administradores y analistas.</p>
            <Btn color={C.green} loading={loadingAction==="Informe"} onClick={() => handleAccion("/api/resumen/informe", {}, "Informe")}>
              Enviar informe ejecutivo
            </Btn>
          </div>
        </Card>

      </div>
      <Card style={{ marginTop:16, background:C.goldLight }}>
        <p style={{ margin:0, fontSize:12, fontWeight:700, color:"#8B6914" }}>Cron job diario (Railway)</p>
        <p style={{ margin:"6px 0 0", fontSize:11, color:C.oxford }}>
          Para automatizar el envío diario, configura tres cron jobs en Railway con el header <code>X-Cron-Secret</code> y la variable <code>CRON_SECRET</code>:<br/>
          <code>POST /api/alertas/enviar-correos</code> · <code>POST /api/backup/enviar</code> · <code>POST /api/resumen/informe</code>
        </p>
      </Card>
    </div>
  );
}

// ── ALERTAS BELL ──────────────────────────────────────────────────────────────
function AlertasBell() {
  const { data: alertas, loading } = useApiData("/api/alertas");
  const [open, setOpen] = useState(false);
  if (loading) return null;
  return (
    <div style={{ position:"relative", marginLeft:14 }}>
      <button onClick={() => setOpen(o=>!o)} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:20, position:"relative", padding:4 }}>
        🔔
        {alertas.length > 0 && <span style={{ position:"absolute", top:-2, right:-2, background:C.red, color:C.white, fontSize:10, fontWeight:700, borderRadius:"50%", width:16, height:16, display:"flex", alignItems:"center", justifyContent:"center" }}>{alertas.length}</span>}
      </button>
      {open && (
        <div style={{ position:"absolute", top:36, right:0, background:C.white, border:`1px solid ${C.border}`, borderRadius:10, boxShadow:"0 4px 16px rgba(0,0,0,.2)", width:300, zIndex:1000, padding:12 }}>
          <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.navy }}>Réditos próximos a vencer</p>
          {alertas.length === 0
            ? <p style={{ fontSize:12, color:C.oxford }}>Sin alertas pendientes.</p>
            : alertas.map(a => (
                <div key={a.id} style={{ borderBottom:`1px solid ${C.border}`, padding:"6px 0", fontSize:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontWeight:700, color:C.navy }}>{a.deudor_nombre}</span>
                    <Badge color={a.dias_para_corte===0?C.red:C.orange} bg={a.dias_para_corte===0?C.redLight:C.orangeLight}>
                      {a.dias_para_corte===0?"Hoy":`En ${a.dias_para_corte} día(s)`}
                    </Badge>
                  </div>
                  <div style={{ color:C.oxford, marginTop:2 }}>Interés: {fmt(a.interes_mensual)} · Corte: {a.proximo_corte}</div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

// ── LOGIN ──────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/login`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al iniciar sesión"); return; }
      onLogin(data);
    } catch { setError("No se pudo conectar con el servidor"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:C.lightGray, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Card style={{ width:320 }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16 }}>
          <Logo size={48}/>
          <div style={{ fontSize:20, fontWeight:800, letterSpacing:1.5, color:C.gold, marginTop:8 }}>GONZA</div>
          <div style={{ fontSize:10, color:C.oxford, letterSpacing:1, textTransform:"uppercase" }}>Sistema de administración de pagos</div>
        </div>
        <form onSubmit={handleSubmit}>
          <Inp label="Usuario" value={username} onChange={e=>setUsername(e.target.value)} placeholder="usuario" autoFocus/>
          <Inp label="Contraseña" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/>
          {error && <div style={{ background:C.redLight, color:C.red, fontSize:12, padding:"7px 10px", borderRadius:8, marginBottom:10 }}>{error}</div>}
          <Btn color={C.orange} loading={loading}>Iniciar sesión</Btn>
        </form>
      </Card>
    </div>
  );
}

// ── MENÚ DINÁMICO POR ROL ─────────────────────────────────────────────────────
const MENU_TODOS = [
  { id:"resumen",   label:"Resumen",        icon:"📊", roles:["administrador","analista","consultor"] },
  { id:"clientes",  label:"Clientes",       icon:"👥", roles:["administrador","analista"] },
  { id:"prestamos", label:"Préstamos",      icon:"💼", roles:["administrador","analista","consultor"] },
  { id:"ahorro",    label:"Ahorro",         icon:"🏦", roles:["administrador","analista"] },
  { id:"caja",      label:"Caja",           icon:"💰", roles:["administrador","analista","consultor"] },
  { id:"plazos",    label:"Pagos a plazos", icon:"📅", roles:["administrador","analista"] },
  { id:"cuenta",    label:"Mi cuenta",      icon:"👤", roles:["usuario"] },
  { id:"usuarios",  label:"Usuarios",       icon:"🔐", roles:["administrador"] },
  { id:"config",    label:"Configuración",  icon:"⚙️",  roles:["administrador"] },
];

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App() {
  const [sec, setSec] = useState("resumen");
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("gonza_user");
    return saved ? JSON.parse(saved) : null;
  });

  function handleLogin(userData) { sessionStorage.setItem("gonza_user", JSON.stringify(userData)); setUser(userData); setSec(userData.rol==="usuario" ? "cuenta" : "resumen"); }
  function handleLogout() { sessionStorage.removeItem("gonza_user"); setUser(null); }

  if (!user) return <Login onLogin={handleLogin}/>;

  const menu = MENU_TODOS.filter(m => m.roles.includes(user.rol));
  const soloLectura = user.rol === "consultor";

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:C.lightGray, minHeight:"100vh" }}>
      {/* TOPBAR */}
      <div style={{ background:C.navy, padding:"0 20px", display:"flex", alignItems:"center", gap:14, height:56, boxShadow:"0 2px 6px rgba(0,0,0,.3)" }}>
        <Logo size={36}/>
        <div>
          <div style={{ fontSize:16, fontWeight:800, letterSpacing:1.5, color:C.gold }}>GONZA</div>
          <div style={{ fontSize:9, color:"#8fa8c8", letterSpacing:1, textTransform:"uppercase" }}>Sistema de administración de pagos</div>
        </div>
        <div style={{ flex:1 }}/>
        <div style={{ textAlign:"right", marginRight:14 }}>
          <div style={{ fontSize:12, color:C.white, fontWeight:700 }}>{user.nombre}</div>
          <div style={{ fontSize:10, color:C.gold, textTransform:"uppercase" }}>{user.rol}</div>
        </div>
        {["administrador","analista"].includes(user.rol) && <AlertasBell/>}
        <Btn small color={C.orange} onClick={handleLogout}>Salir</Btn>
        <div style={{ fontSize:11, color:"#8fa8c8", marginLeft:14 }}>
          {new Date().toLocaleDateString("es-MX", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
        </div>
      </div>

      {/* NAVMENU */}
      <nav style={{ background:C.oxford, display:"flex", flexWrap:"wrap", boxShadow:"0 2px 4px rgba(0,0,0,.2)" }}>
        {menu.map(m => {
          const active = sec === m.id;
          return (
            <button key={m.id} onClick={() => setSec(m.id)} style={{
              display:"flex", alignItems:"center", gap:7, padding:"11px 18px",
              background: active ? C.navy : "transparent", border:"none",
              borderBottom: active ? `3px solid ${C.gold}` : "3px solid transparent",
              color: active ? C.gold : "#b0bcd4", fontSize:13, fontWeight: active ? 700 : 400, cursor:"pointer",
            }}>
              <span style={{ fontSize:15 }}>{m.icon}</span>{m.label}
            </button>
          );
        })}
      </nav>

      {/* CONTENIDO */}
      <main style={{ padding:"20px 22px", minHeight:"calc(100vh - 100px)" }}>
        {sec==="resumen"   && <ModResumen irA={setSec}/>}
        {sec==="clientes"  && <ModClientes/>}
        {sec==="prestamos" && <ModPrestamos soloLectura={soloLectura}/>}
        {sec==="ahorro"    && <ModAhorro/>}
        {sec==="caja"      && <ModCaja soloLectura={soloLectura}/>}
        {sec==="plazos"    && <ModPagosPlazos/>}
        {sec==="cuenta"    && <ModMiCuenta user={user}/>}
        {sec==="usuarios"  && <ModUsuarios/>}
        {sec==="config"    && <ModConfiguracion/>}
      </main>
    </div>
  );
}
