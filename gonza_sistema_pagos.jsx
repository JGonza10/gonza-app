import { useState, useReducer } from "react";

const C = {
  navy:"#0B1F4B", gold:"#C9A84C", orange:"#E87722", oxford:"#3B3B4F",
  white:"#FFFFFF", lightGray:"#F4F4F6", border:"#D4D4DC",
  goldLight:"#F5EDD3", navyLight:"#E8EDF5", orangeLight:"#FEF0E3",
  red:"#D93025", green:"#1A7F3C", redLight:"#FDE8E8", greenLight:"#E6F4EC",
};

function initDB() {
  return {
    clientes: [
      {id:1,  nombre:"JUAN",           ap:"GONZALEZ", am:"MENDOZA",  tel:"", dir:"", activo:true},
      {id:2,  nombre:"ERIK ARMANDO",   ap:"GONZALEZ", am:"RAMIREZ",  tel:"", dir:"", activo:true},
      {id:3,  nombre:"PAVEL EMILIANO", ap:"GONZALEZ", am:"RAMIREZ",  tel:"", dir:"", activo:true},
      {id:4,  nombre:"JUANA IGNACIA",  ap:"RAMIREZ",  am:"ALVAREZ",  tel:"", dir:"", activo:true},
    ],
    prestamos: [
      {id:1,  nombre:"ARACELI SANCHEZ",   fecha:"2025-01-01", monto:7000,  interes:700,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:2,  nombre:"ANGELES",           fecha:"2025-03-30", monto:1000,  interes:100,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:3,  nombre:"AIDE",              fecha:"2026-08-20", monto:1000,  interes:100,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:4,  nombre:"AIDE",              fecha:"2025-09-28", monto:1000,  interes:100,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:5,  nombre:"RAMÓN MEJÍA",       fecha:"2025-09-30", monto:15000, interes:1500, nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:6,  nombre:"ARACELI SANCHEZ",   fecha:"2025-11-12", monto:2000,  interes:200,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:7,  nombre:"JESSICA",           fecha:"2025-12-31", monto:0,     interes:0,    nota:"SE CAMBIO AL 26 CON UNA SOLA CUENTA", pagado:false, fecha_pago:null, tipo_pago:""},
      {id:8,  nombre:"GUSTAVO CABRERA",   fecha:"2025-12-31", monto:500,   interes:50,   nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:9,  nombre:"ARACELI SANCHEZ",   fecha:"2026-01-02", monto:6000,  interes:600,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:10, nombre:"LARISA",            fecha:"2026-01-15", monto:500,   interes:50,   nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:11, nombre:"CLAUDIA",           fecha:"2026-01-20", monto:15000, interes:1500, nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:12, nombre:"LARISA",            fecha:"2026-01-15", monto:3000,  interes:300,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:13, nombre:"NORMA",             fecha:"2026-01-22", monto:2000,  interes:200,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:14, nombre:"ANA GONZALEZ",      fecha:"2026-01-23", monto:5000,  interes:500,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:15, nombre:"ALMA RAMIREZ",      fecha:"2026-01-24", monto:1000,  interes:100,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:16, nombre:"GUSTAVO CABRERA",   fecha:"2026-01-27", monto:5000,  interes:500,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:17, nombre:"JESSICA",           fecha:"2026-02-05", monto:0,     interes:0,    nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:18, nombre:"ARACELI SANCHEZ",   fecha:"2026-02-06", monto:1000,  interes:100,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:19, nombre:"ARACELI SANCHEZ",   fecha:"2026-02-07", monto:1500,  interes:150,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:20, nombre:"MIRIAM PÉREZ",      fecha:"2026-02-12", monto:5000,  interes:500,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:21, nombre:"JUANA RAMIREZ",     fecha:"2026-02-18", monto:12300, interes:0,    nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:22, nombre:"JESSICA",           fecha:"2026-02-19", monto:3000,  interes:300,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:23, nombre:"ANGELES sobrina",   fecha:"2026-02-26", monto:0,     interes:0,    nota:"PAGADO EL DIA 04/05/2026",       pagado:true,  fecha_pago:"2026-05-04", tipo_pago:"transferencia"},
      {id:24, nombre:"SILVIA",            fecha:"2026-02-27", monto:5000,  interes:500,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:25, nombre:"CLAUDIA",           fecha:"2026-02-28", monto:60000, interes:6000, nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:26, nombre:"ARACELI SANCHEZ",   fecha:"2026-03-01", monto:10000, interes:1000, nota:"JOSEFINA 20000",                pagado:false, fecha_pago:null, tipo_pago:""},
      {id:27, nombre:"ANGELES",           fecha:"2026-03-03", monto:3000,  interes:300,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:28, nombre:"ARACELI RAMIREZ",   fecha:"2026-03-07", monto:0,     interes:0,    nota:"11/04/2026 PAGADO",             pagado:true,  fecha_pago:"2026-05-04", tipo_pago:"transferencia"},
      {id:29, nombre:"ARACELI RAMIREZ",   fecha:"2026-03-10", monto:3000,  interes:300,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:30, nombre:"SAMANTHA",          fecha:"2026-03-12", monto:3000,  interes:300,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:31, nombre:"ARACELI SANCHEZ",   fecha:"2026-03-19", monto:3500,  interes:350,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:32, nombre:"JESSICA",           fecha:"2026-03-26", monto:50000, interes:0,    nota:"SE CAMBIO AL 26 CON UNA SOLA CUENTA", pagado:false, fecha_pago:null, tipo_pago:""},
      {id:33, nombre:"ANA GONZALEZ",      fecha:"2026-03-19", monto:5000,  interes:500,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:34, nombre:"RAMÓN MEJÍA",       fecha:"2026-03-19", monto:5500,  interes:550,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:35, nombre:"ALMA RAMIREZ",      fecha:"2026-04-06", monto:1000,  interes:100,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:36, nombre:"ANGELES sobrina",   fecha:"2026-04-08", monto:0,     interes:0,    nota:"PAGADO EL DIA 04/05/2026",       pagado:true,  fecha_pago:"2026-05-04", tipo_pago:"transferencia"},
      {id:37, nombre:"LARISA",            fecha:"2026-04-15", monto:3500,  interes:350,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:38, nombre:"ARACELI SANCHEZ",   fecha:"2026-04-22", monto:1000,  interes:100,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:39, nombre:"SAMANTHA",          fecha:"2026-04-27", monto:1000,  interes:100,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:40, nombre:"ANGELES sobrina",   fecha:"2026-05-05", monto:12000, interes:1200, nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:41, nombre:"SAMANTHA",          fecha:"2026-05-08", monto:5000,  interes:500,  nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:42, nombre:"ARACELI SANCHEZ",   fecha:"2026-05-09", monto:0,     interes:0,    nota:"PAGADO EL DIA 04/06/2026",       pagado:true,  fecha_pago:"2026-06-04", tipo_pago:"transferencia"},
      {id:43, nombre:"ANGELES",           fecha:"2026-05-27", monto:10000, interes:1000, nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
      {id:44, nombre:"ANGELES",           fecha:"2026-06-06", monto:10000, interes:1000, nota:"",                              pagado:false, fecha_pago:null, tipo_pago:""},
    ],
    ahorros: [
      {id:1, ap:"GONZALEZ", am:"MENDOZA",  nombre:"JUAN",           cantidad:800},
      {id:2, ap:"GONZALEZ", am:"RAMIREZ",  nombre:"ERIK ARMANDO",   cantidad:5000},
      {id:3, ap:"GONZALEZ", am:"RAMIREZ",  nombre:"PAVEL EMILIANO", cantidad:5000},
      {id:4, ap:"RAMIREZ",  am:"ALVAREZ",  nombre:"JUANA IGNACIA",  cantidad:3800},
    ],
    caja: [
      {id:1,  nombre:"JUANA",          cuota:200,  capital:2000,  inicio:"15-ene"},
      {id:2,  nombre:"ARACELI RAMIREZ",cuota:200,  capital:2400,  inicio:"15-dic"},
      {id:3,  nombre:"JUANA ALVAREZ",  cuota:500,  capital:6000,  inicio:"15-dic"},
      {id:4,  nombre:"ANGELES",        cuota:2600, capital:26000, inicio:"15-ene"},
      {id:5,  nombre:"ALMA",           cuota:1000, capital:14000, inicio:"15-dic"},
      {id:6,  nombre:"NATIVIDAD",      cuota:1400, capital:16800, inicio:"15-dic"},
      {id:7,  nombre:"CLAUDIA FLORES", cuota:1250, capital:15000, inicio:"15-dic"},
      {id:8,  nombre:"LIZBETH",        cuota:1000, capital:11000, inicio:"30-dic"},
      {id:9,  nombre:"NORMA",          cuota:1000, capital:12000, inicio:"15-dic"},
      {id:10, nombre:"JESSICA",        cuota:1000, capital:10000, inicio:"15-ene"},
      {id:11, nombre:"SILVIA",         cuota:3000, capital:33000, inicio:"30-dic"},
      {id:12, nombre:"GUSTAVO",        cuota:400,  capital:4800,  inicio:"15-dic"},
      {id:13, nombre:"RAMÓN",          cuota:1000, capital:12000, inicio:"15-dic"},
      {id:14, nombre:"ANA",            cuota:400,  capital:4000,  inicio:"15-ene"},
      {id:15, nombre:"SAMANTHA",       cuota:400,  capital:4000,  inicio:"15-ene"},
      {id:16, nombre:"LARISA",         cuota:200,  capital:2400,  inicio:"15-dic"},
      {id:17, nombre:"ESTELA RAMIREZ", cuota:500,  capital:6000,  inicio:"15-mar"},
    ],
    pagos_plazos: [
      {id:1, material:"Moto",           costo:9000,  meses:18, meses_pagados:6,  cuota:500,   abonado:3000},
      {id:2, material:"Celular Juana",  costo:3000,  meses:15, meses_pagados:4,  cuota:200,   abonado:800},
      {id:3, material:"Estufa",         costo:null,  meses:18, meses_pagados:11, cuota:null,  abonado:null},
      {id:4, material:"Parrilla",       costo:2640,  meses:15, meses_pagados:5,  cuota:176,   abonado:880},
      {id:5, material:"Botas",          costo:1850,  meses:6,  meses_pagados:0,  cuota:308.33,abonado:0},
    ],
  };
}

function dbReducer(state, action) {
  switch(action.type) {
    case "ADD_CLIENTE":
      return {...state, clientes:[...state.clientes, {...action.p, id:Date.now(), activo:true}]};
    case "ADD_PRESTAMO":
      return {...state, prestamos:[...state.prestamos, {...action.p, id:Date.now(), pagado:false, fecha_pago:null}]};
    case "MARCAR_PRESTAMO_PAGADO":
      return {...state, prestamos: state.prestamos.map(p => p.id===action.id ? {...p, pagado:true, fecha_pago:action.fecha, tipo_pago:action.tipo} : p)};
    case "ADD_AHORRO":
      return {...state, ahorros:[...state.ahorros, {...action.p, id:Date.now()}]};
    case "ADD_CAJA":
      return {...state, caja:[...state.caja, {...action.p, id:Date.now()}]};
    case "ADD_PAGO_PLAZO":
      return {...state, pagos_plazos:[...state.pagos_plazos, {...action.p, id:Date.now(), meses_pagados:0, abonado:0}]};
    case "ABONAR_PLAZO":
      return {...state, pagos_plazos: state.pagos_plazos.map(p => p.id===action.id ? {...p, meses_pagados:Math.min(p.meses_pagados+1,p.meses), abonado:(p.abonado||0)+(p.cuota||0)} : p)};
    default: return state;
  }
}

const fmt = n => n==null?"—":new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(n);
const today = new Date().toISOString().split("T")[0];
const diaspara = f => { const d=new Date(f)-new Date(today); return Math.ceil(d/(864e5)); };

function Logo({size=40}) {
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

function Card({children,style}){return <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px",...style}}>{children}</div>;}
function SectionTitle({children}){return <h2 style={{margin:"0 0 14px",fontSize:17,fontWeight:700,color:C.navy,borderLeft:`4px solid ${C.gold}`,paddingLeft:10}}>{children}</h2>;}
function Badge({children,color=C.navy,bg=C.navyLight}){return <span style={{background:bg,color,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap"}}>{children}</span>;}

function Inp({label,...p}){return(
  <div style={{marginBottom:9}}>
    {label&&<label style={{display:"block",fontSize:12,color:C.oxford,marginBottom:3,fontWeight:600}}>{label}</label>}
    <input {...p} style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.navy,background:C.lightGray,boxSizing:"border-box",...p.style}}/>
  </div>
);}
function Sel({label,children,...p}){return(
  <div style={{marginBottom:9}}>
    {label&&<label style={{display:"block",fontSize:12,color:C.oxford,marginBottom:3,fontWeight:600}}>{label}</label>}
    <select {...p} style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.navy,background:C.lightGray,boxSizing:"border-box"}}>{children}</select>
  </div>
);}
function Btn({children,onClick,color=C.navy,small}){return(
  <button onClick={onClick} style={{background:color,color:C.white,border:"none",borderRadius:8,padding:small?"4px 12px":"8px 18px",fontSize:small?11:13,fontWeight:700,cursor:"pointer"}}>{children}</button>
);}

function Tabla({headers,rows,empty="Sin registros"}){return(
  <div style={{overflowX:"auto"}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
      <thead><tr style={{background:C.navy}}>{headers.map((h,i)=><th key={i} style={{color:C.gold,padding:"7px 9px",textAlign:"left",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.length===0
          ? <tr><td colSpan={headers.length} style={{textAlign:"center",padding:16,color:C.oxford}}>{empty}</td></tr>
          : rows.map((r,i)=><tr key={i} style={{background:i%2===0?C.white:C.lightGray}}>{r.map((c,j)=><td key={j} style={{padding:"6px 9px",color:C.oxford,borderBottom:`1px solid ${C.border}`}}>{c}</td>)}</tr>)
        }
      </tbody>
    </table>
  </div>
);}

// MÓDULOS

function ModClientes({db,dispatch}){
  const [f,setF]=useState({nombre:"",ap:"",am:"",tel:"",dir:""});
  const s=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  return(
    <div>
      <SectionTitle>Clientes</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.5fr",gap:16}}>
        <Card>
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:C.oxford}}>Registrar cliente</p>
          <Inp label="Nombre(s)" value={f.nombre} onChange={s("nombre")} placeholder="Ej. JUAN"/>
          <Inp label="Apellido paterno" value={f.ap} onChange={s("ap")} placeholder="GONZALEZ"/>
          <Inp label="Apellido materno" value={f.am} onChange={s("am")} placeholder="MENDOZA"/>
          <Inp label="Teléfono" value={f.tel} onChange={s("tel")} placeholder="555-0000"/>
          <Inp label="Dirección" value={f.dir} onChange={s("dir")} placeholder="Calle y número"/>
          <Btn onClick={()=>{if(!f.nombre)return alert("Nombre requerido");dispatch({type:"ADD_CLIENTE",p:f});setF({nombre:"",ap:"",am:"",tel:"",dir:""});}}>Guardar</Btn>
        </Card>
        <Card>
          <p style={{margin:"0 0 8px",fontSize:13,fontWeight:700,color:C.oxford}}>Directorio ({db.clientes.length} clientes)</p>
          <Tabla
            headers={["ID","Apellido paterno","Apellido materno","Nombre","Teléfono","Estado"]}
            rows={db.clientes.map(c=>[c.id,c.ap,c.am,c.nombre,c.tel||"—",<Badge key={c.id}>{c.activo?"Activo":"Inactivo"}</Badge>])}
          />
        </Card>
      </div>
    </div>
  );
}

function ModPrestamos({db,dispatch}){
  const [f,setF]=useState({nombre:"",fecha:today,monto:"",interes:"",nota:"",tipo_pago:""});
  const s=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  const activos=db.prestamos.filter(p=>!p.pagado&&p.monto>0);
  const pagados=db.prestamos.filter(p=>p.pagado);
  const totalCartera=activos.reduce((a,p)=>a+p.monto,0);
  const totalIntereses=activos.reduce((a,p)=>a+p.interes,0);
  return(
    <div>
      <SectionTitle>Préstamos</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        {[
          {l:"Cartera activa",v:fmt(totalCartera),c:C.navy,bg:C.navyLight},
          {l:"Intereses esperados",v:fmt(totalIntereses),c:"#8B6914",bg:C.goldLight},
          {l:"Préstamos pagados",v:pagados.length,c:C.green,bg:C.greenLight},
        ].map((s2,i)=><Card key={i} style={{background:s2.bg}}><p style={{margin:0,fontSize:11,color:C.oxford}}>{s2.l}</p><p style={{margin:"2px 0 0",fontSize:20,fontWeight:700,color:s2.c}}>{s2.v}</p></Card>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16,marginBottom:16}}>
        <Card>
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:C.oxford}}>Registrar préstamo</p>
          <Inp label="Nombre del deudor" value={f.nombre} onChange={s("nombre")} placeholder="Nombre completo"/>
          <Inp label="Fecha del préstamo" type="date" value={f.fecha} onChange={s("fecha")}/>
          <Inp label="Monto prestado ($)" type="number" value={f.monto} onChange={e=>{const v=e.target.value;setF(x=>({...x,monto:v,interes:v?Math.round(v*0.10):""}))}}/> 
          <div style={{background:C.goldLight,borderRadius:8,padding:"7px 10px",fontSize:12,marginBottom:8}}>
            Interés (10%): <b>{f.monto?fmt(f.monto*0.10):"—"}</b>
          </div>
          <Inp label="Notas" value={f.nota} onChange={s("nota")} placeholder="Observaciones"/>
          <Btn color={C.orange} onClick={()=>{if(!f.nombre||!f.monto)return alert("Nombre y monto requeridos");dispatch({type:"ADD_PRESTAMO",p:{...f,monto:parseFloat(f.monto),interes:parseFloat(f.monto)*0.10}});setF({nombre:"",fecha:today,monto:"",interes:"",nota:"",tipo_pago:""});}}>Registrar préstamo</Btn>
        </Card>
        <Card>
          <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:C.oxford}}>Préstamos activos ({activos.length})</p>
          <Tabla
            headers={["#","Deudor","Fecha","Monto","Interés (10%)","Nota","Acción"]}
            rows={activos.map(p=>[
              p.id, p.nombre, p.fecha, fmt(p.monto), fmt(p.interes), p.nota||"—",
              <Btn key={p.id} small color={C.green} onClick={()=>{const f2=prompt("Fecha de pago (YYYY-MM-DD):",today)||today;dispatch({type:"MARCAR_PRESTAMO_PAGADO",id:p.id,fecha:f2,tipo:"transferencia"});}}>✓ Pagado</Btn>
            ])}
          />
        </Card>
      </div>
      {pagados.length>0&&<Card><p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:C.oxford}}>Pagados ({pagados.length})</p>
        <Tabla headers={["#","Deudor","Fecha préstamo","Monto","Fecha pago","Nota"]} rows={pagados.map(p=>[p.id,p.nombre,p.fecha,fmt(p.monto),p.fecha_pago||"—",p.nota||"—"])}/>
      </Card>}
    </div>
  );
}

