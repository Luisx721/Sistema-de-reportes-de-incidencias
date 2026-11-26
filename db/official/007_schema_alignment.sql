-- Alineación de esquema para bases existentes. Script idempotente.
-- Aplicar después de 006_views.sql.
-- No convierte TIMESTAMP a TIMESTAMPTZ: esa decisión afecta a la API y queda fuera de este paso.

-- 1. Documentación de columnas clave (sin cambiar tipos ni nulabilidad).
COMMENT ON COLUMN incidencias.i_codigo_seguimiento IS
    'Código único de seguimiento: VARCHAR(15), mínimo 8 caracteres, generado por secuencia (INC + año + consecutivo).';
COMMENT ON COLUMN incidencias.i_urgencia IS
    'Urgencia percibida por el reportante (RF-06). Opcional y distinta de i_prioridad.';
COMMENT ON COLUMN incidencias.i_fecha_cierre IS
    'Fecha de cierre; se mantiene coherente con el estado mediante trg_normalizar_fecha_cierre.';

-- 2. Fecha de cierre coherente con el estado, incluso si se actualiza la incidencia
--    sin pasar por historial_estados (por ejemplo, un UPDATE directo del backend clásico).
CREATE OR REPLACE FUNCTION fn_normalizar_fecha_cierre() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.i_estado_actual IN ('Resuelto', 'Rechazado/Cerrado') THEN
        IF NEW.i_fecha_cierre IS NULL THEN
            NEW.i_fecha_cierre := CURRENT_TIMESTAMP;
        END IF;
    ELSE
        NEW.i_fecha_cierre := NULL;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_normalizar_fecha_cierre ON incidencias;
CREATE TRIGGER trg_normalizar_fecha_cierre
BEFORE INSERT OR UPDATE ON incidencias
FOR EACH ROW EXECUTE FUNCTION fn_normalizar_fecha_cierre();

-- 3. Restricciones de coherencia de la fecha de cierre.
--    NOT VALID evita que una base histórica con datos inconsistentes bloquee la migración;
--    la validación se intenta y, si falla, se informa sin revertir el resto del script.
ALTER TABLE incidencias DROP CONSTRAINT IF EXISTS ck_incidencias_cierre_estado;
ALTER TABLE incidencias ADD CONSTRAINT ck_incidencias_cierre_estado
CHECK (
    (i_estado_actual IN ('Resuelto', 'Rechazado/Cerrado') AND i_fecha_cierre IS NOT NULL)
    OR
    (i_estado_actual NOT IN ('Resuelto', 'Rechazado/Cerrado') AND i_fecha_cierre IS NULL)
) NOT VALID;

DO $$
BEGIN
    ALTER TABLE incidencias VALIDATE CONSTRAINT ck_incidencias_cierre_estado;
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ck_incidencias_cierre_estado queda NOT VALID: hay filas historicas inconsistentes';
END $$;

ALTER TABLE incidencias DROP CONSTRAINT IF EXISTS ck_incidencias_fecha_cierre_orden;
ALTER TABLE incidencias ADD CONSTRAINT ck_incidencias_fecha_cierre_orden
CHECK (i_fecha_cierre IS NULL OR i_fecha_cierre >= i_fecha_creacion) NOT VALID;

DO $$
BEGIN
    ALTER TABLE incidencias VALIDATE CONSTRAINT ck_incidencias_fecha_cierre_orden;
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ck_incidencias_fecha_cierre_orden queda NOT VALID: hay fechas de cierre anteriores a la creacion';
END $$;

-- 4. Una ubicación no debe repetirse dentro del mismo edificio.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_ubicaciones_edificio_nombre'
          AND conrelid = 'ubicaciones'::regclass
    ) THEN
        IF EXISTS (
            SELECT 1 FROM ubicaciones
            GROUP BY id_edificio, ub_nombre
            HAVING COUNT(*) > 1
        ) THEN
            RAISE NOTICE 'No se crea uq_ubicaciones_edificio_nombre: hay ubicaciones duplicadas por edificio';
        ELSE
            ALTER TABLE ubicaciones
                ADD CONSTRAINT uq_ubicaciones_edificio_nombre UNIQUE (id_edificio, ub_nombre);
        END IF;
    END IF;
END $$;

-- 5. Una única fuente para el evento inicial: solo el trigger puede crear el
--    'Recibido' automático (actor nulo), y como máximo una vez por incidencia.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'uq_historial_recibido_inicial'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM historial_estados
            WHERE he_estado = 'Recibido' AND id_usuario_encargado IS NULL
            GROUP BY id_incidencia
            HAVING COUNT(*) > 1
        ) THEN
            RAISE NOTICE 'No se crea uq_historial_recibido_inicial: hay eventos iniciales duplicados';
        ELSE
            CREATE UNIQUE INDEX uq_historial_recibido_inicial
                ON historial_estados(id_incidencia)
                WHERE he_estado = 'Recibido' AND id_usuario_encargado IS NULL;
        END IF;
    END IF;
END $$;

-- 6. Validación de fotos con bloqueo de fila. El llamador debe estar dentro de una
--    transacción para que el FOR UPDATE serialice cargas concurrentes.
CREATE OR REPLACE FUNCTION fn_validar_limite_fotografias(p_id_incidencia INT) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_existe BOOLEAN;
BEGIN
    SELECT TRUE INTO v_existe
      FROM incidencias
     WHERE id_incidencia = p_id_incidencia
       FOR UPDATE;

    IF v_existe IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN (SELECT COUNT(*) FROM fotografias WHERE id_incidencia = p_id_incidencia) < 3;
END $$;

COMMENT ON FUNCTION fn_validar_limite_fotografias(INT) IS
    'TRUE si la incidencia existe y tiene menos de 3 fotos. Bloquea la fila de incidencia con FOR UPDATE; llamar dentro de una transacción.';

-- 7. Índices para filtros y estadísticas por fecha (RF-15, RF-21).
CREATE INDEX IF NOT EXISTS idx_incidencias_fecha_creacion ON incidencias(i_fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_incidencias_fecha_cierre ON incidencias(i_fecha_cierre);
