// theme.js — Sistema GONZA
//
// CAMBIO IMPORTANTE respecto a la versión anterior:
// C ya NO es un objeto mutable con hexadecimales. Ahora cada clave devuelve una
// variable CSS (definida en estilos.css). El tema se cambia poniendo el atributo
// data-tema en <html>, no reasignando propiedades de C.
//
// Beneficios:
//   · Desaparece el hack de Object.assign(C, ...) y su dependencia frágil de que
//     ningún componente use React.memo. Ya puedes memoizar libremente.
//   · El cambio de tema es instantáneo y aplica también a los elementos que se
//     estilizan por clase CSS (.pnl, .btn, .tbl…), no solo a los estilos inline.
//   · Las transiciones entre temas las maneja el navegador.
//
// Las 18 claves originales se conservan con el MISMO nombre, así que las 380+
// referencias existentes en App.jsx siguen funcionando sin tocarlas.

export const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const C = {
  // ── Claves heredadas (no renombrar: App.jsx depende de ellas) ─────────────
  navy:        "var(--text)",       // color de texto principal / marca
  gold:        "var(--yellow)",     // acento
  orange:      "var(--orange)",
  oxford:      "var(--muted)",      // texto secundario
  white:       "#FFFFFF",
  lightGray:   "var(--bg)",         // fondo de página
  border:      "var(--line)",
  goldLight:   "var(--tint-yellow)",
  navyLight:   "var(--tint-blue)",
  orangeLight: "var(--tint-orange)",
  red:         "var(--red)",
  green:       "var(--green)",
  redLight:    "var(--tint-red)",
  greenLight:  "var(--tint-green)",
  headerBg:    "var(--panel)",
  cardBg:      "var(--panel)",
  navBg:       "var(--panel2)",
  rowAlt:      "var(--panel2)",

  // ── Claves nuevas del sistema Chicos Wheels ───────────────────────────────
  blue:   "var(--blue)",
  blue2:  "var(--blue2)",
  cyan:   "var(--cyan)",
  yellow: "var(--yellow)",
  purple: "var(--purple)",
  panel:  "var(--panel)",
  panel2: "var(--panel2)",
  raise:  "var(--raise)",
  line:   "var(--line)",
  line2:  "var(--line2)",
  muted:  "var(--muted)",
  muted2: "var(--muted2)",
  campo:  "var(--campo)",
  grad:   "var(--grad)",
  mono:   "var(--m)",
};

/**
 * Aplica el tema. Llamar desde App.jsx en lugar de Object.assign(C, ...).
 * @param {"claro"|"oscuro"} tema
 */
export function aplicarTema(tema) {
  document.documentElement.setAttribute("data-tema", tema);
  localStorage.setItem("gonza_tema", tema);
  // La barra de estado del móvil (PWA) también cambia
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", tema === "claro" ? "#F2F5FA" : "#0A1120");
}

export const temaGuardado = () => localStorage.getItem("gonza_tema") || "oscuro";

/**
 * Resuelve una variable CSS a su hexadecimal real.
 *
 * OJO — esto es necesario para recharts: los atributos de presentación SVG
 * (fill, stroke) no resuelven var() de forma confiable en todos los navegadores.
 * Donde hoy escribes  <Bar fill={C.green}/>  cámbialo por  <Bar fill={hex(C.green)}/>.
 */
export function hex(varCss) {
  if (typeof varCss !== "string" || !varCss.startsWith("var(")) return varCss;
  const nombre = varCss.slice(4, -1).trim();
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre);
  return valor.trim() || "#888";
}

// Paleta fija para series de gráficas (recharts). Hexadecimales literales
// porque van directo a atributos SVG y deben verse bien en ambos temas.
export const SERIES = ["#2E9BF0", "#FFD84D", "#2ED573", "#A78BFA", "#FF8A3D", "#38D6F0", "#FF4B4B"];

// ── HELPERS DE FORMATO (sin cambios) ─────────────────────────────────────────
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

// ── FÓRMULAS FINANCIERAS (sin cambios, ver App.test.js) ──────────────────────
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
