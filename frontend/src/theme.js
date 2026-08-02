// theme.js — Paleta de colores (claro/oscuro), fórmulas financieras y helpers de formato.
// C es un objeto MUTABLE a propósito: App.jsx cambia sus propiedades con Object.assign()
// al alternar el tema, y como es el mismo objeto en memoria, todos los archivos que lo
// importan ven el cambio automáticamente (así funciona el modo oscuro sin pasar el tema
// por props a cada componente).

export const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const C = {
  navy:"#0B1F4B", gold:"#C9A84C", orange:"#E87722", oxford:"#3B3B4F",
  white:"#FFFFFF", lightGray:"#F4F4F6", border:"#D4D4DC",
  goldLight:"#F5EDD3", navyLight:"#E8EDF5", orangeLight:"#FEF0E3",
  red:"#D93025", green:"#1A7F3C", redLight:"#FDE8E8", greenLight:"#E6F4EC",
  headerBg:"#0B1F4B", cardBg:"#FFFFFF", navBg:"#3B3B4F", rowAlt:"#F4F4F6",
};

// Paleta oscura — mismos nombres de clave (misma forma), valores distintos.
// Cada combinación texto/fondo fue verificada con la fórmula de contraste WCAG
// (relación mínima 4.5:1 para texto normal). headerBg se queda igual en ambos
// temas a propósito: la barra superior siempre es azul marino oscuro.
export const paletaClara = { ...C };
export const paletaOscura = {
  navy:"#E8ECF5", gold:"#C9A84C", orange:"#E87722", oxford:"#B8BDD4",
  white:"#FFFFFF", lightGray:"#10162A", border:"#2E3A5C",
  goldLight:"#3A331A", navyLight:"#1E2A4D", orangeLight:"#3D2313",
  red:"#F87171", green:"#4ADE80", redLight:"#3D1717", greenLight:"#123420",
  headerBg:"#0B1F4B", cardBg:"#1E2748", navBg:"#3B3B4F", rowAlt:"#161D38",
};

// ── HELPERS DE FORMATO ───────────────────────────────────────────────────────
export const fmt = n => n == null ? "—" :
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

// Convierte YYYY-MM-DD → DD/MM/AAAA para mostrar en pantalla
export const fmtFecha = f => {
  if (!f) return "—";
  const s = f.toString().substring(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return f;
  return `${d}/${m}/${y}`;
};

export const today = new Date().toISOString().split("T")[0];

// ── FÓRMULAS FINANCIERAS (con tests, ver App.test.js) ────────────────────────
// Tasa de interés mensual sobre préstamos: 10%
export const TASA_INTERES_MENSUAL = 0.10;

export function calcularInteresMensual(monto) {
  const m = parseFloat(monto);
  if (!m || m <= 0 || isNaN(m)) return 0;
  return Math.round(m * TASA_INTERES_MENSUAL * 100) / 100;
}

// Cuota mensual de un pago a plazos: costo total entre número de meses
export function calcularCuotaMensual(costo, meses) {
  const c = parseFloat(costo);
  const n = parseInt(meses, 10);
  if (!c || c <= 0 || isNaN(c) || !n || n <= 0 || isNaN(n)) return "";
  return (c / n).toFixed(2);
}
