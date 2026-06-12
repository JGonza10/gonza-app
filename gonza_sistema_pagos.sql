-- =============================================================
--  GONZA - Sistema de Administración de Pagos
--  Base de datos estructurada en SQL (compatible con PostgreSQL / MySQL)
--  Generado desde: gonza_sistema_pagos.jsx
-- =============================================================

-- ---------------------------------------------------------------
-- 0. LIMPIEZA (útil en desarrollo / re-importación)
-- ---------------------------------------------------------------
DROP TABLE IF EXISTS pagos_plazos;
DROP TABLE IF EXISTS caja;
DROP TABLE IF EXISTS ahorros;
DROP TABLE IF EXISTS prestamos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS tipos_pago;

-- =============================================================
-- 1. TABLA: tipos_pago  (catálogo auxiliar)
--    Almacena los métodos de pago permitidos en el sistema.
-- =============================================================
CREATE TABLE tipos_pago (
    id      SERIAL       PRIMARY KEY,
    nombre  VARCHAR(50)  NOT NULL UNIQUE   -- 'transferencia', 'efectivo', 'cheque', etc.
);

INSERT INTO tipos_pago (nombre) VALUES
    ('transferencia'),
    ('efectivo'),
    ('cheque'),
    ('tarjeta');


-- =============================================================
-- 2. TABLA: clientes
--    Personas registradas en el sistema.
--    Se usa como catálogo central de identidades.
-- =============================================================
CREATE TABLE clientes (
    id             SERIAL        PRIMARY KEY,
    nombre         VARCHAR(100)  NOT NULL,
    apellido_pat   VARCHAR(60)   NOT NULL,
    apellido_mat   VARCHAR(60),
    telefono       VARCHAR(20),
    direccion      VARCHAR(255),
    activo         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsqueda rápida por nombre
CREATE INDEX idx_clientes_nombre ON clientes (apellido_pat, apellido_mat, nombre);

-- Datos iniciales del sistema
INSERT INTO clientes (id, nombre, apellido_pat, apellido_mat, telefono, direccion, activo) VALUES
    (1, 'JUAN',           'GONZALEZ', 'MENDOZA',  NULL, NULL, TRUE),
    (2, 'ERIK ARMANDO',   'GONZALEZ', 'RAMIREZ',  NULL, NULL, TRUE),
    (3, 'PAVEL EMILIANO', 'GONZALEZ', 'RAMIREZ',  NULL, NULL, TRUE),
    (4, 'JUANA IGNACIA',  'RAMIREZ',  'ALVAREZ',  NULL, NULL, TRUE);


-- =============================================================
-- 3. TABLA: prestamos
--    Cada fila representa un préstamo otorgado.
--    El campo deudor_nombre se mantiene libre (texto) porque
--    en el sistema original los préstamos se manejan sin
--    FK estricta al catálogo de clientes (personas externas
--    pueden recibir préstamos sin ser clientes registrados).
-- =============================================================
CREATE TABLE prestamos (
    id              SERIAL          PRIMARY KEY,
    deudor_nombre   VARCHAR(150)    NOT NULL,           -- nombre libre del deudor
    cliente_id      INT             REFERENCES clientes(id) ON DELETE SET NULL,
                                                        -- FK opcional: si el deudor es cliente registrado
    fecha_prestamo  DATE            NOT NULL,
    monto           NUMERIC(12,2)   NOT NULL DEFAULT 0,
    interes_mensual NUMERIC(12,2)   NOT NULL DEFAULT 0, -- interés acordado por mes
    nota            TEXT,
    pagado          BOOLEAN         NOT NULL DEFAULT FALSE,
    fecha_pago      DATE,                               -- fecha en que se saldó
    tipo_pago_id    INT             REFERENCES tipos_pago(id) ON DELETE SET NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Restricción: si está pagado, debe tener fecha de pago
    CONSTRAINT chk_pago_fecha CHECK (
        (pagado = FALSE) OR (pagado = TRUE AND fecha_pago IS NOT NULL)
    )
);

CREATE INDEX idx_prestamos_deudor ON prestamos (deudor_nombre);
CREATE INDEX idx_prestamos_estado ON prestamos (pagado);
CREATE INDEX idx_prestamos_fecha  ON prestamos (fecha_prestamo);

INSERT INTO prestamos
    (id, deudor_nombre, fecha_prestamo, monto, interes_mensual, nota, pagado, fecha_pago, tipo_pago_id)
VALUES
    (1,  'ARACELI SANCHEZ',  '2025-01-01', 7000,  700,  NULL,                              FALSE, NULL,         NULL),
    (2,  'ANGELES',          '2025-03-30', 1000,  100,  NULL,                              FALSE, NULL,         NULL),
    (3,  'AIDE',             '2026-08-20', 1000,  100,  NULL,                              FALSE, NULL,         NULL),
    (4,  'AIDE',             '2025-09-28', 1000,  100,  NULL,                              FALSE, NULL,         NULL),
    (5,  'RAMÓN MEJÍA',      '2025-09-30', 15000, 1500, NULL,                              FALSE, NULL,         NULL),
    (6,  'ARACELI SANCHEZ',  '2025-11-12', 2000,  200,  NULL,                              FALSE, NULL,         NULL),
    (7,  'JESSICA',          '2025-12-31', 0,     0,    'SE CAMBIO AL 26 CON UNA SOLA CUENTA', FALSE, NULL,     NULL),
    (8,  'GUSTAVO CABRERA',  '2025-12-31', 500,   50,   NULL,                              FALSE, NULL,         NULL),
    (9,  'ARACELI SANCHEZ',  '2026-01-02', 6000,  600,  NULL,                              FALSE, NULL,         NULL),
    (10, 'LARISA',           '2026-01-15', 500,   50,   NULL,                              FALSE, NULL,         NULL),
    (11, 'CLAUDIA',          '2026-01-20', 15000, 1500, NULL,                              FALSE, NULL,         NULL),
    (12, 'LARISA',           '2026-01-15', 3000,  300,  NULL,                              FALSE, NULL,         NULL),
    (13, 'NORMA',            '2026-01-22', 2000,  200,  NULL,                              FALSE, NULL,         NULL),
    (14, 'ANA GONZALEZ',     '2026-01-23', 5000,  500,  NULL,                              FALSE, NULL,         NULL),
    (15, 'ALMA RAMIREZ',     '2026-01-24', 1000,  100,  NULL,                              FALSE, NULL,         NULL),
    (16, 'GUSTAVO CABRERA',  '2026-01-27', 5000,  500,  NULL,                              FALSE, NULL,         NULL),
    (17, 'JESSICA',          '2026-02-05', 0,     0,    NULL,                              FALSE, NULL,         NULL),
    (18, 'ARACELI SANCHEZ',  '2026-02-06', 1000,  100,  NULL,                              FALSE, NULL,         NULL),
    (19, 'ARACELI SANCHEZ',  '2026-02-07', 1500,  150,  NULL,                              FALSE, NULL,         NULL),
    (20, 'MIRIAM PÉREZ',     '2026-02-12', 5000,  500,  NULL,                              FALSE, NULL,         NULL),
    (21, 'JUANA RAMIREZ',    '2026-02-18', 12300, 0,    NULL,                              FALSE, NULL,         NULL),
    (22, 'JESSICA',          '2026-02-19', 3000,  300,  NULL,                              FALSE, NULL,         NULL),
    (23, 'ANGELES sobrina',  '2026-02-26', 0,     0,    'PAGADO EL DIA 04/05/2026',        TRUE,  '2026-05-04', 1),
    (24, 'SILVIA',           '2026-02-27', 5000,  500,  NULL,                              FALSE, NULL,         NULL),
    (25, 'CLAUDIA',          '2026-02-28', 60000, 6000, NULL,                              FALSE, NULL,         NULL),
    (26, 'ARACELI SANCHEZ',  '2026-03-01', 10000, 1000, 'JOSEFINA 20000',                  FALSE, NULL,         NULL),
    (27, 'ANGELES',          '2026-03-03', 3000,  300,  NULL,                              FALSE, NULL,         NULL),
    (28, 'ARACELI RAMIREZ',  '2026-03-07', 0,     0,    '11/04/2026 PAGADO',               TRUE,  '2026-05-04', 1),
    (29, 'ARACELI RAMIREZ',  '2026-03-10', 3000,  300,  NULL,                              FALSE, NULL,         NULL),
    (30, 'SAMANTHA',         '2026-03-12', 3000,  300,  NULL,                              FALSE, NULL,         NULL),
    (31, 'ARACELI SANCHEZ',  '2026-03-19', 3500,  350,  NULL,                              FALSE, NULL,         NULL),
    (32, 'JESSICA',          '2026-03-26', 50000, 0,    'SE CAMBIO AL 26 CON UNA SOLA CUENTA', FALSE, NULL,     NULL),
    (33, 'ANA GONZALEZ',     '2026-03-19', 5000,  500,  NULL,                              FALSE, NULL,         NULL),
    (34, 'RAMÓN MEJÍA',      '2026-03-19', 5500,  550,  NULL,                              FALSE, NULL,         NULL),
    (35, 'ALMA RAMIREZ',     '2026-04-06', 1000,  100,  NULL,                              FALSE, NULL,         NULL),
    (36, 'ANGELES sobrina',  '2026-04-08', 0,     0,    'PAGADO EL DIA 04/05/2026',        TRUE,  '2026-05-04', 1),
    (37, 'LARISA',           '2026-04-15', 3500,  350,  NULL,                              FALSE, NULL,         NULL),
    (38, 'ARACELI SANCHEZ',  '2026-04-22', 1000,  100,  NULL,                              FALSE, NULL,         NULL),
    (39, 'SAMANTHA',         '2026-04-27', 1000,  100,  NULL,                              FALSE, NULL,         NULL),
    (40, 'ANGELES sobrina',  '2026-05-05', 12000, 1200, NULL,                              FALSE, NULL,         NULL),
    (41, 'SAMANTHA',         '2026-05-08', 5000,  500,  NULL,                              FALSE, NULL,         NULL),
    (42, 'ARACELI SANCHEZ',  '2026-05-09', 0,     0,    'PAGADO EL DIA 04/06/2026',        TRUE,  '2026-06-04', 1),
    (43, 'ANGELES',          '2026-05-27', 10000, 1000, NULL,                              FALSE, NULL,         NULL),
    (44, 'ANGELES',          '2026-06-06', 10000, 1000, NULL,                              FALSE, NULL,         NULL);


-- =============================================================
-- 4. TABLA: ahorros
--    Saldo de ahorro por integrante (socios internos).
--    Cada registro corresponde a uno de los clientes registrados.
-- =============================================================
CREATE TABLE ahorros (
    id          SERIAL          PRIMARY KEY,
    cliente_id  INT             NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    cantidad    NUMERIC(12,2)   NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_ahorros_cliente ON ahorros (cliente_id);  -- un registro por cliente

INSERT INTO ahorros (cliente_id, cantidad) VALUES
    (1, 800),
    (2, 5000),
    (3, 5000),
    (4, 3800);


-- =============================================================
-- 5. TABLA: caja
--    Participantes de la "caja" o tanda grupal de ahorro.
--    No necesariamente son clientes registrados (personas externas).
-- =============================================================
CREATE TABLE caja (
    id           SERIAL          PRIMARY KEY,
    participante VARCHAR(120)    NOT NULL,   -- nombre libre del participante
    cliente_id   INT             REFERENCES clientes(id) ON DELETE SET NULL,
                                             -- FK opcional si es cliente registrado
    cuota        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    capital      NUMERIC(12,2)   NOT NULL DEFAULT 0,  -- monto total acumulado/esperado
    fecha_inicio VARCHAR(20),                -- 'dd-mmm' como viene del sistema original
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_caja_participante ON caja (participante);

INSERT INTO caja (id, participante, cuota, capital, fecha_inicio) VALUES
    (1,  'JUANA',           200,   2000,  '15-ene'),
    (2,  'ARACELI RAMIREZ', 200,   2400,  '15-dic'),
    (3,  'JUANA ALVAREZ',   500,   6000,  '15-dic'),
    (4,  'ANGELES',         2600,  26000, '15-ene'),
    (5,  'ALMA',            1000,  14000, '15-dic'),
    (6,  'NATIVIDAD',       1400,  16800, '15-dic'),
    (7,  'CLAUDIA FLORES',  1250,  15000, '15-dic'),
    (8,  'LIZBETH',         1000,  11000, '30-dic'),
    (9,  'NORMA',           1000,  12000, '15-dic'),
    (10, 'JESSICA',         1000,  10000, '15-ene'),
    (11, 'SILVIA',          3000,  33000, '30-dic'),
    (12, 'GUSTAVO',         400,   4800,  '15-dic'),
    (13, 'RAMÓN',           1000,  12000, '15-dic'),
    (14, 'ANA',             400,   4000,  '15-ene'),
    (15, 'SAMANTHA',        400,   4000,  '15-ene'),
    (16, 'LARISA',          200,   2400,  '15-dic'),
    (17, 'ESTELA RAMIREZ',  500,   6000,  '15-mar');


-- =============================================================
-- 6. TABLA: pagos_plazos
--    Artículos vendidos o financiados en abonos/meses.
-- =============================================================
CREATE TABLE pagos_plazos (
    id              SERIAL          PRIMARY KEY,
    material        VARCHAR(150)    NOT NULL,       -- nombre del bien financiado
    costo           NUMERIC(12,2),                  -- costo total (puede ser NULL si se desconoce)
    meses_total     INT             NOT NULL,        -- número total de meses pactados
    meses_pagados   INT             NOT NULL DEFAULT 0,
    cuota           NUMERIC(12,2),                  -- pago mensual acordado
    abonado         NUMERIC(12,2)   NOT NULL DEFAULT 0,  -- total pagado hasta hoy
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_meses CHECK (meses_pagados <= meses_total),
    CONSTRAINT chk_abonado CHECK (abonado >= 0)
);

INSERT INTO pagos_plazos (id, material, costo, meses_total, meses_pagados, cuota, abonado) VALUES
    (1, 'Moto',          9000,  18, 6,  500,    3000),
    (2, 'Celular Juana', 3000,  15, 4,  200,    800),
    (3, 'Estufa',        NULL,  18, 11, NULL,   NULL),   -- datos pendientes de captura
    (4, 'Parrilla',      2640,  15, 5,  176,    880),
    (5, 'Botas',         1850,  6,  0,  308.33, 0);


-- =============================================================
-- 7. VISTAS ÚTILES
-- =============================================================

-- Préstamos activos (sin pagar) con monto e interés > 0
CREATE OR REPLACE VIEW v_prestamos_activos AS
SELECT
    p.id,
    p.deudor_nombre,
    p.fecha_prestamo,
    p.monto,
    p.interes_mensual,
    p.nota,
    -- Días transcurridos desde el préstamo
    CURRENT_DATE - p.fecha_prestamo AS dias_transcurridos,
    -- Interés acumulado estimado (meses completos × interés mensual)
    FLOOR((CURRENT_DATE - p.fecha_prestamo) / 30.0) * p.interes_mensual AS interes_acumulado
FROM prestamos p
WHERE p.pagado = FALSE
  AND p.monto > 0
ORDER BY p.fecha_prestamo;

-- Cartera total por deudor
CREATE OR REPLACE VIEW v_cartera_por_deudor AS
SELECT
    deudor_nombre,
    COUNT(*)                AS num_prestamos,
    SUM(monto)              AS total_prestado,
    SUM(interes_mensual)    AS interes_mensual_total
FROM prestamos
WHERE pagado = FALSE AND monto > 0
GROUP BY deudor_nombre
ORDER BY total_prestado DESC;

-- Resumen general del sistema
CREATE OR REPLACE VIEW v_resumen AS
SELECT
    (SELECT COALESCE(SUM(monto), 0)     FROM prestamos WHERE pagado = FALSE) AS cartera_activa,
    (SELECT COALESCE(SUM(cantidad), 0)  FROM ahorros)                         AS total_ahorros,
    (SELECT COALESCE(SUM(capital), 0)   FROM caja)                            AS total_caja,
    (SELECT COUNT(*)                    FROM prestamos WHERE pagado = FALSE AND monto > 0) AS prestamos_pendientes,
    (SELECT COUNT(*)                    FROM prestamos WHERE pagado = TRUE)   AS prestamos_cobrados;

-- =============================================================
-- FIN DEL SCRIPT
-- =============================================================
