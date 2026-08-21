import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import toast, { Toaster } from "react-hot-toast";

import { C, API_BASE, TEMAS, temaGuardado, aplicarTema, hex, fmt, fmtFecha, today, calcularInteresMensual, calcularCuotaMensual } from "./theme";
import { api, useApiData, usePaginacion, ConfirmProvider, useConfirm, descargarArchivo } from "./api";
import { Logo, LogoLogin, Card, SectionTitle, Badge, Inp, Sel, Btn, Tabla, Kpi, Kpis, Modal, Cargando } from "./components/ui";

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
    if (mi <= 0 && mc <= 0) return toast.error("Ingresa al menos un monto mayor a 0");
    setSaving(true);
    try {
      await api(`/api/prestamos/${prestamo.id}/abono`, {
        method: "POST",
        body: JSON.stringify({ monto_interes: mi, monto_capital: mc, fecha_pago: fechaPago, nota }),
      });
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal titulo={`Abono — ${prestamo.deudor_nombre}`} onClose={onClose}
      acciones={<>
        <Btn color={C.orange} onClick={handleGuardar} loading={saving}>Registrar abono</Btn>
        <Btn color={C.oxford} onClick={onClose}>Cerrar</Btn>
      </>}>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: C.oxford }}>
        Préstamo: <b>{fmt(prestamo.monto)}</b> · Abonado: <b>{fmt(prestamo.capital_abonado || 0)}</b> · Saldo: <b style={{ color: C.orange }}>{fmt(saldoRestante)}</b>
      </p>
      <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Inp label="Fecha del abono" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}/>
        <Inp label="Abono al interés ($)" type="number" value={montoInteres} onChange={e => setMontoInteres(e.target.value)}/>
        <Inp label="Abono al capital ($)" type="number" value={montoCapital} onChange={e => setMontoCapital(e.target.value)}/>
        <Inp label="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} placeholder="Observaciones"/>
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Historial de abonos</p>
      {loadingHist ? <Cargando/>
        : <Tabla headers={["Fecha", "Interés", "Capital", "Nota"]}
            rows={historial.map(h => [fmtFecha(h.fecha_pago), fmt(h.monto_interes), fmt(h.monto_capital), h.nota || "—"])}
            empty="Sin abonos registrados"/>}
    </Modal>
  );
}

// ── MODAL: EDITAR PRÉSTAMO (datos generales) ──────────────────────────────────
function ModalEditarPrestamo({ prestamo, onClose, onSaved }) {
  const [fecha, setFecha] = useState(prestamo.fecha_prestamo ? prestamo.fecha_prestamo.toString().substring(0,10) : today);
  const [monto, setMonto] = useState(prestamo.monto ?? "");
  const [interes, setInteres] = useState(prestamo.interes_mensual ?? "");
  const [nota, setNota] = useState(prestamo.nota || "");
  const [saving, setSaving] = useState(false);

  async function handleGuardar() {
    setSaving(true);
    try {
      await api(`/api/prestamos/${prestamo.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fecha_prestamo: fecha,
          monto: parseFloat(monto || 0),
          interes_mensual: parseFloat(interes || 0),
          nota,
        }),
      });
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal titulo={`Editar préstamo — ${prestamo.deudor_nombre}`} sub="Modifica los datos generales del préstamo" onClose={onClose}
      acciones={<>
        <Btn color={C.green} onClick={handleGuardar} loading={saving}>Guardar cambios</Btn>
        <Btn color={C.oxford} onClick={onClose}>Cancelar</Btn>
      </>}>
      <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Inp label="Fecha del préstamo" type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
        <Inp label="Monto ($)" type="number" value={monto} onChange={e => setMonto(e.target.value)}/>
        <Inp label="Interés mensual ($)" type="number" value={interes} onChange={e => setInteres(e.target.value)}/>
        <Inp label="Nota" value={nota} onChange={e => setNota(e.target.value)} placeholder="Observaciones"/>
      </div>
    </Modal>
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

  const fmtPeriodo = p => {
    if (!p) return "—";
    const [y, m] = p.toString().substring(0, 10).split("-");
    const meses = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${meses[parseInt(m)]} ${y}`;
  };

  async function handlePagar() {
    if (!corteSeleccionado) return toast.error("Selecciona un mes para pagar");
    const mp = parseFloat(montoPagado || corteSeleccionado.monto_interes);
    if (mp <= 0) return toast.error("Ingresa un monto válido");
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
    } catch (e) { toast.error(e.message); }
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
    } catch (e) { toast.error(e.message); }
  }

  return (
    <Modal titulo={`📅 Intereses mensuales — ${prestamo.deudor_nombre}`} onClose={onClose}>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: C.oxford }}>Monto: <b>{fmt(prestamo.monto)}</b> · Interés mensual: <b>{fmt(prestamo.interes_mensual)}</b></p>

      <Kpis>
        <Kpi etiqueta="Interés pendiente" valor={fmt(totalPendiente)} nota={`${pendientes.length} mes(es)`} tono="red"/>
        <Kpi etiqueta="Interés cobrado" valor={fmt(totalCobrado)} nota={`${pagados.length} mes(es)`} tono="green"/>
        <Kpi etiqueta="Total cortes" valor={cortes.length} nota="meses desde el préstamo" tono="yellow"/>
      </Kpis>

      {corteSeleccionado && (
          <div style={{ background: C.lightGray, borderRadius: 2, padding: "12px 14px", marginBottom: 14, border: `1px solid ${C.gold}` }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: C.navy }}>
              Registrar pago — {fmtPeriodo(corteSeleccionado.periodo)}
              <span style={{ marginLeft: 8, color: C.oxford, fontWeight: 400 }}>Esperado: {fmt(corteSeleccionado.monto_interes)}</span>
            </p>
            <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
              <Inp label="Fecha de pago" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}/>
              <Inp label="Monto pagado ($)" type="number" value={montoPagado}
                placeholder={String(corteSeleccionado.monto_interes)}
                onChange={e => setMontoPagado(e.target.value)}/>
              <div style={{ marginBottom: 9 }}>
                <label style={{ display: "block", fontSize: 12, color: C.oxford, marginBottom: 3, fontWeight: 600 }}>Tipo de pago</label>
                <select value={tipoPago} onChange={e => setTipoPago(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, color: C.navy, background: C.lightGray }}>
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

        {loading ? <Cargando/> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: C.headerBg }}>
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
    </Modal>
  );
}

// ── MODAL: REFINANCIACIÓN / REESTRUCTURACIÓN DE PRÉSTAMOS ────────────────────
function ModalRefinanciar({ clientes, prestamos, resumenIntereses, onClose, onSaved }) {
  const [clienteId, setClienteId] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [fecha, setFecha] = useState(today);
  const [interes, setInteres] = useState("");
  const [incluirIntereses, setIncluirIntereses] = useState(true);
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  const prestamosCliente = prestamos.filter(p => !p.pagado && String(p.cliente_id) === String(clienteId));
  const saldoDe = p => parseFloat(p.monto || 0) - parseFloat(p.capital_abonado || 0);
  const interesPendienteDe = p => {
    const r = resumenIntereses.find(x => x.prestamo_id === p.id);
    return r ? parseFloat(r.total_interes_pendiente || 0) : 0;
  };

  function toggle(id) {
    setSeleccionados(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  const totalSaldo = seleccionados.reduce((a, id) => {
    const p = prestamosCliente.find(x => x.id === id);
    return a + (p ? saldoDe(p) : 0);
  }, 0);
  const totalInteresPendiente = incluirIntereses ? seleccionados.reduce((a, id) => {
    const p = prestamosCliente.find(x => x.id === id);
    return a + (p ? interesPendienteDe(p) : 0);
  }, 0) : 0;
  const nuevoMonto = totalSaldo + totalInteresPendiente;

  async function handleGuardar() {
    if (!clienteId) return toast.error("Selecciona un cliente");
    if (seleccionados.length === 0) return toast.error("Selecciona al menos un préstamo a refinanciar");
    if (nuevoMonto <= 0) return toast.error("El monto a refinanciar debe ser mayor a 0");
    setSaving(true);
    try {
      const res = await api("/api/prestamos/refinanciar", {
        method: "POST",
        body: JSON.stringify({
          cliente_id: parseInt(clienteId),
          prestamo_ids: seleccionados,
          fecha_prestamo: fecha,
          interes_mensual: parseFloat(interes || 0),
          incluir_intereses_pendientes: incluirIntereses,
          nota,
        }),
      });
      toast.success(`Nuevo préstamo #${res.id} por ${fmt(res.monto)}`);
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal titulo="🔄 Refinanciar préstamos" sub="Consolida uno o varios préstamos activos de un mismo cliente en un préstamo nuevo" onClose={onClose}
      acciones={<>
        <Btn color={C.orange} onClick={handleGuardar} loading={saving}>Refinanciar</Btn>
        <Btn color={C.oxford} onClick={onClose}>Cancelar</Btn>
      </>}>
      <Sel label="Cliente" value={clienteId} onChange={e => { setClienteId(e.target.value); setSeleccionados([]); }}>
        <option value="">Selecciona un cliente</option>
        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat} {c.apellido_mat || ""}</option>)}
      </Sel>

      {clienteId && (
        prestamosCliente.length === 0
          ? <p style={{ fontSize: 12, color: C.oxford, margin: "10px 0" }}>Este cliente no tiene préstamos activos.</p>
          : <div style={{ margin: "10px 0" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.oxford, margin: "0 0 6px" }}>Selecciona los préstamos a consolidar</p>
              {prestamosCliente.map(p => (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                  <input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => toggle(p.id)}/>
                  <span>#{p.id} · {fmtFecha(p.fecha_prestamo)} · Saldo: <b>{fmt(saldoDe(p))}</b> · Interés pendiente: <b>{fmt(interesPendienteDe(p))}</b></span>
                </label>
              ))}
            </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, margin: "6px 0 14px" }}>
        <input type="checkbox" checked={incluirIntereses} onChange={e => setIncluirIntereses(e.target.checked)}/>
        Capitalizar el interés pendiente de los préstamos seleccionados en el nuevo capital
      </label>

      <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10 }}>
        <Inp label="Fecha del nuevo préstamo" type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
        <Inp label="Interés mensual ($)" type="number" value={interes} onChange={e => setInteres(e.target.value)}
          placeholder={nuevoMonto > 0 ? String(calcularInteresMensual(nuevoMonto)) : ""}/>
        <Inp label="Nota" value={nota} onChange={e => setNota(e.target.value)} placeholder="Motivo de la refinanciación"/>
      </div>

      {seleccionados.length > 0 && (
        <div style={{ background: C.goldLight, borderRadius: 2, padding: "10px 12px", marginTop: 10 }}>
          <p style={{ margin: 0, fontSize: 12 }}>Saldo de capital seleccionado: <b>{fmt(totalSaldo)}</b></p>
          {incluirIntereses && <p style={{ margin: "4px 0 0", fontSize: 12 }}>+ Interés pendiente capitalizado: <b>{fmt(totalInteresPendiente)}</b></p>}
          <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: C.navy }}>Monto del préstamo nuevo: {fmt(nuevoMonto)}</p>
        </div>
      )}
    </Modal>
  );
}