function ModAhorro({db,dispatch}){
  const [f,setF]=useState({nombre:"",ap:"",am:"",cantidad:""});
  const s=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  const total=db.ahorros.reduce((a,x)=>a+(x.cantidad||0),0);
  return(
    <div>
      <SectionTitle>Ahorro</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.5fr",gap:16}}>
        <Card>
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:C.oxford}}>Registrar ahorro cobrado</p>
          <Inp label="Nombre" value={f.nombre} onChange={s("nombre")} placeholder="Nombre completo"/>
          <Inp label="Apellido paterno" value={f.ap} onChange={s("ap")}/>
          <Inp label="Apellido materno" value={f.am} onChange={s("am")}/>
          <Inp label="Cantidad ($)" type="number" value={f.cantidad} onChange={s("cantidad")}/>
          <Btn onClick={()=>{if(!f.nombre||!f.cantidad)return alert("Datos requeridos");dispatch({type:"ADD_AHORRO",p:{...f,cantidad:parseFloat(f.cantidad)}});setF({nombre:"",ap:"",am:"",cantidad:""});}}>Registrar</Btn>
        </Card>
        <div>
          <Card style={{marginBottom:12,background:C.navyLight}}>
            <p style={{margin:0,fontSize:11,color:C.oxford}}>Total en ahorros del grupo</p>
            <p style={{margin:"2px 0 0",fontSize:24,fontWeight:700,color:C.navy}}>{fmt(total)}</p>
          </Card>
          <Card>
            <Tabla
              headers={["Apellido P.","Apellido M.","Nombre","Cantidad"]}
              rows={db.ahorros.map(a=>[a.ap,a.am,a.nombre,fmt(a.cantidad)])}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function ModCaja({db,dispatch}){
  const [f,setF]=useState({nombre:"",cuota:"",capital:""});
  const s=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  const totalCapital=db.caja.reduce((a,c)=>a+(c.capital||0),0);
  const totalSemanal=db.caja.reduce((a,c)=>a+(c.cuota||0),0);
  return(
    <div>
      <SectionTitle>Caja de ahorro</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
        <Card style={{background:C.navyLight}}>
          <p style={{margin:0,fontSize:11,color:C.oxford}}>Capital total acumulado</p>
          <p style={{margin:"2px 0 0",fontSize:22,fontWeight:700,color:C.navy}}>{fmt(totalCapital)}</p>
        </Card>
        <Card style={{background:C.goldLight}}>
          <p style={{margin:0,fontSize:11,color:C.oxford}}>Aportación quincenal total</p>
          <p style={{margin:"2px 0 0",fontSize:22,fontWeight:700,color:"#8B6914"}}>{fmt(totalSemanal)}</p>
        </Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16}}>
        <Card>
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:C.oxford}}>Agregar participante</p>
          <Inp label="Nombre" value={f.nombre} onChange={s("nombre")}/>
          <Inp label="Cuota quincenal ($)" type="number" value={f.cuota} onChange={s("cuota")}/>
          <Inp label="Capital acumulado ($)" type="number" value={f.capital} onChange={s("capital")}/>
          <Btn onClick={()=>{if(!f.nombre)return alert("Nombre requerido");dispatch({type:"ADD_CAJA",p:{...f,cuota:parseFloat(f.cuota)||0,capital:parseFloat(f.capital)||0}});setF({nombre:"",cuota:"",capital:""});}}>Agregar</Btn>
        </Card>
        <Card>
          <Tabla
            headers={["No.","Nombre","Cuota quincenal","Capital acumulado","Inicio"]}
            rows={db.caja.map((c,i)=>[i+1, c.nombre, fmt(c.cuota), fmt(c.capital), c.inicio||"—"])}
          />
          <div style={{borderTop:`1px solid ${C.border}`,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700}}>
            <span>TOTAL</span>
            <span style={{color:C.navy}}>{fmt(totalCapital)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ModPagosPlazos({db,dispatch}){
  const [f,setF]=useState({material:"",costo:"",meses:"",cuota:""});
  const s=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  return(
    <div>
      <SectionTitle>Pagos a plazos</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16}}>
        <Card>
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:C.oxford}}>Registrar artículo a plazos</p>
          <Inp label="Material / Artículo" value={f.material} onChange={s("material")} placeholder="Ej. Moto, Celular..."/>
          <Inp label="Costo total ($)" type="number" value={f.costo} onChange={e=>{const v=e.target.value;setF(x=>({...x,costo:v,cuota:v&&f.meses?Math.round(v/f.meses):x.cuota}))}}/>
          <Inp label="Total de meses" type="number" value={f.meses} onChange={e=>{const v=e.target.value;setF(x=>({...x,meses:v,cuota:v&&f.costo?Math.round(f.costo/v):x.cuota}))}}/>
          <div style={{background:C.goldLight,borderRadius:8,padding:"7px 10px",fontSize:12,marginBottom:8}}>
            Cuota mensual: <b>{f.costo&&f.meses?fmt(f.costo/f.meses):"—"}</b>
          </div>
          <Btn color={C.orange} onClick={()=>{if(!f.material||!f.costo)return alert("Datos requeridos");dispatch({type:"ADD_PAGO_PLAZO",p:{...f,costo:parseFloat(f.costo),meses:parseInt(f.meses),cuota:parseFloat(f.costo)/parseInt(f.meses)}});setF({material:"",costo:"",meses:"",cuota:""});}}>Registrar</Btn>
        </Card>
        <Card>
          <Tabla
            headers={["Material","Costo","Meses","Pagados","Pendientes","Cuota","Abonado","Restante","Avance","Acción"]}
            rows={db.pagos_plazos.map(p=>{
              const pend=p.meses-p.meses_pagados;
              const rest=(p.costo||0)-(p.abonado||0);
              const pct=p.meses?Math.round((p.meses_pagados/p.meses)*100):0;
              return [
                p.material,fmt(p.costo),p.meses,p.meses_pagados,pend,
                fmt(p.cuota),fmt(p.abonado),fmt(rest),
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{background:C.border,borderRadius:6,height:8,width:60}}>
                    <div style={{background:pct>=100?C.green:C.orange,width:`${Math.min(pct,100)}%`,height:8,borderRadius:6}}/>
                  </div>
                  <span style={{fontSize:10}}>{pct}%</span>
                </div>,
                pend>0
                  ? <Btn key={`btn${p.id}`} small color={C.green} onClick={()=>dispatch({type:"ABONAR_PLAZO",id:p.id})}>+ Abono</Btn>
                  : <Badge key={`ok${p.id}`} color={C.green} bg={C.greenLight}>✓ Liquidado</Badge>
              ];
            })}
          />
        </Card>
      </div>
    </div>
  );
}

