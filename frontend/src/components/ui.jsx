// components/ui.jsx — Sistema GONZA
// Piezas compartidas por todos los módulos, con el lenguaje visual de Chicos Wheels.
//
// La firma de cada componente es IDÉNTICA a la versión anterior, así que App.jsx
// no necesita cambios. Lo que cambia es la implementación: ahora se apoya en las
// clases de estilos.css en vez de estilos inline sueltos.

import { C } from "../theme";

/* ── LOGO ──────────────────────────────────────────────────────────────────── */

export function Logo({ size = 40 }) {
  return (
    <img src="/gonza-systems.png" alt="JGM Gonzas Systems"
      style={{ width: size, height: size, objectFit: "contain", borderRadius: 8 }}/>
  );
}

export function LogoLogin() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <img src="/login.png" alt="JGM Gonzas Systems"
        style={{ width: 220, maxWidth: "100%", objectFit: "contain" }}/>
    </div>
  );
}

/* ── SUPERFICIES ───────────────────────────────────────────────────────────── */

// Nota: onClick se reenvía a propósito. App.jsx ya pasaba esa prop (tarjetas del
// resumen que navegan a su sección), pero la versión anterior de Card la ignoraba
// silenciosamente, así que esas tarjetas se veían clickeables y no hacían nada.
export function Card({ children, style, onClick }) {
  return (
    <div className="pnl" style={style} onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => (e.key === "Enter" || e.key === " ") && onClick(e) : undefined}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }) {
  return (
    <div className="sec">
      <h2>{children}</h2>
      <div className="ln"/>
    </div>
  );
}

/* ── KPI: la pieza con borde luminoso ──────────────────────────────────────── */
// tono: "blue" | "yellow" | "green" | "red" | "purple" | "orange" | "cyan"

export function Kpis({ children }) {
  return <div className="kpis">{children}</div>;
}

export function Kpi({ etiqueta, valor, nota, tono = "blue", onClick }) {
  return (
    <div className="kpi"
      style={{ "--c": `var(--${tono})`, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => (e.key === "Enter" || e.key === " ") && onClick() : undefined}>
      <div className="k">{etiqueta}</div>
      <div className="v">{valor}</div>
      {nota && <div className="s">{nota}</div>}
    </div>
  );
}

/* ── ETIQUETAS DE ESTADO ───────────────────────────────────────────────────── */
// Badge conserva la firma vieja (color/bg) para no romper llamadas existentes,
// pero si le pasas `tono` usa el estilo nuevo de borde tenue.

const TONO_CLASE = {
  [C.green]: "g", [C.gold]: "y", [C.red]: "r", [C.blue]: "b", [C.purple]: "p",
  verde: "g", amarillo: "y", rojo: "r", azul: "b", morado: "p",
};

export function Badge({ children, color = C.navy, bg = C.navyLight, tono }) {
  const clase = tono ? TONO_CLASE[tono] : TONO_CLASE[color];
  if (clase) return <span className={`tag ${clase}`}>{children}</span>;
  return <span className="tag" style={{ color, background: bg, borderColor: "transparent" }}>{children}</span>;
}

/* ── CONTROLES DE FORMULARIO ───────────────────────────────────────────────── */

export function Inp({ label, ...p }) {
  return (
    <div className="fld">
      {label && <label className="lbl">{label}</label>}
      <input {...p} className="in"/>
    </div>
  );
}

export function Sel({ label, children, ...p }) {
  return (
    <div className="fld">
      {label && <label className="lbl">{label}</label>}
      <select {...p} className="sel">{children}</select>
    </div>
  );
}

/* ── BOTONES ───────────────────────────────────────────────────────────────── */
// Los degradados de Chicos Wheels son claros, así que el verde y el amarillo
// llevan texto oscuro (no blanco). Esta tabla resuelve eso automáticamente a
// partir del color que ya le pasa App.jsx.

const BTN_CLASE = {
  [C.navy]:   "pri",
  [C.blue]:   "pri",
  [C.green]:  "grn",
  [C.gold]:   "yel",
  [C.orange]: "nar",
  [C.red]:    "dgr",
};

export function Btn({ children, onClick, color = C.navy, small, loading, tipo, ...p }) {
  const clase = tipo || BTN_CLASE[color];
  // App.jsx pasa colores hexadecimales sueltos (ej. #6B46C1, #8B6914) que no
  // están en la tabla; para esos se arma el mismo look de contorno en línea.
  const estilo = clase ? undefined : { background: "transparent", borderColor: color, color };
  return (
    <button {...p} onClick={onClick} disabled={loading || p.disabled}
      style={{ ...estilo, ...p.style }}
      className={`btn ${clase || ""}${small ? " sm" : ""}`}>
      {loading ? "…" : children}
    </button>
  );
}

/* ── TABLA ─────────────────────────────────────────────────────────────────── */
// Novedad: las celdas que contienen un importe se alinean a la derecha y se
// pintan en monoespaciada con tabular-nums, para que las columnas de dinero
// cuadren dígito con dígito. Se detecta por el "$" y por el tipo number.

const esImporte = v =>
  typeof v === "number" ||
  (typeof v === "string" && /^\s*-?\$?[\d,]+(\.\d+)?\s*%?\s*$/.test(v));

export function Tabla({ headers, rows, empty = "Sin registros" }) {
  return (
    <div className="wrap">
      <table className="tbl">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td className="vacio" colSpan={headers.length}>{empty}</td></tr>
            : rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={esImporte(c) ? "num mn" : undefined}>{c}</td>
                  ))}
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  );
}

/* ── MODAL ─────────────────────────────────────────────────────────────────── */
// Reemplaza los overlays hechos a mano dentro de App.jsx. Cierra con Escape
// y con clic en el fondo.

export function Modal({ titulo, sub, onClose, children, acciones, ancho }) {
  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && onClose?.()}
      role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="md" style={ancho ? { maxWidth: ancho } : undefined}>
        <header>
          <h3>{titulo}</h3>
          {sub && <span className="sub">{sub}</span>}
          <button className="btn gh sm" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div className="bdy">{children}</div>
        {acciones && <footer>{acciones}</footer>}
      </div>
    </div>
  );
}

/* ── CARGA ─────────────────────────────────────────────────────────────────── */

export function Cargando({ texto = "Cargando…" }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
      <div className="spin"/>
      {texto}
    </div>
  );
}