function ModPrestamos() {
  const { data: prestamos, loading, reload } = useApiData("/api/prestamos");
  const { data: clientes } = useApiData("/api/clientes");
  const { data: resumenIntereses, reload: reloadIntereses } = useApiData("/api/intereses-pendientes");
  const [f, setF] = useState({ cliente_id: "", fecha_prestamo: today, monto: "", nota: "" });
  const [saving, setSaving] = useState(false);
  const [abonoPrestamo, setAbonoPrestamo] = useState(null);
  const [editarPrestamo, setEditarPrestamo] = useState(null);
  const [cortesPrestamoModal, setCortesPrestamoModal] = useState(null);
  const [ordenFecha, setOrdenFecha] = useState("asc");
  const [busqueda, setBusqueda] = useState("");
  const [verPagados, setVerPagados] = useState(false);
  const [refinanciarAbierto, setRefinanciarAbierto] = useState(false);
  const [descargandoCartera, setDescargandoCartera] = useState(false);
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  const activos = prestamos.filter(p => !p.pagado && p.monto > 0);
  const pagados = prestamos.filter(p => p.pagado);
  const totalCartera = activos.reduce((a, p) => a + (parseFloat(p.monto || 0) - parseFloat(p.capital_abonado || 0)), 0);
  const totalInteresesEsperados = activos.filter(p => parseFloat(p.interes_mensual||0) > 0)
    .reduce((a, p) => a + calcularInteresMensual(parseFloat(p.monto || 0) - parseFloat(p.capital_abonado || 0)), 0);
  const totalInteresesNoCobrados = resumenIntereses
    .reduce((a, r) => a + parseFloat(r.total_interes_pendiente || 0), 0);

  // Mapa: prestamo_id → cortes pendientes (para badge)
  const pendientesPorPrestamo = {};
  resumenIntereses.forEach(r => { if (r.cortes_pendientes > 0) pendientesPorPrestamo[r.prestamo_id] = r.cortes_pendientes; });

  const activosFiltrados = [...activos]
    .filter(p => !busqueda || p.deudor_nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => {
      const diff = new Date(a.fecha_prestamo) - new Date(b.fecha_prestamo);
      return ordenFecha === "asc" ? diff : -diff;
    });

  const { itemsPagina: activosPagina, Paginador: PaginadorActivos } = usePaginacion(activosFiltrados, 15);
  const { itemsPagina: pagadosPagina, Paginador: PaginadorPagados } = usePaginacion(pagados, 15);

  async function handleAgregar() {
    if (!f.cliente_id || !f.monto) return toast.error("Cliente y monto requeridos");
    setSaving(true);
    try {
      await api("/api/prestamos", {
        method: "POST",
        body: JSON.stringify({
          cliente_id: parseInt(f.cliente_id),
          fecha_prestamo: f.fecha_prestamo,
          nota: f.nota,
          monto: parseFloat(f.monto),
          interes_mensual: calcularInteresMensual(f.monto),
        }),
      });
      setF({ cliente_id: "", fecha_prestamo: today, monto: "", nota: "" });
      reload();
    } catch (e) { toast.error(e.message); }
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
    } catch (e) { toast.error(e.message); }
  }

  async function handleDescargarCarteraVencida() {
    setDescargandoCartera(true);
    try {
      await descargarArchivo("/api/reportes/cartera-vencida/xlsx", `cartera_vencida_${today}.xlsx`);
    } catch (e) { toast.error(e.message); }
    finally { setDescargandoCartera(false); }
  }

  async function handleDescargarPagare(p) {
    try {
      const user = sessionStorage.getItem("gonza_user");
      const token = user ? JSON.parse(user).token : "";
      const res = await fetch(`${API_BASE}/api/prestamos/${p.id}/pagare`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("No se pudo generar el pagaré");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pagare_${p.deudor_nombre.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { toast.error(e.message); }
  }

  if (loading) return <Cargando texto="Cargando préstamos..."/>;

  return (
    <div>
      <SectionTitle>Préstamos</SectionTitle>

      <Kpis>
        <Kpi etiqueta="Cartera activa" valor={fmt(totalCartera)} tono="blue"/>
        <Kpi etiqueta="Interés esperado / mes" valor={fmt(totalInteresesEsperados)} nota="suma de tasas pactadas" tono="yellow"/>
        <Kpi etiqueta="Intereses no cobrados" valor={fmt(totalInteresesNoCobrados)} nota="acumulado histórico pendiente" tono="red"/>
        <Kpi etiqueta="Préstamos pagados" valor={pagados.length} tono="green"/>
      </Kpis>

      {/* Formulario horizontal */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Registrar préstamo</p>
        <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
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
        {f.monto && <div style={{ background: C.goldLight, borderRadius: 2, padding: "7px 10px", fontSize: 12, marginTop: -4 }}>
          Interés (10%): <b>{fmt(calcularInteresMensual(f.monto))}</b> / mes
        </div>}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.oxford }}>
            Préstamos activos ({activosFiltrados.length}{busqueda ? ` de ${activos.length}` : ""})
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 160px", maxWidth: 220 }}>
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 13 }}>🔍</span>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar deudor..."
                style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 6, paddingBottom: 6, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 12, color: C.navy, background: C.lightGray, width: "100%" }}/>
              {busqueda && <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: C.oxford }}>✕</button>}
            </div>
            <button onClick={() => setOrdenFecha(o => o === "asc" ? "desc" : "asc")}
              style={{ display: "flex", alignItems: "center", gap: 5, background: C.navyLight, border: `1px solid ${C.border}`, borderRadius: 2, padding: "6px 12px", fontSize: 11, color: C.navy, fontWeight: 700, cursor: "pointer" }}>
              📅 {ordenFecha === "asc" ? "↑ Más antiguo" : "↓ Más reciente"}
            </button>
            <Btn small color="#6B46C1" onClick={() => setRefinanciarAbierto(true)}>🔄 Refinanciar</Btn>
            <Btn small color={C.green} onClick={handleDescargarCarteraVencida} loading={descargandoCartera}>📊 Cartera vencida</Btn>
          </div>
        </div>
        <Tabla
          headers={["#", "Deudor", "Fecha", "Monto", "Interés/mes (10% saldo)", "Capital abonado", "Saldo", "Estado interés", "Nota", "Acciones"]}
          rows={activosPagina.map(p => {
            const saldo = parseFloat(p.monto || 0) - parseFloat(p.capital_abonado || 0);
            const interesSobreSaldo = calcularInteresMensual(saldo);
            const mesesPendientes = pendientesPorPrestamo[p.id] || 0;
            return [
              p.id, p.deudor_nombre,
              fmtFecha(p.fecha_prestamo),
              fmt(p.monto), fmt(interesSobreSaldo), fmt(p.capital_abonado || 0),
              <b key={`s${p.id}`} style={{ color: saldo <= 0 ? C.green : C.orange }}>{fmt(saldo)}</b>,
              mesesPendientes > 0
                ? <Badge key={`ip${p.id}`} color={C.red} bg={C.redLight}>⚠ {mesesPendientes} mes(es) pendiente{mesesPendientes > 1 ? "s" : ""}</Badge>
                : parseFloat(p.interes_mensual||0) > 0
                  ? <Badge key={`io${p.id}`} color={C.green} bg={C.greenLight}>✓ Al día</Badge>
                  : <Badge key={`in${p.id}`} color={C.oxford} bg={C.lightGray}>Sin interés</Badge>,
              p.nota || "—",
              <div key={`acc${p.id}`} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Btn small color="#6B46C1" onClick={() => setCortesPrestamoModal(p)}>📅 Intereses</Btn>
                <Btn small color={C.orange} onClick={() => setAbonoPrestamo(p)}>$ Abonar</Btn>
                <Btn small color={C.green} onClick={() => handlePagar(p.id)}>✓ Liquidar</Btn>
                <Btn small onClick={() => setEditarPrestamo(p)}>✎ Editar</Btn>
                <Btn small color={C.oxford} onClick={() => handleDescargarPagare(p)}>📄 Pagaré</Btn>
              </div>
            ];
          })}
        />
        <PaginadorActivos/>
        <div className="grid-resp" style={{ borderTop: `2px solid ${C.border}`, marginTop: 8, paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.oxford }}>TOTALES GRUPO</div>
          <div style={{ fontSize: 12 }}>Capital: <span style={{ fontWeight: 700, color: C.navy }}>{fmt(totalCartera)}</span></div>
          <div style={{ fontSize: 12 }}>Con interés: <span style={{ fontWeight: 700, color: C.green }}>{fmt(totalCartera + totalInteresesEsperados)}</span></div>
        </div>
      </Card>

      {pagados.length > 0 && <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: verPagados ? 6 : 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.oxford }}>Pagados ({pagados.length})</p>
          <Btn small onClick={() => setVerPagados(v => !v)}>{verPagados ? "Ocultar" : "Ver pagados"}</Btn>
        </div>
        {verPagados && (
          <>
            <Tabla
              headers={["#", "Deudor", "Fecha préstamo", "Monto", "Fecha pago", "Nota"]}
              rows={pagadosPagina.map(p => [p.id, p.deudor_nombre, fmtFecha(p.fecha_prestamo), fmt(p.monto), fmtFecha(p.fecha_pago), p.nota || "—"])}
            />
            <PaginadorPagados/>
          </>
        )}
      </Card>}

      {abonoPrestamo && (
        <ModalAbono prestamo={abonoPrestamo} onClose={() => setAbonoPrestamo(null)} onSaved={() => { setAbonoPrestamo(null); reload(); }}/>
      )}
      {cortesPrestamoModal && (
        <ModalCortesInteres prestamo={cortesPrestamoModal} onClose={() => { setCortesPrestamoModal(null); reload(); reloadIntereses(); }}/>
      )}
      {editarPrestamo && (
        <ModalEditarPrestamo prestamo={editarPrestamo} onClose={() => setEditarPrestamo(null)} onSaved={() => { setEditarPrestamo(null); reload(); }}/>
      )}
      {refinanciarAbierto && (
        <ModalRefinanciar clientes={clientes} prestamos={prestamos} resumenIntereses={resumenIntereses}
          onClose={() => setRefinanciarAbierto(false)}
          onSaved={() => { setRefinanciarAbierto(false); reload(); reloadIntereses(); }}/>
      )}
    </div>
  );
}