function ModAlertas({db}){
  const hoy=new Date();
  const alertas=[];
  db.prestamos.filter(p=>!p.pagado&&p.monto>0).forEach(p=>{
    const fBase=new Date(p.fecha);
    // próximo cobro de interés = 1 mes desde fecha
    let next=new Date(fBase);
    while(next<=hoy) next.setMonth(next.getMonth()+1);
    const dias=Math.ceil((next-hoy)/(864e5));
    if(dias<=15) alertas.push({tipo:dias<=0?"vencido":dias<=7?"urgente":"proximo", nombre:p.nombre, fecha:next.toISOString().split("T")[0], dias, monto:p.interes, id:p.id});
  });
  alertas.sort((a,b)=>a.dias-b.dias);
  return(
    <div>
      <SectionTitle>Alertas de pago de intereses</SectionTitle>
      <Card style={{background:C.goldLight,marginBottom:14}}>
        <p style={{margin:0,fontSize:12,color:C.oxford}}>
          ℹ️ El interés se cobra mensualmente (10% del monto prestado) a partir de la fecha del préstamo.
          Se muestran alertas cuando faltan <b>15 días o menos</b> para el cobro.
        </p>
      </Card>
      {alertas.length===0
        ? <Card><p style={{textAlign:"center",padding:24,color:C.oxford}}>✅ Sin alertas próximas. Todos los cobros de interés están a más de 15 días.</p></Card>
        : alertas.map((a,i)=>{
            const col=a.tipo==="vencido"?{bg:C.redLight,border:C.red,icon:"🚨",label:"VENCIDO",tc:C.red}
              :a.tipo==="urgente"?{bg:C.orangeLight,border:C.orange,icon:"🔔",label:"Esta semana",tc:C.orange}
              :{bg:C.goldLight,border:C.gold,icon:"📅",label:"Próximo (15 días)",tc:"#8B6914"};
            return(
              <div key={i} style={{background:col.bg,border:`1px solid ${col.border}`,borderLeft:`4px solid ${col.border}`,borderRadius:10,padding:"10px 16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span style={{fontWeight:700,color:col.tc}}>{col.icon} {col.label} · </span>
                  <span style={{fontSize:13,color:C.oxford}}>{a.nombre}</span>
                  <div style={{fontSize:12,color:C.oxford,marginTop:3}}>
                    Cobro: {a.fecha} ({a.dias<=0?"hoy o vencido":`en ${a.dias} día(s)`}) · Interés: <b>{fmt(a.monto)}</b>
                  </div>
                </div>
                <Badge color={col.tc} bg={col.bg}>{a.tipo}</Badge>
              </div>
            );
          })
      }
    </div>
  );
}

function ModResumen({db}){
  const activos=db.prestamos.filter(p=>!p.pagado&&p.monto>0);
  const totalCartera=activos.reduce((a,p)=>a+p.monto,0);
  const totalIntereses=activos.reduce((a,p)=>a+p.interes,0);
  const totalAhorros=db.ahorros.reduce((a,x)=>a+(x.cantidad||0),0);
  const totalCaja=db.caja.reduce((a,c)=>a+(c.capital||0),0);
  const pagados=db.prestamos.filter(p=>p.pagado).length;
  const pendientesPlazos=db.pagos_plazos.reduce((a,p)=>a+(p.meses-p.meses_pagados),0);

  // Alerta rápida
  const hoy=new Date();
  const alertCount=activos.filter(p=>{
    const fBase=new Date(p.fecha); let next=new Date(fBase);
    while(next<=hoy) next.setMonth(next.getMonth()+1);
    return Math.ceil((next-hoy)/(864e5))<=15;
  }).length;

  // Top deudores
  const porDeudor={};
  activos.forEach(p=>{porDeudor[p.nombre]=(porDeudor[p.nombre]||0)+p.monto;});
  const topDeudores=Object.entries(porDeudor).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return(
    <div>
      <SectionTitle>Resumen ejecutivo — GONZA</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:16}}>
        {[
          {l:"Cartera activa prestada",v:fmt(totalCartera),c:C.navy,bg:C.navyLight,i:"💼"},
          {l:"Intereses por cobrar (mensual)",v:fmt(totalIntereses),c:"#8B6914",bg:C.goldLight,i:"📊"},
          {l:"Total ahorros del grupo",v:fmt(totalAhorros),c:C.green,bg:C.greenLight,i:"🏦"},
          {l:"Capital caja de ahorro",v:fmt(totalCaja),c:C.orange,bg:C.orangeLight,i:"💰"},
        ].map((s,i)=>(
          <Card key={i} style={{background:s.bg,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:28}}>{s.i}</span>
            <div>
              <p style={{margin:0,fontSize:11,color:C.oxford}}>{s.l}</p>
              <p style={{margin:"2px 0 0",fontSize:18,fontWeight:700,color:s.c}}>{s.v}</p>
            </div>
          </Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:C.oxford}}>Indicadores generales</p>
          {[
            ["Clientes registrados",db.clientes.length,C.navy],
            ["Préstamos activos",activos.length,C.orange],
            ["Préstamos pagados",pagados,C.green],
            ["Participantes caja ahorro",db.caja.length,C.navy],
            ["Artículos a plazos",db.pagos_plazos.length,C.oxford],
            ["Cuotas pendientes (plazos)",pendientesPlazos,C.red],
            ["Alertas de cobro (15 días)",alertCount,alertCount>0?C.red:C.green],
          ].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,padding:"6px 0",fontSize:12}}>
              <span style={{color:C.oxford}}>{l}</span>
              <span style={{fontWeight:700,color:c}}>{v}</span>
            </div>
          ))}
        </Card>
        <Card>
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:C.oxford}}>Top 5 deudores (monto activo)</p>
          {topDeudores.map(([nombre,monto],i)=>{
            const maxM=topDeudores[0][1]||1;
            return(
              <div key={nombre} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                  <span style={{color:C.oxford}}>{i+1}. {nombre}</span>
                  <span style={{fontWeight:700,color:C.navy}}>{fmt(monto)}</span>
                </div>
                <div style={{background:C.border,borderRadius:6,height:7}}>
                  <div style={{background:i===0?C.orange:C.navy,width:`${(monto/maxM)*100}%`,height:7,borderRadius:6}}/>
                </div>
              </div>
            );
          })}
          <div style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700}}>
              <span>Total cartera</span><span style={{color:C.navy}}>{fmt(totalCartera)}</span>
            </div>
          </div>
        </Card>
      </div>
      <Card>
        <p style={{margin:"0 0 8px",fontSize:13,fontWeight:700,color:C.oxford}}>Préstamos activos recientes</p>
        <Tabla
          headers={["Deudor","Fecha","Monto","Interés mensual","Nota"]}
          rows={[...activos].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).slice(0,10).map(p=>[
            p.nombre, p.fecha, fmt(p.monto), fmt(p.interes), p.nota||"—"
          ])}
        />
      </Card>
    </div>
  );
}

