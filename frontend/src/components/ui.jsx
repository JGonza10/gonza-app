// components/ui.jsx — Piezas de interfaz compartidas por todos los módulos (Card, Tabla, botones, etc.)
import { C } from "../theme";

// Logo pequeño (barra superior, menús)
export function Logo({ size = 40 }) {
  return (
    <img src="/logo-gonza-icon.png" alt="JGM Gonzas Systems" style={{ width: size, height: size, objectFit: "contain", borderRadius: 8 }}/>
  );
}

// Logo grande para la pantalla de login
export function LogoLogin() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <img src="/logo-gonza-login.jpg" alt="JGM Gonzas Systems" style={{ width: 220, maxWidth: "100%", objectFit: "contain" }}/>
    </div>
  );
}

export function Card({ children, style }) {
  return <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", ...style }}>{children}</div>;
}

export function SectionTitle({ children }) {
  return <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: C.navy, borderLeft: `4px solid ${C.gold}`, paddingLeft: 10 }}>{children}</h2>;
}

export function Badge({ children, color = C.navy, bg = C.navyLight }) {
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{children}</span>;
}

export function Inp({ label, ...p }) {
  return (
    <div style={{ marginBottom: 9 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: C.oxford, marginBottom: 3, fontWeight: 600 }}>{label}</label>}
      <input {...p} style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.navy, background: C.lightGray, boxSizing: "border-box", ...p.style }}/>
    </div>
  );
}

export function Sel({ label, children, ...p }) {
  return (
    <div style={{ marginBottom: 9 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: C.oxford, marginBottom: 3, fontWeight: 600 }}>{label}</label>}
      <select {...p} style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.navy, background: C.lightGray, boxSizing: "border-box" }}>{children}</select>
    </div>
  );
}

export function Btn({ children, onClick, color = C.navy, small, loading }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ background: loading ? "#aaa" : color, color: C.white, border: "none", borderRadius: 8, padding: small ? "4px 12px" : "8px 18px", fontSize: small ? 11 : 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
      {loading ? "..." : children}
    </button>
  );
}

export function Tabla({ headers, rows, empty = "Sin registros" }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: C.headerBg }}>{headers.map((h, i) => <th key={i} style={{ color: C.gold, padding: "7px 9px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ textAlign: "center", padding: 16, color: C.oxford }}>{empty}</td></tr>
            : rows.map((r, i) => <tr key={i} style={{ background: i % 2 === 0 ? C.cardBg : C.rowAlt }}>{r.map((c, j) => <td key={j} style={{ padding: "6px 9px", color: C.oxford, borderBottom: `1px solid ${C.border}` }}>{c}</td>)}</tr>)
          }
        </tbody>
      </table>
    </div>
  );
}