// ── MÓDULO: CLIENTES — formulario HORIZONTAL ──────────────────────────────────
function ModalHistorialCliente({ clienteId, onClose }) {
  const { data, loading } = useApiData(`/api/clientes/${clienteId}/historial-completo`);

  return (
    <Modal titulo="📋 Historial completo del cliente" onClose={onClose}>
      {loading && <Cargando/>}

      {!loading && data.cliente && (
        <>
          <div style={{ background: C.navyLight, borderRadius: 2, padding: "10px 14px", marginBottom: 14 }}>
            <p style={{ margin: 0, fontWeight: 700, color: C.navy }}>{data.cliente.nombre} {data.cliente.apellido_pat} {data.cliente.apellido_mat}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: C.oxford }}>{data.cliente.telefono || "sin teléfono"} · {data.cliente.direccion || "sin dirección"}</p>
          </div>

          <Kpis>
            <Kpi etiqueta="Prestado activo" valor={fmt(data.totales.prestado_activo)} tono="blue"/>
            <Kpi etiqueta="Ahorrado" valor={fmt(data.totales.ahorrado)} tono="green"/>
            <Kpi etiqueta="En caja" valor={fmt(data.totales.en_caja)} tono="orange"/>
          </Kpis>

          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Préstamos ({data.prestamos.length})</p>
          <Tabla headers={["Fecha", "Monto", "Interés", "Estado"]}
            rows={data.prestamos.map(p => [p.fecha_prestamo, fmt(p.monto), fmt(p.interes_mensual), <Badge key={p.id}>{p.pagado ? "Pagado" : "Activo"}</Badge>])}/>

          <p style={{ margin: "16px 0 6px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Ahorros ({data.ahorros.length})</p>
          <Tabla headers={["Fecha", "Cantidad", "Nota"]}
            rows={data.ahorros.map(a => [a.fecha, fmt(a.cantidad), a.nota || "—"])}/>

          <p style={{ margin: "16px 0 6px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Caja de ahorro ({data.caja.length})</p>
          <Tabla headers={["Fecha", "Capital acumulado", "Nota"]}
            rows={data.caja.map(c => [c.fecha, fmt(c.capital), c.nota || "—"])}/>
        </>
      )}
    </Modal>
  );
}

function ModClientes() {
  const { data: clientes, loading, reload } = useApiData("/api/clientes");
  const { itemsPagina, Paginador } = usePaginacion(clientes, 15);
  const [f, setF] = useState({ nombre: "", apellido_pat: "", apellido_mat: "", telefono: "", direccion: "" });
  const [saving, setSaving] = useState(false);
  const [verHistorial, setVerHistorial] = useState(null);
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  async function handleAgregar() {
    if (!f.nombre) return toast.error("Nombre requerido");
    setSaving(true);
    try {
      await api("/api/clientes", { method: "POST", body: JSON.stringify(f) });
      setF({ nombre: "", apellido_pat: "", apellido_mat: "", telefono: "", direccion: "" });
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Cargando texto="Cargando clientes..."/>;

  return (
    <div>
      <SectionTitle>Clientes</SectionTitle>
      {/* Formulario HORIZONTAL en una sola Card */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Registrar cliente</p>
        <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
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
          headers={["ID", "Apellido paterno", "Apellido materno", "Nombre", "Teléfono", "Estado", ""]}
          rows={itemsPagina.map(c => [c.id, c.apellido_pat, c.apellido_mat, c.nombre, c.telefono || "—",
            <Badge key={c.id}>{c.activo ? "Activo" : "Inactivo"}</Badge>,
            <Btn key={"h" + c.id} small color={C.oxford} onClick={() => setVerHistorial(c.id)}>Ver historial</Btn>])}
        />
        <Paginador/>
      </Card>
      {verHistorial && <ModalHistorialCliente clienteId={verHistorial} onClose={() => setVerHistorial(null)}/>}
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
    if (!f.cliente_id) return toast.error("Selecciona un cliente");
    setSaving(true);
    try {
      await api("/api/ahorros", {
        method: "POST",
        body: JSON.stringify({ cliente_id: parseInt(f.cliente_id), cantidad: parseFloat(f.cantidad || 0) }),
      });
      setF({ cliente_id: "", cantidad: "" });
      reload(); reloadCSA();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function guardarEdicion(aid) {
    try {
      await api(`/api/ahorros/${aid}`, { method: "PATCH", body: JSON.stringify({ cantidad: parseFloat(editValor || 0) }) });
      setEditId(null); reload();
    } catch (e) { toast.error(e.message); }
  }

  if (loading) return <Cargando texto="Cargando ahorros..."/>;
  return (
    <div>
      <SectionTitle>Ahorro</SectionTitle>
      <Kpis>
        <Kpi etiqueta="Total en ahorros del grupo" valor={fmt(total)} tono="blue"/>
      </Kpis>
      {clientesSinAhorro.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Dar de alta ahorro</p>
          <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "end" }}>
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
                  style={{ width: 90, padding: "4px 6px", background: C.campo, color: C.navy, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 12 }}/>
              : fmt(a.cantidad),
            editId === a.id
              ? <Btn key={`g${a.id}`} small color={C.green} onClick={() => guardarEdicion(a.id)}>Guardar</Btn>
              : <Btn key={`e${a.id}`} small onClick={() => { setEditId(a.id); setEditValor(a.cantidad); }}>Editar</Btn>
          ])}
        />
        <div className="grid-resp" style={{ borderTop: `2px solid ${C.border}`, marginTop: 8, paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.oxford }}>TOTALES GRUPO</div>
          <div style={{ fontSize: 12 }}>Ahorrado: <span style={{ fontWeight: 700, color: C.navy }}>{fmt(total)}</span></div>
          <div style={{ fontSize: 12 }}>Integrantes: <span style={{ fontWeight: 700, color: C.green }}>{ahorros.length}</span></div>
        </div>
      </Card>
    </div>
  );
}

// ── MÓDULO: CAJA — con movimientos quincenales ────────────────────────────────
function ModalMovimientosCaja({ participante, onClose }) {
  const confirm = useConfirm();
  const { data: movimientos, loading, reload } = useApiData(`/api/caja/${participante.id}/movimientos`);
  const [fecha, setFecha] = useState(today);
  const [monto, setMonto] = useState(participante.cuota || "");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});

  const totalAportado = movimientos.reduce((a, m) => a + parseFloat(m.monto || 0), 0);
  const interes = totalAportado * 0.0833;
  const totalConInteres = totalAportado + interes;

  async function handleRegistrar() {
    if (!monto || parseFloat(monto) <= 0) return toast.error("Ingresa un monto válido");
    setSaving(true);
    try {
      await api(`/api/caja/${participante.id}/movimientos`, {
        method: "POST",
        body: JSON.stringify({ fecha, monto: parseFloat(monto), nota }),
      });
      setNota(""); reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function guardarEdicionMov(mid) {
    try {
      await api(`/api/caja/${participante.id}/movimientos/${mid}`, {
        method: "PATCH",
        body: JSON.stringify({ fecha: editF.fecha, monto: parseFloat(editF.monto || 0), nota: editF.nota }),
      });
      setEditId(null); reload();
    } catch (e) { toast.error(e.message); }
  }

  async function handleBorrarMov(mid) {
    if (!(await confirm("¿Eliminar esta aportación? El capital se recalculará automáticamente."))) return;
    try {
      await api(`/api/caja/${participante.id}/movimientos/${mid}`, { method: "DELETE" });
      reload();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <Modal titulo={participante.participante} sub={`Cuota quincenal: ${fmt(participante.cuota)}`} onClose={onClose}>
        <Kpis>
          <Kpi etiqueta="Total aportado" valor={fmt(totalAportado)} tono="blue"/>
          <Kpi etiqueta="Interés (8.33% anual)" valor={fmt(interes)} tono="yellow"/>
          <Kpi etiqueta="Total a entregar" valor={fmt(totalConInteres)} tono="green"/>
        </Kpis>
        <div style={{ background: C.lightGray, borderRadius: 2, padding: "12px 14px", marginBottom: 14 }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Registrar aportación quincenal</p>
          <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: 8, alignItems: "end" }}>
            <Inp label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
            <Inp label="Monto ($)" type="number" value={monto} onChange={e => setMonto(e.target.value)}/>
            <Inp label="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej. pago adelantado"/>
            <div style={{ marginBottom: 9 }}><Btn color={C.orange} onClick={handleRegistrar} loading={saving}>+ Agregar</Btn></div>
          </div>
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: C.oxford }}>Historial ({movimientos.length} registros)</p>
        {loading ? <Cargando/>
          : <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: C.headerBg }}>
                  {["#","Fecha","Monto","Acumulado","Nota","Acciones"].map((h,i) => <th key={i} style={{ color: C.gold, padding: "6px 8px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {movimientos.length === 0
                    ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 16, color: C.oxford }}>Sin aportaciones registradas</td></tr>
                    : movimientos.map((m, i) => {
                      if (editId === m.id) {
                        return (
                          <tr key={i} style={{ background: C.goldLight }}>
                            <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{i+1}</td>
                            <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>
                              <input type="date" value={editF.fecha} onChange={e => setEditF(x=>({...x,fecha:e.target.value}))} style={{width:120,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>
                            </td>
                            <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>
                              <input type="number" value={editF.monto} onChange={e => setEditF(x=>({...x,monto:e.target.value}))} style={{width:80,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>
                            </td>
                            <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, color: C.oxford }}>—</td>
                            <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>
                              <input value={editF.nota} onChange={e => setEditF(x=>({...x,nota:e.target.value}))} style={{width:110,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>
                            </td>
                            <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <Btn small color={C.green} onClick={() => guardarEdicionMov(m.id)}>Guardar</Btn>
                                <Btn small color={C.oxford} onClick={() => setEditId(null)}>Cancelar</Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                      <tr key={i} style={{ background: i % 2 === 0 ? C.cardBg : C.rowAlt }}>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{i+1}</td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{fmtFecha(m.fecha)}</td>
                        <td style={{ padding: "5px 8px", color: C.navy, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{fmt(m.monto)}</td>
                        <td style={{ padding: "5px 8px", color: C.green, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{fmt(m.acumulado)}</td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{m.nota || "—"}</td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <Btn small onClick={() => { setEditId(m.id); setEditF({ fecha: m.fecha?.substring(0,10) || today, monto: m.monto, nota: m.nota || "" }); }}>✎</Btn>
                            <Btn small color={C.red} onClick={() => handleBorrarMov(m.id)}>🗑</Btn>
                          </div>
                        </td>
                      </tr>);
                    })
                  }
                </tbody>
                {movimientos.length > 0 && (
                  <tfoot><tr style={{ background: C.navyLight }}>
                    <td colSpan={2} style={{ padding: "7px 8px", fontWeight: 700, color: C.navy, fontSize: 12 }}>TOTAL APORTADO</td>
                    <td colSpan={4} style={{ padding: "7px 8px", fontWeight: 700, color: C.navy, fontSize: 13 }}>{fmt(totalAportado)}</td>
                  </tr></tfoot>
                )}
              </table>
            </div>
        }
    </Modal>
  );
}

function ModCaja() {
  const confirm = useConfirm();
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
  const interesProyectado = totalCapital * 0.0833;

  async function handleAgregar() {
    if (!f.cliente_id) return toast.error("Selecciona un cliente");
    setSaving(true);
    try {
      await api("/api/caja", {
        method: "POST",
        body: JSON.stringify({ cliente_id: parseInt(f.cliente_id), cuota: parseFloat(f.cuota || 0), capital: parseFloat(f.capital || 0), fecha_inicio: f.fecha_inicio }),
      });
      setF({ cliente_id: "", cuota: "", capital: "", fecha_inicio: "" });
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function guardarEdicion(cid) {
    try {
      await api(`/api/caja/${cid}`, {
        method: "PATCH",
        body: JSON.stringify({ participante: editF.participante, cuota: parseFloat(editF.cuota || 0), capital: parseFloat(editF.capital || 0), fecha_inicio: editF.fecha_inicio }),
      });
      setEditId(null); reload();
    } catch (e) { toast.error(e.message); }
  }

  async function handleBorrar(cid) {
    if (!(await confirm("¿Eliminar este participante de la caja?"))) return;
    try { await api(`/api/caja/${cid}`, { method: "DELETE" }); reload(); }
    catch (e) { toast.error(e.message); }
  }

  if (loading) return <Cargando texto="Cargando caja..."/>;

  return (
    <div>
      <SectionTitle>Caja de ahorro</SectionTitle>
      <Kpis>
        <Kpi etiqueta="Capital total acumulado" valor={fmt(totalCapital)} tono="blue"/>
        <Kpi etiqueta="Aportación quincenal total" valor={fmt(totalCuota)} tono="yellow"/>
        <Kpi etiqueta="Interés anual proyectado (8.33%)" valor={fmt(interesProyectado)} tono="green"/>
      </Kpis>

      {/* Formulario HORIZONTAL */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Agregar participante</p>
        <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <Sel label="Cliente" value={f.cliente_id} onChange={s("cliente_id")}>
            <option value="">Selecciona un cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido_pat} {c.apellido_mat || ""}</option>)}
          </Sel>
          <Inp label="Cuota quincenal ($)" type="number" value={f.cuota} onChange={s("cuota")}/>
          <Inp label="Capital inicial ($)" type="number" value={f.capital} onChange={s("capital")}/>
          <Inp label="Fecha de inicio" value={f.fecha_inicio} onChange={s("fecha_inicio")} placeholder="15-ene"/>
          <div style={{ marginBottom: 9 }}><Btn onClick={handleAgregar} loading={saving}>Agregar</Btn></div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.oxford }}>Participantes ({caja.length})</p>
          <div style={{ background: C.navyLight, borderRadius: 2, padding: "5px 12px", fontSize: 11, color: C.navy, fontWeight: 600 }}>
            📋 Clic en "Movimientos" para registrar aportaciones quincenales
          </div>
        </div>
        <Tabla
          headers={["No.", "Nombre", "Cuota quincenal", "Capital acumulado", "Interés (8.33%)", "Total estimado", "Inicio", "Acciones"]}
          rows={caja.map((c, i) => {
            const interes = parseFloat(c.capital || 0) * 0.0833;
            const totalEstimado = parseFloat(c.capital || 0) + interes;
            if (editId === c.id) {
              return [
                i+1,
                <input key={`p${c.id}`} value={editF.participante} onChange={e => setEditF(x=>({...x,participante:e.target.value}))} style={{width:120,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>,
                <input key={`q${c.id}`} type="number" value={editF.cuota} onChange={e => setEditF(x=>({...x,cuota:e.target.value}))} style={{width:80,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>,
                <span key={`ca${c.id}`} style={{ fontSize: 11, color: C.oxford }}>{fmt(c.capital)} 🔒</span>,
                "—","—",
                <input key={`f${c.id}`} value={editF.fecha_inicio} onChange={e => setEditF(x=>({...x,fecha_inicio:e.target.value}))} style={{width:70,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>,
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
        <div className="grid-resp" style={{ borderTop: `2px solid ${C.border}`, marginTop: 8, paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
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
  const confirm = useConfirm();
  const { data: plazos, loading, reload } = useApiData("/api/plazos");
  const [f, setF] = useState({ material: "", costo: "", meses_total: "", cuota: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});

  // Calcula cuota automáticamente al cambiar costo o meses
  function handleCostoChange(e) {
    const costo = e.target.value;
    const cuotaAuto = calcularCuotaMensual(costo, f.meses_total);
    setF(x => ({ ...x, costo, cuota: cuotaAuto }));
  }
  function handleMesesChange(e) {
    const meses = e.target.value;
    const cuotaAuto = calcularCuotaMensual(f.costo, meses);
    setF(x => ({ ...x, meses_total: meses, cuota: cuotaAuto }));
  }
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  async function handleAbonar(pid) {
    try { await api(`/api/plazos/${pid}/abonar`, { method: "PATCH", body: JSON.stringify({}) }); reload(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleAgregar() {
    if (!f.material || !f.meses_total) return toast.error("Material y meses son requeridos");
    setSaving(true);
    try {
      await api("/api/plazos", {
        method: "POST",
        body: JSON.stringify({ material: f.material, costo: f.costo ? parseFloat(f.costo) : null, meses_total: parseInt(f.meses_total), meses_pagados: 0, cuota: f.cuota ? parseFloat(f.cuota) : null, abonado: 0 }),
      });
      setF({ material: "", costo: "", meses_total: "", cuota: "" }); reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function guardarEdicion(pid) {
    try {
      await api(`/api/plazos/${pid}`, {
        method: "PATCH",
        body: JSON.stringify({ material: editF.material, costo: editF.costo===""?null:parseFloat(editF.costo), meses_total: parseInt(editF.meses_total), meses_pagados: parseInt(editF.meses_pagados), cuota: editF.cuota===""?null:parseFloat(editF.cuota), abonado: parseFloat(editF.abonado||0) }),
      });
      setEditId(null); reload();
    } catch (e) { toast.error(e.message); }
  }

  async function handleBorrar(pid) {
    if (!(await confirm("¿Eliminar este artículo?"))) return;
    try { await api(`/api/plazos/${pid}`, { method: "DELETE" }); reload(); }
    catch (e) { toast.error(e.message); }
  }

  if (loading) return <Cargando texto="Cargando plazos..."/>;

  const totalCosto = plazos.reduce((a, p) => a + parseFloat(p.costo || 0), 0);
  const totalAbonado = plazos.reduce((a, p) => a + parseFloat(p.abonado || 0), 0);
  const totalRestante = totalCosto - totalAbonado;

  return (
    <div>
      <SectionTitle>Pagos a plazos</SectionTitle>
      {/* Formulario HORIZONTAL */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Agregar artículo</p>
        <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <Inp label="Material / Artículo" value={f.material} onChange={s("material")} placeholder="Ej. Refrigerador"/>
          <Inp label="Costo total ($)" type="number" value={f.costo} onChange={handleCostoChange}/>
          <Inp label="Meses totales" type="number" value={f.meses_total} onChange={handleMesesChange}/>
          <div style={{ marginBottom: 9 }}>
            <label style={{ display: "block", fontSize: 12, color: C.oxford, marginBottom: 3, fontWeight: 600 }}>Cuota mensual ($)</label>
            <input type="number" value={f.cuota} onChange={s("cuota")}
              style={{ width: "100%", padding: "7px 10px", border: `2px solid ${C.gold}`, borderRadius: 2, fontSize: 13, color: C.navy, background: C.goldLight, boxSizing: "border-box", fontWeight: 700 }}/>
          </div>
          <div style={{ marginBottom: 9 }}><Btn onClick={handleAgregar} loading={saving}>Agregar</Btn></div>
        </div>
        {f.costo && f.meses_total && (
          <div style={{ background: C.goldLight, borderRadius: 2, padding: "7px 10px", fontSize: 12, marginTop: -4 }}>
            Cuota calculada: <b>{fmt(parseFloat(f.costo) / parseInt(f.meses_total))}</b> / mes
          </div>
        )}
      </Card>
      <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <Card>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Artículos ({plazos.length})</p>
          <Tabla
            headers={["Material","Costo","Meses","Pagados","Pendientes","Cuota","Abonado","Restante","Avance","Acciones"]}
            rows={plazos.map(p => {
              if (editId === p.id) {
                return [
                  <input key={`m${p.id}`} value={editF.material} onChange={e=>setEditF(x=>({...x,material:e.target.value}))} style={{width:100,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>,
                  <input key={`c${p.id}`} type="number" value={editF.costo} onChange={e=>setEditF(x=>({...x,costo:e.target.value}))} style={{width:80,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>,
                  <input key={`mt${p.id}`} type="number" value={editF.meses_total} onChange={e=>setEditF(x=>({...x,meses_total:e.target.value}))} style={{width:55,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>,
                  <input key={`mp${p.id}`} type="number" value={editF.meses_pagados} onChange={e=>setEditF(x=>({...x,meses_pagados:e.target.value}))} style={{width:55,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>,
                  "—",
                  <input key={`cu${p.id}`} type="number" value={editF.cuota} onChange={e=>setEditF(x=>({...x,cuota:e.target.value}))} style={{width:70,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>,
                  <input key={`ab${p.id}`} type="number" value={editF.abonado} onChange={e=>setEditF(x=>({...x,abonado:e.target.value}))} style={{width:80,padding:"4px 6px",background:C.campo,color:C.navy,border:`1px solid ${C.border}`,borderRadius:2,fontSize:12}}/>,
                  "—","—",
                  <Btn key={`g${p.id}`} small color={C.green} onClick={() => guardarEdicion(p.id)}>Guardar</Btn>
                ];
              }
              const pend = p.meses_total - p.meses_pagados;
              // Restante = cuota × meses pendientes: lo que falta por pagar según las
              // cuotas que quedan. Antes era costo - abonado (dinero), que no cuadraba
              // con "Pagados"/"Pendientes"/"Avance" (ya basados en meses, no en dinero)
              // y podía quedar desfasado si "Abonado" no se actualizaba junto con "Pagados".
              const rest = (parseFloat(p.cuota) || 0) * pend;
              // El avance se calcula sobre los MESES pagados (meses_pagados/meses_total),
              // que es el campo que en realidad se edita en esta pantalla ("Pagados").
              // Antes se calculaba sobre el dinero (abonado/costo) y por eso, al editar
              // solo "Pagados" sin tocar "Abonado", la barra se quedaba congelada aunque
              // "Pendientes" sí cambiara. meses_total es obligatorio al crear el artículo,
              // así que solo se cae al cálculo por dinero si por algún motivo viniera en 0.
              const pct = p.meses_total > 0
                ? Math.round((parseFloat(p.meses_pagados || 0) / parseFloat(p.meses_total)) * 100)
                : (p.costo > 0 ? Math.round((parseFloat(p.abonado || 0) / parseFloat(p.costo)) * 100) : 0);
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
          <div className="grid-resp" style={{ borderTop: `2px solid ${C.border}`, marginTop: 8, paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.oxford }}>TOTALES GRUPO</div>
            <div style={{ fontSize: 12 }}>Costo total: <span style={{ fontWeight: 700, color: C.navy }}>{fmt(totalCosto)}</span></div>
            <div style={{ fontSize: 12 }}>Abonado: <span style={{ fontWeight: 700, color: C.green }}>{fmt(totalAbonado)}</span> · Restante: <span style={{ fontWeight: 700, color: C.orange }}>{fmt(totalRestante)}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── MODAL: INFORME POR DEUDOR ─────────────────────────────────────────────────
function ModalInformeDeudor({ clienteId, onClose }) {
  const { data, loading, error } = useApiData(`/api/clientes/${clienteId}/informe-deudor`);
  const [descargando, setDescargando] = useState(false);
  const [descargandoXlsx, setDescargandoXlsx] = useState(false);

  async function handleDescargarExcel() {
    setDescargandoXlsx(true);
    try {
      await descargarArchivo(`/api/clientes/${clienteId}/informe-deudor/xlsx`, `estado_cuenta_${(data?.deudor || "deudor").replace(/\s+/g, "_")}.xlsx`);
    } catch (e) { toast.error(e.message); }
    finally { setDescargandoXlsx(false); }
  }

  async function handleDescargarPDF() {
    setDescargando(true);
    try {
      const user = sessionStorage.getItem("gonza_user");
      const token = user ? JSON.parse(user).token : "";
      const res = await fetch(`${API_BASE}/api/clientes/${clienteId}/informe-deudor/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("No se pudo generar el PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe_${(data?.deudor || "deudor").replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { toast.error(e.message); }
    finally { setDescargando(false); }
  }

  const fmtPeriodo = p => {
    if (!p) return "—";
    const [y, m] = p.toString().substring(0, 10).split("-");
    const meses = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${meses[parseInt(m)]} ${y}`;
  };

  return (
    <Modal titulo="📋 Informe de deudor" sub={data?.deudor} onClose={onClose}
      acciones={<>
        <Btn small color={C.green} onClick={handleDescargarExcel} loading={descargandoXlsx}>📊 Descargar Excel</Btn>
        <Btn small color={C.orange} onClick={handleDescargarPDF} loading={descargando}>📄 Descargar PDF</Btn>
      </>}>
        {loading && <Cargando texto="Cargando informe..."/>}
        {error && <p style={{ color: C.red }}>Error: {error}</p>}
        {data && data.resumen && (
          <>
            <Kpis>
              <Kpi etiqueta="Capital prestado activo" valor={fmt(data.resumen.total_prestado)} tono="blue"/>
              <Kpi etiqueta="Interés pendiente acumulado" valor={fmt(data.resumen.interes_pendiente_acumulado)} tono="red"/>
              <Kpi etiqueta="Interés cobrado total" valor={fmt(data.resumen.interes_cobrado_total)} tono="green"/>
            </Kpis>

            {/* Préstamos */}
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: C.oxford }}>
              Préstamos ({data.prestamos.length})
            </p>
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: C.headerBg }}>
                  {["Fecha","Monto","Interés/mes","Saldo","Estado","Nota"].map((h,i) =>
                    <th key={i} style={{ color: C.gold, padding: "6px 8px", textAlign: "left" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {data.prestamos.map((p, i) => {
                    const saldo = parseFloat(p.monto||0) - parseFloat(p.capital_abonado||0);
                    return (
                      <tr key={p.id} style={{ background: i%2===0 ? C.cardBg : C.rowAlt }}>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{fmtFecha(p.fecha_prestamo)}</td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{fmt(p.monto)}</td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{fmt(calcularInteresMensual(saldo))}</td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, color: saldo > 0 ? C.orange : C.green }}>{fmt(saldo)}</td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>
                          {p.pagado
                            ? <Badge color={C.green} bg={C.greenLight}>✓ Pagado</Badge>
                            : <Badge color={C.orange} bg={C.orangeLight}>Activo</Badge>}
                        </td>
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{p.nota || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cortes de interés */}
            {data.cortes.length > 0 && (
              <>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: C.oxford }}>
                  Historial de intereses ({data.cortes.length} cortes)
                </p>
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ background: C.headerBg }}>
                      {["Mes","Interés","Estado","Pagado","Fecha pago"].map((h,i) =>
                        <th key={i} style={{ color: C.gold, padding: "6px 8px", textAlign: "left" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.cortes.slice(0, 24).map((c, i) => (
                        <tr key={i} style={{ background: c.pagado ? C.greenLight : (i%2===0 ? C.cardBg : C.rowAlt) }}>
                          <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{fmtPeriodo(c.periodo)}</td>
                          <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{fmt(c.monto_interes)}</td>
                          <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>
                            {c.pagado
                              ? <Badge color={C.green} bg={C.greenLight}>✓ Cobrado</Badge>
                              : <Badge color={C.red} bg={C.redLight}>⚠ Pendiente</Badge>}
                          </td>
                          <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}`, color: C.green }}>{c.monto_pagado > 0 ? fmt(c.monto_pagado) : "—"}</td>
                          <td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border}` }}>{fmtFecha(c.fecha_pago)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
    </Modal>
  );
}

// ── MÓDULO: RESUMEN ───────────────────────────────────────────────────────────
function ModResumen({ irA }) {
  const { data: prestamos, loading: lp } = useApiData("/api/prestamos");
  const { data: ahorros,   loading: la } = useApiData("/api/ahorros");
  const { data: caja,      loading: lc } = useApiData("/api/caja");
  const { data: resumenIntereses }       = useApiData("/api/intereses-pendientes");
  const { data: cartera, loading: lcart }= useApiData("/api/dashboard/cartera");
  const { data: flujoMensual }           = useApiData("/api/dashboard/flujo-mensual");
  const [deudorModal, setDeudorModal] = useState(null);

  if (lp || la || lc || lcart) return <Cargando texto="Cargando resumen..."/>;

  const activos = prestamos.filter(p => !p.pagado && p.monto > 0);
  const totalCartera        = activos.reduce((a, p) => a + (parseFloat(p.monto || 0) - parseFloat(p.capital_abonado || 0)), 0);
  const totalInteresEsperado= activos.filter(p => parseFloat(p.interes_mensual||0) > 0)
                                .reduce((a, p) => a + calcularInteresMensual(parseFloat(p.monto || 0) - parseFloat(p.capital_abonado || 0)), 0);
  const totalInteresNoCobrado = resumenIntereses.reduce((a, r) => a + parseFloat(r.total_interes_pendiente || 0), 0);
  const totalAhorros        = ahorros.reduce((a, x) => a + parseFloat(x.cantidad || 0), 0);
  const totalCaja           = caja.reduce((a, c) => a + parseFloat(c.capital || 0), 0);
  const interesAnualCaja    = totalCaja * 0.0833;

  // Top deudores por capital activo. Se agrupa por cliente_id (no por
  // deudor_nombre): ese campo es una foto del nombre al crear cada préstamo,
  // así que si el cliente se editó entre un préstamo y otro, dos préstamos
  // del mismo deudor podían tener cadenas distintas y agruparse por separado.
  const porDeudor = {};
  activos.forEach(p => {
    const acc = porDeudor[p.cliente_id] || { nombre: p.deudor_nombre, total: 0 };
    acc.total += parseFloat(p.monto);
    porDeudor[p.cliente_id] = acc;
  });
  const topDeudores = Object.entries(porDeudor)
    .map(([clienteId, v]) => [Number(clienteId), v.nombre, v.total])
    .sort((a, b) => b[2] - a[2])
    .slice(0, 5);

  // Datos para gráfica de distribución (pie)
  const datosDistribucion = [
    { name: "Cartera activa", value: totalCartera,  color: hex(C.navy) },
    { name: "Ahorros grupo",  value: totalAhorros,  color: hex(C.green) },
    { name: "Caja de ahorro", value: totalCaja,     color: hex(C.orange) },
  ].filter(d => d.value > 0);

  // Datos para gráfica de intereses (donut)
  const datosIntereses = [
    { name: "Cobrado", value: resumenIntereses.reduce((a,r) => a + parseFloat(r.total_interes_cobrado||0), 0), color: hex(C.green) },
    { name: "Pendiente", value: totalInteresNoCobrado, color: hex(C.red) },
  ].filter(d => d.value > 0);

  // Datos para gráfica de cartera: vencida vs próxima a vencer vs al día
  const datosCartera = [
    { name: "Vencida", value: cartera.resumen.vencidos.monto, color: hex(C.red) },
    { name: "Próxima a vencer", value: cartera.resumen.proximos.monto, color: hex(C.orange) },
    { name: "Al día", value: cartera.resumen.al_dia.monto, color: hex(C.green) },
  ].filter(d => d.value > 0);

  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.05) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>{`${(percent*100).toFixed(0)}%`}</text>;
  };

  return (
    <div>
      <SectionTitle>Resumen ejecutivo — GONZA</SectionTitle>

      <Kpis>
        <Kpi etiqueta="Cartera activa prestada" valor={fmt(totalCartera)} tono="blue" onClick={() => irA("prestamos")}/>
        <Kpi etiqueta="Interés esperado / mes" valor={fmt(totalInteresEsperado)} nota="suma de tasas pactadas" tono="yellow" onClick={() => irA("prestamos")}/>
        <Kpi etiqueta="Intereses no cobrados (total)" valor={fmt(totalInteresNoCobrado)} nota="acumulado histórico pendiente" tono="red" onClick={() => irA("prestamos")}/>
        <Kpi etiqueta="Ahorro total del grupo" valor={fmt(totalAhorros)} tono="green" onClick={() => irA("ahorro")}/>
        <Kpi etiqueta="Capital caja de ahorro" valor={fmt(totalCaja)} tono="orange" onClick={() => irA("caja")}/>
        <Kpi etiqueta="Interés anual proyectado (8.33%)" valor={fmt(interesAnualCaja)} nota="sobre el capital de caja" tono="green" onClick={() => irA("caja")}/>
      </Kpis>

      {/* Gráficas */}
      <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Distribución del capital — Pie con etiquetas internas */}
        <Card>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Distribución del capital del grupo</p>
          <p style={{ margin: "0 0 8px", fontSize: 10, color: C.oxford }}>Cartera activa vs Ahorros vs Caja</p>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={datosDistribucion} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={90} labelLine={false} label={renderLabel}>
                {datosDistribucion.map((d, i) => <Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip formatter={v => fmt(v)}/>
              <Legend formatter={(v, e) => `${v}: ${fmt(e.payload.value)}`}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Intereses: cobrados vs pendientes — Donut */}
        <Card>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Estado de intereses</p>
          <p style={{ margin: "0 0 8px", fontSize: 10, color: C.oxford }}>Cobrado vs pendiente acumulado histórico</p>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={datosIntereses} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={55} outerRadius={90} labelLine={false} label={renderLabel}>
                {datosIntereses.map((d, i) => <Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip formatter={v => fmt(v)}/>
              <Legend formatter={(v, e) => `${v}: ${fmt(e.payload.value)}`}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", marginTop: -8 }}>
            <span style={{ fontSize: 11, color: C.oxford }}>Total intereses: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
              {fmt(datosIntereses.reduce((a,d) => a + d.value, 0))}
            </span>
          </div>
        </Card>

        {/* Cartera: vencida vs próxima a vencer vs al día */}
        <Card>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Salud de la cartera</p>
          <p style={{ margin: "0 0 8px", fontSize: 10, color: C.oxford }}>Por monto prestado activo</p>
          {datosCartera.length === 0
            ? <p style={{ textAlign: "center", color: C.oxford, fontSize: 12, padding: "40px 0" }}>Sin préstamos activos</p>
            : <>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={datosCartera} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={55} outerRadius={90} labelLine={false} label={renderLabel}>
                    {datosCartera.map((d, i) => <Cell key={i} fill={d.color}/>)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)}/>
                  <Legend formatter={(v, e) => `${v}: ${fmt(e.payload.value)}`}/>
                </PieChart>
              </ResponsiveContainer>
              {cartera.resumen.vencidos.cantidad > 0 && (
                <div style={{ textAlign: "center", marginTop: -8 }}>
                  <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>
                    ⚠️ {cartera.resumen.vencidos.cantidad} préstamo(s) vencido(s)
                  </span>
                </div>
              )}
            </>
          }
        </Card>
      </div>

      {/* Flujo de caja, ranking de deudores e indicadores: mismo grid de 3
          columnas que las gráficas de arriba, para que todo el tablero se
          vea parejo en vez de una barra enorme a lo ancho seguida de 2 columnas. */}
      <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Flujo de caja mensual: interés + capital cobrado, últimos 6 meses */}
        {flujoMensual && flujoMensual.length > 0 && (
          <Card>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Flujo de caja mensual</p>
            <p style={{ margin: "0 0 8px", fontSize: 10, color: C.oxford }}>Interés y capital cobrado, últimos 6 meses</p>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={flujoMensual.map(m => ({
                mes: (() => { const [y, mo] = m.mes.split("-"); const meses=["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]; return `${meses[parseInt(mo)]} ${y.slice(2)}`; })(),
                "Interés cobrado": parseFloat(m.interes_cobrado || 0),
                "Capital cobrado": parseFloat(m.capital_cobrado || 0),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={hex(C.border)}/>
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: C.oxford }}/>
                <YAxis tick={{ fontSize: 10, fill: C.oxford }} width={38}/>
                <Tooltip formatter={v => fmt(v)}/>
                <Legend wrapperStyle={{ fontSize: 11 }}/>
                <Bar dataKey="Interés cobrado" fill={hex(C.gold)} radius={[4,4,0,0]}/>
                <Bar dataKey="Capital cobrado" fill={hex(C.navy)} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Ranking de deudores</p>
          <p style={{ margin: "0 0 12px", fontSize: 10, color: C.oxford }}>Haz clic en un nombre para ver su informe individual</p>
          {topDeudores.map(([clienteId, nombre, monto], i) => {
            const maxM = topDeudores[0][2] || 1;
            // Interés pendiente de este deudor
            const pendiente = resumenIntereses
              .filter(r => r.cliente_id === clienteId)
              .reduce((a, r) => a + parseFloat(r.total_interes_pendiente || 0), 0);
            return (
              <div key={clienteId} style={{ marginBottom: 12, cursor: "pointer", borderRadius: 2, padding: "8px 10px", background: C.lightGray, border: `1px solid ${C.border}` }}
                onClick={() => setDeudorModal(clienteId)}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: C.navy }}>{i+1}. {nombre}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: C.navy }}>{fmt(monto)}</span>
                    {pendiente > 0 && <Badge color={C.red} bg={C.redLight}>⚠ {fmt(pendiente)}</Badge>}
                  </div>
                </div>
                <div style={{ background: C.border, borderRadius: 2, height: 8 }}>
                  <div style={{ background: i===0 ? C.orange : C.headerBg, width: `${(monto/maxM)*100}%`, height: 8, borderRadius: 2, transition: "width .3s" }}/>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 10, color: C.oxford }}>👆 Clic para ver informe completo</p>
              </div>
            );
          })}
        </Card>

        <Card onClick={() => irA("prestamos")} style={{ cursor: "pointer" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Indicadores generales</p>
          {[
            ["Préstamos activos",         activos.length,                            C.orange],
            ["Préstamos pagados",         prestamos.filter(p => p.pagado).length,   C.green],
            ["Participantes caja ahorro", caja.length,                              C.navy],
            ["Socios con ahorro",         ahorros.length,                           C.navy],
            ["Interés esperado / mes",    fmt(totalInteresEsperado),                "#8B6914"],
            ["Intereses no cobrados",     fmt(totalInteresNoCobrado),               C.red],
            ["Capital total del grupo",   fmt(totalCartera + totalAhorros + totalCaja), C.navy],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, padding: "6px 0", fontSize: 12 }}>
              <span style={{ color: C.oxford }}>{l}</span>
              <span style={{ fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>

      {deudorModal && (
        <ModalInformeDeudor clienteId={deudorModal} onClose={() => setDeudorModal(null)}/>
      )}
    </div>
  );
}

// ── MÓDULO: USUARIOS — formulario HORIZONTAL ──────────────────────────────────
function ModUsuarios() {
  const { data: usuarios, loading, reload } = useApiData("/api/usuarios");
  const { data: roles } = useApiData("/api/roles");
  const [f, setF] = useState({ username: "", nombre: "", password: "", rol_id: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});
  const s = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  async function handleAgregar() {
    if (!f.username || !f.nombre || !f.password || !f.rol_id) return toast.error("Todos los campos son requeridos");
    setSaving(true);
    try {
      await api("/api/usuarios", { method: "POST", body: JSON.stringify({ ...f, rol_id: parseInt(f.rol_id) }) });
      setF({ username: "", nombre: "", password: "", rol_id: "" }); reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleToggleActivo(uid, activo) {
    try { await api(`/api/usuarios/${uid}`, { method: "PATCH", body: JSON.stringify({ activo: !activo }) }); reload(); }
    catch (e) { toast.error(e.message); }
  }

  function iniciarEdicion(u) {
    setEditId(u.id);
    setEditF({ correo: u.correo || "", rol_id: u.rol_id });
  }

  async function guardarEdicion(uid) {
    try {
      await api(`/api/usuarios/${uid}`, {
        method: "PATCH",
        body: JSON.stringify({ correo: editF.correo, rol_id: parseInt(editF.rol_id) }),
      });
      setEditId(null); reload();
    } catch (e) { toast.error(e.message); }
  }

  if (loading) return <Cargando texto="Cargando usuarios..."/>;

  return (
    <div>
      <SectionTitle>Gestión de usuarios</SectionTitle>
      {/* Formulario HORIZONTAL en una Card completa */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.oxford }}>Nuevo usuario</p>
        <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr 1fr auto", gap: 10, alignItems: "end" }}>
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
          headers={["ID", "Nombre", "Usuario", "Correo", "Rol", "Estado", "Acción"]}
          rows={usuarios.map(u => {
            if (editId === u.id) {
              return [
                u.id, u.nombre, u.username,
                <input key={`co${u.id}`} type="email" value={editF.correo} onChange={e => setEditF(x => ({ ...x, correo: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  style={{ width: 150, padding: "4px 6px", background: C.campo, color: C.navy, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 12 }}/>,
                <select key={`ro${u.id}`} value={editF.rol_id} onChange={e => setEditF(x => ({ ...x, rol_id: e.target.value }))}
                  style={{ padding: "4px 6px", background: C.campo, color: C.navy, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 12 }}>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>,
                <Badge key={`e${u.id}`} color={u.activo?C.green:C.red} bg={u.activo?C.greenLight:C.redLight}>{u.activo?"Activo":"Inactivo"}</Badge>,
                <div key={`acc${u.id}`} style={{ display: "flex", gap: 4 }}>
                  <Btn small color={C.green} onClick={() => guardarEdicion(u.id)}>Guardar</Btn>
                  <Btn small color={C.oxford} onClick={() => setEditId(null)}>Cancelar</Btn>
                </div>
              ];
            }
            return [
              u.id, u.nombre, u.username,
              u.correo || <span style={{ color: C.oxford, fontStyle: "italic" }}>sin correo</span>,
              <Badge key={`r${u.id}`}>{u.rol}</Badge>,
              <Badge key={`e${u.id}`} color={u.activo?C.green:C.red} bg={u.activo?C.greenLight:C.redLight}>{u.activo?"Activo":"Inactivo"}</Badge>,
              <div key={`acc${u.id}`} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Btn small onClick={() => iniciarEdicion(u)}>Editar</Btn>
                <Btn small color={u.activo?C.red:C.green} onClick={()=>handleToggleActivo(u.id,u.activo)}>
                  {u.activo?"Desactivar":"Activar"}
                </Btn>
              </div>
            ];
          })}
        />
      </Card>
    </div>
  );
}

// ── MÓDULO: CONFIGURACIÓN ─────────────────────────────────────────────────────
const UNA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

// ── SEGURIDAD: VERIFICACIÓN EN DOS PASOS (TOTP) ──────────────────────────────
function Config2FA() {
  const { data: estado, loading, reload } = useApiData("/api/2fa/estado");
  const [qr, setQr] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [generando, setGenerando] = useState(false);
  const [activando, setActivando] = useState(false);
  const [mostrarDesactivar, setMostrarDesactivar] = useState(false);
  const [password, setPassword] = useState("");
  const [desactivando, setDesactivando] = useState(false);

  async function handleGenerar() {
    setGenerando(true);
    try { setQr(await api("/api/2fa/generar", { method: "POST" })); }
    catch (e) { toast.error(e.message); }
    finally { setGenerando(false); }
  }

  async function handleActivar() {
    if (codigo.length !== 6) return toast.error("Ingresa el código de 6 dígitos de tu app de autenticación");
    setActivando(true);
    try {
      await api("/api/2fa/activar", { method: "POST", body: JSON.stringify({ codigo }) });
      toast.success("Verificación en dos pasos activada");
      setQr(null); setCodigo("");
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setActivando(false); }
  }

  async function handleDesactivar() {
    if (!password) return toast.error("Ingresa tu contraseña actual");
    setDesactivando(true);
    try {
      await api("/api/2fa/desactivar", { method: "POST", body: JSON.stringify({ password }) });
      toast.success("Verificación en dos pasos desactivada");
      setMostrarDesactivar(false); setPassword("");
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setDesactivando(false); }
  }

  if (loading) return null;

  return (
    <Card style={{ padding: 13 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.navy }}>🔒 Verificación en dos pasos</p>
      <p style={{ margin: "0 0 10px", fontSize: 11, color: C.oxford, lineHeight: 1.5 }}>
        Protege tu cuenta de administrador con un código adicional generado por una app como Google Authenticator o Authy.
      </p>

      {estado.habilitado ? (
        <>
          <Badge color={C.green} bg={C.greenLight}>✓ Activa</Badge>
          {!mostrarDesactivar
            ? <div style={{ marginTop: 10 }}><Btn small color={C.red} onClick={() => setMostrarDesactivar(true)}>Desactivar</Btn></div>
            : (
              <div style={{ marginTop: 10 }}>
                <Inp label="Confirma tu contraseña para desactivar" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn small color={C.red} onClick={handleDesactivar} loading={desactivando}>Confirmar</Btn>
                  <Btn small color={C.oxford} onClick={() => { setMostrarDesactivar(false); setPassword(""); }}>Cancelar</Btn>
                </div>
              </div>
            )}
        </>
      ) : !qr ? (
        <Btn small color={C.navy} onClick={handleGenerar} loading={generando}>Activar verificación en dos pasos</Btn>
      ) : (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: C.oxford }}>
            Escanea este código con tu app de autenticación, o ingresa la clave manualmente:
          </p>
          <img src={qr.qr} alt="Código QR para 2FA" style={{ width: 160, height: 160, display: "block", margin: "0 auto 8px" }}/>
          <p style={{ textAlign: "center", fontFamily: "monospace", fontSize: 12, color: C.navy, marginBottom: 10, wordBreak: "break-all" }}>{qr.secreto}</p>
          <Inp label="Código de 6 dígitos" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456"/>
          <Btn small color={C.green} onClick={handleActivar} loading={activando}>Confirmar y activar</Btn>
        </div>
      )}
    </Card>
  );
}

function ModConfiguracion({ rol, verClientes, setVerClientes, verUsuarios, setVerUsuarios }) {
  const confirm = useConfirm();
  const [dias, setDias] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCorreo, setSavingCorreo] = useState(false);
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);
  const [msg, setMsg] = useState("");
  const [formatoBackup, setFormatoBackup] = useState("xlsx");
  const [exportando, setExportando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const { data: historial, error: errorHistorial, reload: reloadHistorial } = useApiData("/api/historial-accesos");
  // Solo interesan los accesos más recientes; el backend ya manda como
  // máximo 200 ordenados del más nuevo al más viejo, aquí nos quedamos
  // solo con los últimos 20 (sin paginador: no hay más que ver).
  const historialReciente = historial.slice(0, 20);

  // El historial de accesos se refresca solo una vez por semana mientras la
  // pantalla siga abierta (no hace falta más seguido: es un registro de
  // auditoría, no algo que cambie minuto a minuto).
  useEffect(() => {
    if (rol !== "administrador") return;
    const timer = setInterval(reloadHistorial, UNA_SEMANA_MS);
    return () => clearInterval(timer);
  }, [rol, reloadHistorial]);

  useEffect(() => {
    api("/api/configuracion/dias_anticipacion")
      .then(d => { setDias(d.dias_anticipacion); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleGuardar() {
    const v = parseInt(dias);
    if (isNaN(v) || v < 0) return toast.error("Ingresa un número válido de días");
    setSaving(true);
    try {
      await api("/api/configuracion/dias_anticipacion", {
        method: "PATCH",
        body: JSON.stringify({ dias_anticipacion: v }),
      });
      setMsg("✅ Configuración guardada correctamente");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  // Envía UN SOLO correo con las 3 secciones: alertas + informe + respaldo adjunto
  async function handleEnviarCorreoCombinado() {
    if (!(await confirm(
      "¿Enviar correo completo ahora?\n\nUn solo correo con:\n• 🔔 Alertas de réditos\n• 📊 Informe ejecutivo\n• 💾 Respaldo en " + formatoBackup.toUpperCase()
    ))) return;
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
      toast.success(lineas.join("\n"), { style: { whiteSpace: "pre-line" }, duration: 6000 });
    } catch (e) { toast.error("Error al enviar: " + e.message); }
    finally { setSavingCorreo(false); }
  }

  // Envía un recordatorio de WhatsApp directo a cada deudor con un corte próximo a vencer
  async function handleEnviarWhatsapp() {
    if (!(await confirm("¿Enviar recordatorio de WhatsApp ahora a los deudores con corte próximo a vencer?"))) return;
    setEnviandoWhatsapp(true);
    try {
      const res = await api("/api/alertas/enviar-whatsapp", { method: "POST" });
      const errores = res.errores || [];
      const lineas = [`✅ Enviados: ${res.enviados ?? 0} de ${res.alertas ?? 0} alerta(s)`];
      if (errores.length) lineas.push("⚠️ " + errores.join(" · "));
      toast.success(lineas.join("\n"), { style: { whiteSpace: "pre-line" }, duration: 7000 });
    } catch (e) { toast.error("Error al enviar: " + e.message); }
    finally { setEnviandoWhatsapp(false); }
  }

  // Descarga un dump completo (estructura + datos) directo desde Railway
  async function handleExportarBackup() {
    setExportando(true);
    try {
      const user = sessionStorage.getItem("gonza_user");
      const token = user ? JSON.parse(user).token : "";
      const respuesta = await fetch(`${API_BASE}/api/configuracion/backup`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!respuesta.ok) {
        const detalle = await respuesta.json().catch(() => ({}));
        throw new Error(detalle.error || `Error ${respuesta.status}`);
      }
      const blob = await respuesta.blob();
      const url = window.URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      const fecha = new Date().toISOString().split("T")[0];
      enlace.download = `backup_gonza_${fecha}.sql`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Error al exportar backup: " + e.message);
    } finally {
      setExportando(false);
    }
  }

  // Restaura la base de datos completa desde un archivo .sql seleccionado
  async function handleRestaurarBackup(e) {
    const archivo = e.target.files[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!archivo) return;

    if (!(await confirm(
      `⚠️ Vas a restaurar la base de datos desde:\n\n"${archivo.name}"\n\n` +
      "Esto SOBRESCRIBIRÁ los datos actuales del sistema y no se puede deshacer.\n\n" +
      "¿Deseas continuar?"
    ))) return;

    setRestaurando(true);
    try {
      const user = sessionStorage.getItem("gonza_user");
      const token = user ? JSON.parse(user).token : "";
      const formData = new FormData();
      formData.append("archivo", archivo);

      const respuesta = await fetch(`${API_BASE}/api/configuracion/restore`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }, // sin Content-Type: el navegador lo arma con boundary
        body: formData,
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error || `Error ${respuesta.status}`);
      toast.success(resultado.mensaje);
    } catch (e) {
      toast.error("Error al restaurar: " + e.message);
    } finally {
      setRestaurando(false);
    }
  }

  if (loading) return <Cargando texto="Cargando configuración..."/>;

  const tarjetaChica = { padding: 13 };
  const tituloChico = { margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.navy };
  const textoChico = { margin: "0 0 10px", fontSize: 11, color: C.oxford, lineHeight: 1.5 };

  return (
    <div>
      <SectionTitle>Configuración del sistema</SectionTitle>

      {/* Accesos a Clientes y Usuarios — se abren en popup, ya no son pestañas del menú */}
      <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card onClick={() => setVerClientes(true)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>👥</span>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.navy }}>Clientes</p>
            <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>Directorio, altas y edición</p>
          </div>
        </Card>
        {rol === "administrador" && (
          <Card onClick={() => setVerUsuarios(true)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>🔐</span>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.navy }}>Usuarios</p>
              <p style={{ margin: 0, fontSize: 11, color: C.oxford }}>Cuentas y roles del sistema</p>
            </div>
          </Card>
        )}
      </div>

      {rol === "administrador" && (
      <>
      {/* Grid 2×2: ajustes rápidos arriba, gestión de datos abajo. "Envío de
          correos" queda fuera de este grid (ver más abajo): es, por mucho, la
          tarjeta con más contenido, y meterla en la misma fila que cualquier
          otra siempre estiraba esa fila entera para igualar su alto. */}
      <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Alertas — días de anticipación */}
        <Card style={tarjetaChica}>
          <p style={tituloChico}>⚙️ Alertas de réditos</p>
          <p style={textoChico}>
            Define con cuántos días de anticipación aparecen las alertas de cobro de interés mensual en el sistema y en los correos.
          </p>
          <div className="grid-resp" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
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
          {msg && <div style={{ background: C.greenLight, color: C.green, fontSize: 12, padding: "7px 10px", borderRadius: 2, marginTop: 4 }}>{msg}</div>}
        </Card>

        <Config2FA/>

        {/* Backup y restauración completa de la base de datos */}
        <Card style={tarjetaChica}>
          <p style={tituloChico}>🗄️ Base de datos (estructura + datos)</p>
          <p style={textoChico}>
            Descarga un respaldo total de PostgreSQL (tablas, índices, vistas y todos los datos), o restaura el sistema a partir de un archivo <b>.sql</b> generado previamente.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn color={C.navy} onClick={handleExportarBackup} loading={exportando}>
              📦 Exportar base de datos
            </Btn>

            <label style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 2, fontSize: 13, fontWeight: 700,
              cursor: restaurando ? "not-allowed" : "pointer",
              background: C.redLight, color: C.red, border: `2px solid ${C.red}`,
              opacity: restaurando ? 0.6 : 1,
            }}>
              {restaurando ? "Restaurando..." : "♻️ Restaurar desde .sql"}
              <input
                type="file"
                accept=".sql"
                onChange={handleRestaurarBackup}
                disabled={restaurando}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div style={{ background: C.redLight, borderRadius: 2, padding: "8px 12px", marginTop: 14, fontSize: 11, color: C.red }}>
            <b>⚠️ Cuidado:</b> restaurar sobrescribe los datos actuales del sistema y no se puede deshacer. Úsalo solo con un respaldo confiable.
          </div>
        </Card>

        {/* Historial de accesos — solo visible para administrador (el backend ya lo
            protege también). Oculto por defecto: se despliega solo si se solicita,
            y muestra nada más los últimos 20 intentos. */}
        {!errorHistorial && historial.length > 0 && (
          <Card style={tarjetaChica}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <p style={{ ...tituloChico, margin: 0 }}>🕵️ Historial de accesos</p>
              <Btn small onClick={() => setVerHistorial(v => !v)}>{verHistorial ? "Ocultar" : "Ver historial"}</Btn>
            </div>
            {verHistorial && (
              <>
                <p style={{ ...textoChico, marginTop: 8 }}>
                  Últimos {historialReciente.length} intentos de inicio de sesión (exitosos y fallidos), con IP de origen. Se actualiza solo cada semana.
                </p>
                <Tabla
                  headers={["Usuario", "Resultado", "IP", "Fecha"]}
                  rows={historialReciente.map((h, i) => [
                    h.username,
                    <Badge key={i} color={h.exito ? C.green : C.red} bg={h.exito ? C.greenLight : C.redLight}>
                      {h.exito ? "Exitoso" : "Fallido"}
                    </Badge>,
                    h.ip,
                    h.fecha,
                  ])}
                />
              </>
            )}
          </Card>
        )}
      </div>

      {/* Correo combinado — a todo lo ancho, hasta abajo (ver comentario arriba) */}
      <Card style={tarjetaChica}>
        <p style={tituloChico}>📧 Envío de correos</p>
        <p style={textoChico}>
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
                padding: "5px 14px", borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: "pointer",
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn color={C.navy} onClick={handleEnviarCorreoCombinado} loading={savingCorreo}>
            📨 Enviar correo completo ahora
          </Btn>
          <Btn color={C.green} onClick={handleEnviarWhatsapp} loading={enviandoWhatsapp}>
            💬 Recordatorio por WhatsApp
          </Btn>
        </div>

        {/* Detalle de lo que incluye */}
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            { icon: "🔔", texto: "Alertas de réditos próximos a vencer" },
            { icon: "📊", texto: "Informe ejecutivo (cartera, caja, top deudores)" },
            { icon: "💾", texto: `Respaldo de base de datos en ${formatoBackup.toUpperCase()}` },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.lightGray, borderRadius: 2, padding: "6px 10px", fontSize: 12, color: C.oxford }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.texto}
            </div>
          ))}
        </div>

        <div style={{ background: C.goldLight, borderRadius: 2, padding: "8px 12px", marginTop: 12, fontSize: 11, color: "#8B6914" }}>
          <b>Destinatarios:</b> todos los usuarios con rol <b>administrador</b> o <b>analista</b> que tengan correo registrado en la base de datos.
        </div>
      </Card>
      </>
      )}
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
        <div style={{ position: "absolute", top: 36, right: 0, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 2, boxShadow: "0 4px 16px rgba(0,0,0,.2)", width: 300, maxWidth: "calc(100vw - 24px)", zIndex: 1000, padding: 12 }}>
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

// ── SELECTOR DE TEMA ──────────────────────────────────────────────────────────
// Los 4 temas de Nexus (ver TEMAS en theme.js), con el mismo lenguaje visual
// que su propio panel "Apariencia": tarjetas con nombre, descripción y una
// muestra de 5 colores; la activa se marca con el borde encendido.
function SelectorTema({ tema, onCambiar }) {
  const [open, setOpen] = useState(false);
  const actual = TEMAS.find(t => t.id === tema) || TEMAS[0];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} title={`Tema: ${actual.nombre}`}
        style={{ background: "transparent", border: `1px solid ${C.gold}`, borderRadius: 2, height: 32, padding: "0 10px",
          fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, color: C.gold,
          fontFamily: "var(--d)", letterSpacing: ".06em", textTransform: "uppercase" }}>
        ◐ {actual.nombre}
      </button>
      {open && (
        <div style={{ position: "absolute", top: 38, right: 0, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 2, boxShadow: "0 4px 16px rgba(0,0,0,.2)", width: 260, maxWidth: "calc(100vw - 24px)", zIndex: 1000, padding: 10 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: C.oxford, textTransform: "uppercase", letterSpacing: ".08em" }}>Apariencia</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {TEMAS.map(t => (
              <button key={t.id} onClick={() => { onCambiar(t.id); setOpen(false); }}
                style={{ textAlign: "left", cursor: "pointer", padding: "8px 10px", borderRadius: 2, background: "transparent",
                  border: `1px solid ${t.id === tema ? C.gold : C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--d)", fontWeight: 600, fontSize: 12.5, letterSpacing: ".04em", textTransform: "uppercase", color: C.navy }}>{t.nombre}</span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {t.muestra.map((c, i) => (
                      <i key={i} style={{ display: "block", width: 12, height: 12, borderRadius: 2, background: c, border: "1px solid rgba(128,128,128,.35)" }}/>
                    ))}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 10.5, color: C.oxford, lineHeight: 1.35 }}>{t.descripcion}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── LOGIN CON "OLVIDÉ MI CONTRASEÑA" ─────────────────────────────────────────
function ModalResetPassword({ onClose }) {
  const [username, setUsername] = useState("");
  const [codigo, setCodigo] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1); // 1=pedir código, 2=código+nueva contraseña, 3=listo
  const [resetToken, setResetToken] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSolicitarCodigo() {
    if (!username.trim()) return toast.error("Ingresa tu nombre de usuario");
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/usuarios/solicitar-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "No se pudo enviar el código"); return; }
      setResetToken(data.token);
      setInfoMsg(data.mensaje);
      setStep(2);
    } catch (e) {
      toast.error("Error de conexión: " + e.message);
    } finally { setSaving(false); }
  }

  async function handleConfirmar() {
    if (!codigo.trim() || codigo.trim().length !== 6) return toast.error("Ingresa el código de 6 dígitos que llegó a tu correo");
    if (!newPass || newPass.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres");
    if (newPass !== confirmPass) return toast.error("Las contraseñas no coinciden");
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/usuarios/confirmar-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, codigo: codigo.trim(), new_password: newPass }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "No se pudo restablecer la contraseña"); return; }
      setMsg("✅ Contraseña restablecida correctamente. Ya puedes iniciar sesión.");
      setStep(3);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  const acciones = step === 1
    ? <><Btn color={C.orange} onClick={handleSolicitarCodigo} loading={saving}>Enviar código</Btn><Btn color={C.oxford} onClick={onClose}>Cancelar</Btn></>
    : step === 2
      ? <><Btn color={C.orange} onClick={handleConfirmar} loading={saving}>Restablecer</Btn><Btn color={C.oxford} onClick={onClose}>Cancelar</Btn></>
      : <Btn color={C.navy} onClick={onClose}>Volver al login</Btn>;

  return (
    <Modal titulo="🔑 Restablecer contraseña" onClose={onClose} acciones={acciones}>
        {step === 1 && (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: C.oxford }}>
              Ingresa tu nombre de usuario. Te enviaremos un código al correo que tengas registrado.
            </p>
            <Inp label="Nombre de usuario" value={username} onChange={e => setUsername(e.target.value)} placeholder="Ej. jgonzalez" autoFocus/>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ background: C.navyLight, borderRadius: 2, padding: "8px 12px", marginBottom: 14, fontSize: 12 }}>
              {infoMsg}
            </div>
            <Inp label="Código de 6 dígitos" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" autoFocus/>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: C.oxford }}>
              Define tu nueva contraseña. Mínimo 6 caracteres. El código vence en 15 minutos.
            </p>
            <Inp label="Nueva contraseña" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="••••••••"/>
            <Inp label="Confirmar contraseña" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="••••••••"/>
          </>
        )}

        {step === 3 && (
          <div style={{ background: C.greenLight, color: C.green, fontSize: 13, padding: "12px 14px", borderRadius: 2 }}>{msg}</div>
        )}
    </Modal>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pide2fa, setPide2fa] = useState(false);
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
        body: JSON.stringify({ username, password, totp_code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        if (data.requiere_2fa) setPide2fa(true);
        return;
      }
      onLogin(data);
    } catch (e2) { setError("No se pudo conectar con el servidor"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ background: C.lightGray, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", boxSizing: "border-box" }}>
      <Card style={{ width: 320, maxWidth: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
          <LogoLogin/>
          <div style={{ fontSize: 11, color: C.oxford, letterSpacing: 1, textTransform: "uppercase", marginTop: 10, textAlign: "center" }}>Sistema de administración de pagos</div>
        </div>
        <form onSubmit={handleSubmit}>
          <Inp label="Usuario" value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario" autoFocus disabled={pide2fa}/>
          <Inp label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" disabled={pide2fa}/>
          {pide2fa && (
            <Inp label="Código de verificación (2FA)" value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456" autoFocus/>
          )}
          {error && <div style={{ background: C.redLight, color: C.red, fontSize: 12, padding: "7px 10px", borderRadius: 2, marginBottom: 10 }}>{error}</div>}
          <Btn color={C.orange} loading={loading}>{pide2fa ? "Verificar" : "Iniciar sesión"}</Btn>
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
  { id: "prestamos",  label: "Préstamos",         icon: "💼" },
  { id: "caja",       label: "Caja",              icon: "💰" },
  { id: "ahorro",     label: "Ahorro",            icon: "🏦" },
  { id: "resumen",    label: "Resumen",           icon: "📊" },
  { id: "plazos",     label: "Pagos a plazos",    icon: "📅" },
  { id: "config",     label: "Configuración",     icon: "⚙️" },
];

function BuscadorGlobal({ onVerDeudor }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResultados(null); return; }
    const timer = setTimeout(() => {
      api(`/api/buscar?q=${encodeURIComponent(q.trim())}`).then(setResultados).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const hayResultados = resultados && (resultados.clientes.length > 0 || resultados.prestamos.length > 0);

  return (
    <div style={{ position: "relative", flex: "1 1 160px", minWidth: 120, maxWidth: 230, marginRight: 14 }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="🔍 Buscar cliente o préstamo..."
        style={{ width: "100%", padding: "7px 10px", borderRadius: 2, border: "none", fontSize: 12, boxSizing: "border-box", background: C.campo, color: C.navy }}
      />
      {abierto && q.trim().length >= 2 && (
        <div style={{ position: "absolute", top: 34, left: 0, width: "max(230px, 100%)", maxWidth: "calc(100vw - 24px)", background: C.cardBg, borderRadius: 2, boxShadow: "0 4px 16px rgba(0,0,0,.3)", zIndex: 100, maxHeight: 320, overflowY: "auto" }}>
          {!hayResultados && <p style={{ margin: 0, padding: 12, fontSize: 12, color: C.oxford }}>Sin resultados</p>}
          {resultados?.clientes.length > 0 && (
            <div>
              <p style={{ margin: 0, padding: "6px 10px", fontSize: 10, fontWeight: 700, color: C.oxford, background: C.lightGray }}>CLIENTES</p>
              {resultados.clientes.map(c => (
                <div key={c.id} onMouseDown={() => { onVerDeudor(c.id); setAbierto(false); setQ(""); }}
                  style={{ padding: "8px 10px", fontSize: 12, cursor: "pointer", borderBottom: `1px solid ${C.border}`, color: C.oxford }}>
                  {c.nombre} {c.apellido_pat} — {c.telefono || "sin teléfono"}
                </div>
              ))}
            </div>
          )}
          {resultados?.prestamos.length > 0 && (
            <div>
              <p style={{ margin: 0, padding: "6px 10px", fontSize: 10, fontWeight: 700, color: C.oxford, background: C.lightGray }}>PRÉSTAMOS</p>
              {resultados.prestamos.map(p => (
                <div key={p.id} onMouseDown={() => { onVerDeudor(p.cliente_id); setAbierto(false); setQ(""); }}
                  style={{ padding: "8px 10px", fontSize: 12, cursor: "pointer", borderBottom: `1px solid ${C.border}`, color: C.oxford }}>
                  {p.deudor_nombre} — {fmt(p.monto)} {p.pagado ? "(pagado)" : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Debe coincidir con TOKEN_SESION_MAX_AGE del backend (8 horas)
const SESION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const AVISO_ANTES_MS = 15 * 60 * 1000; // avisar 15 minutos antes de que expire

export default function App() {
  const [sec, setSec] = useState("resumen");
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("gonza_user");
    return saved ? JSON.parse(saved) : null;
  });
  // Clientes/Usuarios se muestran como popup desde cualquier sección (el botón
  // dentro de Configuración y los resultados del buscador global comparten
  // este mismo estado), y ya no son pestañas propias del menú.
  const [verClientes, setVerClientes] = useState(false);
  const [verUsuarios, setVerUsuarios] = useState(false);
  const [deudorGlobal, setDeudorGlobal] = useState(null);

  // ── TEMA (Nexus por defecto; 4 paletas seleccionables, ver TEMAS en theme.js) ─
  // Ya no mutamos el objeto C. Cada clave de C apunta a una variable CSS y el
  // tema se cambia poniendo data-tema en <html>; el navegador recalcula todo,
  // incluidos los elementos que se estilizan por clase (.pnl, .btn, .tbl...).
  // Efecto secundario positivo: ahora puedes usar React.memo sin romper nada.
  const [tema, setTema] = useState(temaGuardado);

  useEffect(() => { aplicarTema(tema); }, [tema]);

  function handleLogin(userData) {
    sessionStorage.setItem("gonza_user", JSON.stringify(userData));
    sessionStorage.setItem("gonza_login_time", Date.now().toString());
    setUser(userData);
  }
  function handleLogout() {
    sessionStorage.removeItem("gonza_user");
    sessionStorage.removeItem("gonza_login_time");
    setUser(null);
  }

  // Aviso de sesión por expirar: se calcula desde la hora real de login (persiste si recargas la página)
  useEffect(() => {
    if (!user) return;
    const loginTime = parseInt(sessionStorage.getItem("gonza_login_time") || Date.now(), 10);
    const msRestantes = (loginTime + SESION_MAX_AGE_MS - AVISO_ANTES_MS) - Date.now();

    if (msRestantes <= 0) return; // ya estamos dentro de la ventana de aviso o expirada, la próxima llamada a la API lo resolverá

    const timer = setTimeout(() => {
      toast(
        "⏰ Tu sesión expirará en 15 minutos. Guarda lo que estés haciendo o vuelve a iniciar sesión para renovarla.",
        { duration: 12000, style: { fontSize: 13, maxWidth: 380, background: C.orangeLight, color: C.oxford, border: `1px solid ${C.orange}` } }
      );
    }, msRestantes);

    return () => clearTimeout(timer);
  }, [user]);

  if (!user) return (
    <ConfirmProvider>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: 13, maxWidth: 380 }, success: { iconTheme: { primary: C.green, secondary: C.white } }, error: { iconTheme: { primary: C.red, secondary: C.white } } }}/>
      <Login onLogin={handleLogin}/>
    </ConfirmProvider>
  );

  return (
    <ConfirmProvider>
    <Toaster position="top-right" toastOptions={{ style: { fontSize: 13, maxWidth: 380 }, success: { iconTheme: { primary: C.green, secondary: C.white } }, error: { iconTheme: { primary: C.red, secondary: C.white } } }}/>
    <div style={{ background: C.lightGray, minHeight: "100vh" }}>
      <div className="app-header" style={{ background: C.headerBg, padding: "0 20px", display: "flex", alignItems: "center", gap: 14, height: 56, boxShadow: "0 2px 6px rgba(0,0,0,.3)" }}>
        <Logo size={40}/>
        <div className="ocultar-movil">
          <div style={{ fontFamily: "var(--d)", fontSize: 15, fontWeight: 700, letterSpacing: ".22em", color: C.gold, lineHeight: 1.1 }}>JGM</div>
          <div style={{ fontFamily: "var(--m)", fontSize: 10, fontWeight: 500, color: C.oxford, letterSpacing: ".1em", lineHeight: 1.3, marginTop: 2 }}>Gonzas <span style={{ color: C.orange }}>systems</span></div>
        </div>
        <div className="sp" style={{ flex: 1 }}/>
        <div className="buscador-global">
          <BuscadorGlobal onVerDeudor={setDeudorGlobal}/>
        </div>
        <div style={{ textAlign: "right", marginRight: 14 }}>
          <div style={{ fontSize: 12, color: C.navy, fontWeight: 700 }}>{user.nombre}</div>
          <div style={{ fontFamily: "var(--m)", fontSize: 10, color: C.gold, letterSpacing: ".08em", textTransform: "uppercase" }}>{user.rol}</div>
        </div>
        <AlertasBell/>
        <SelectorTema tema={tema} onCambiar={setTema}/>
        <Btn small color={C.orange} onClick={handleLogout}>Salir</Btn>
        <div className="ocultar-movil" style={{ fontFamily: "var(--m)", fontSize: 10, letterSpacing: ".04em", color: C.oxford, marginLeft: 14 }}>
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>
      <nav style={{ background: C.navBg, display: "flex", flexWrap: "wrap", boxShadow: "0 2px 4px rgba(0,0,0,.2)" }}>
        {MENU.filter(m => !m.soloAdmin || user.rol === "administrador").map(m => {
          const active = sec === m.id;
          return (
            <button key={m.id} onClick={() => setSec(m.id)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "11px 18px",
              background: active ? C.headerBg : "transparent", border: "none",
              borderBottom: active ? `3px solid ${C.gold}` : "3px solid transparent",
              color: active ? C.gold : C.oxford, fontSize: 12, fontWeight: active ? 600 : 500, cursor: "pointer",
              fontFamily: "var(--d)", letterSpacing: ".08em", textTransform: "uppercase",
            }}>
              <span style={{ fontSize: 15 }}>{m.icon}</span>{m.label}
            </button>
          );
        })}
      </nav>
      <main style={{ padding: "20px 22px", overflowY: "auto", minHeight: "calc(100vh - 100px)" }}>
        {sec === "resumen"   && <ModResumen irA={setSec}/>}
        {sec === "prestamos" && <ModPrestamos/>}
        {sec === "ahorro"    && <ModAhorro/>}
        {sec === "caja"      && <ModCaja/>}
        {sec === "plazos"    && <ModPagosPlazos/>}
        {sec === "config"    && (
          <ModConfiguracion rol={user.rol}
            verClientes={verClientes} setVerClientes={setVerClientes}
            verUsuarios={verUsuarios} setVerUsuarios={setVerUsuarios}/>
        )}
      </main>

      {verClientes && (
        <Modal titulo="👥 Clientes" ancho={1100} onClose={() => setVerClientes(false)}>
          <ModClientes/>
        </Modal>
      )}
      {verUsuarios && (
        <Modal titulo="🔐 Usuarios" ancho={1100} onClose={() => setVerUsuarios(false)}>
          <ModUsuarios/>
        </Modal>
      )}
      {deudorGlobal && (
        <ModalInformeDeudor clienteId={deudorGlobal} onClose={() => setDeudorGlobal(null)}/>
      )}
    </div>
    </ConfirmProvider>
  );
}