// MENÚ
const MENU=[
  {id:"resumen",     label:"Resumen",       icon:"📊"},
  {id:"clientes",    label:"Clientes",      icon:"👥"},
  {id:"prestamos",   label:"Préstamos",     icon:"💼"},
  {id:"ahorro",      label:"Ahorro",        icon:"🏦"},
  {id:"caja",        label:"Caja",          icon:"💰"},
  {id:"plazos",      label:"Pagos a plazos",icon:"📅"},
  {id:"alertas",     label:"Alertas",       icon:"🔔"},
];

export default function App(){
  const [db,dispatch]=useReducer(dbReducer,null,initDB);
  const [sec,setSec]=useState("resumen");
  const hoy=new Date();
  const nAlerts=db.prestamos.filter(p=>{
    if(p.pagado||!p.monto)return false;
    const fBase=new Date(p.fecha); let next=new Date(fBase);
    while(next<=hoy) next.setMonth(next.getMonth()+1);
    return Math.ceil((next-hoy)/(864e5))<=15;
  }).length;
  return(
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:C.lightGray,minHeight:"100vh"}}>
      <div style={{background:C.navy,padding:"0 20px",display:"flex",alignItems:"center",gap:14,height:56,boxShadow:"0 2px 6px rgba(0,0,0,.3)"}}>
        <Logo size={36}/>
        <div>
          <div style={{fontSize:16,fontWeight:800,letterSpacing:1.5,color:C.gold}}>GONZA</div>
          <div style={{fontSize:9,color:"#8fa8c8",letterSpacing:1,textTransform:"uppercase"}}>Sistema de administración de pagos</div>
        </div>
        <div style={{flex:1}}/>
        <div style={{fontSize:11,color:"#8fa8c8"}}>{new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
      </div>
      <div style={{display:"flex",minHeight:"calc(100vh - 56px)"}}>
        <nav style={{width:185,background:C.oxford,padding:"12px 0",flexShrink:0}}>
          {MENU.map(m=>{
            const active=sec===m.id;
            return(
              <button key={m.id} onClick={()=>setSec(m.id)} style={{
                display:"flex",alignItems:"center",gap:9,width:"100%",padding:"10px 16px",
                background:active?C.navy:"transparent",border:"none",
                borderLeft:active?`3px solid ${C.gold}`:"3px solid transparent",
                color:active?C.gold:"#b0bcd4",fontSize:13,fontWeight:active?700:400,
                cursor:"pointer",textAlign:"left",
              }}>
                <span style={{fontSize:15}}>{m.icon}</span>
                {m.label}
                {m.id==="alertas"&&nAlerts>0&&(
                  <span style={{marginLeft:"auto",background:C.red,color:C.white,fontSize:10,fontWeight:800,borderRadius:10,padding:"1px 6px"}}>{nAlerts}</span>
                )}
              </button>
            );
          })}
        </nav>
        <main style={{flex:1,padding:"20px 22px",overflowY:"auto"}}>
          {sec==="resumen"  &&<ModResumen     db={db}/>}
          {sec==="clientes" &&<ModClientes    db={db} dispatch={dispatch}/>}
          {sec==="prestamos"&&<ModPrestamos   db={db} dispatch={dispatch}/>}
          {sec==="ahorro"   &&<ModAhorro      db={db} dispatch={dispatch}/>}
          {sec==="caja"     &&<ModCaja        db={db} dispatch={dispatch}/>}
          {sec==="plazos"   &&<ModPagosPlazos db={db} dispatch={dispatch}/>}
          {sec==="alertas"  &&<ModAlertas     db={db}/>}
        </main>
      </div>
    </div>
  );
}
