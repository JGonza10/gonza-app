// Tests de las fórmulas financieras de Sistema GONZA.
// Se corren con: npm test  (Jest ya viene incluido con Create React App, no requiere instalar nada)
import { calcularInteresMensual, calcularCuotaMensual, fmt, fmtFecha } from "./theme";

describe("calcularInteresMensual (10% mensual sobre préstamos)", () => {
  test("calcula el 10% correctamente sobre un monto normal", () => {
    expect(calcularInteresMensual(10000)).toBe(1000);
  });

  test("redondea correctamente a 2 decimales (evita errores de punto flotante)", () => {
    expect(calcularInteresMensual(333.33)).toBe(33.33);
    expect(calcularInteresMensual(10.1)).toBe(1.01);
  });

  test("acepta el monto como string (así llega desde un <input>)", () => {
    expect(calcularInteresMensual("5000")).toBe(500);
  });

  test("devuelve 0 si el monto es 0, vacío, negativo o inválido", () => {
    expect(calcularInteresMensual(0)).toBe(0);
    expect(calcularInteresMensual("")).toBe(0);
    expect(calcularInteresMensual(-100)).toBe(0);
    expect(calcularInteresMensual("abc")).toBe(0);
    expect(calcularInteresMensual(null)).toBe(0);
    expect(calcularInteresMensual(undefined)).toBe(0);
  });

  test("maneja montos grandes sin errores de precisión", () => {
    expect(calcularInteresMensual(1000000)).toBe(100000);
  });
});

describe("calcularCuotaMensual (pagos a plazos: costo / meses)", () => {
  test("divide el costo entre los meses correctamente", () => {
    expect(calcularCuotaMensual(1200, 12)).toBe("100.00");
  });

  test("redondea a 2 decimales cuando no es exacto", () => {
    expect(calcularCuotaMensual(1000, 3)).toBe("333.33");
  });

  test("acepta strings, tal como llegan desde el formulario", () => {
    expect(calcularCuotaMensual("600", "6")).toBe("100.00");
  });

  test("devuelve cadena vacía si falta costo, meses, o son inválidos/negativos", () => {
    expect(calcularCuotaMensual("", 12)).toBe("");
    expect(calcularCuotaMensual(1200, "")).toBe("");
    expect(calcularCuotaMensual(0, 12)).toBe("");
    expect(calcularCuotaMensual(1200, 0)).toBe("");
    expect(calcularCuotaMensual(-500, 12)).toBe("");
    expect(calcularCuotaMensual("abc", 12)).toBe("");
  });
});

describe("fmt (formato de moneda MXN)", () => {
  test("formatea números como pesos mexicanos", () => {
    expect(fmt(1000)).toBe("$1,000.00");
    expect(fmt(1500.5)).toBe("$1,500.50");
  });

  test("devuelve un guion largo para valores nulos/indefinidos", () => {
    expect(fmt(null)).toBe("—");
    expect(fmt(undefined)).toBe("—");
  });

  test("formatea correctamente el cero (no debe confundirse con nulo)", () => {
    expect(fmt(0)).toBe("$0.00");
  });
});

describe("fmtFecha (YYYY-MM-DD -> DD/MM/AAAA)", () => {
  test("convierte una fecha ISO al formato mexicano", () => {
    expect(fmtFecha("2026-08-01")).toBe("01/08/2026");
  });

  test("funciona con fechas que incluyen hora (las recorta)", () => {
    expect(fmtFecha("2026-08-01T00:00:00.000Z")).toBe("01/08/2026");
  });

  test("devuelve un guion largo si la fecha es nula o vacía", () => {
    expect(fmtFecha(null)).toBe("—");
    expect(fmtFecha("")).toBe("—");
  });
});
