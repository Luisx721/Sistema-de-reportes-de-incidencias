
-- FN_Generar_Codigo_Seguimiento: INC + año + número (ej. INC2026001)
CREATE SEQUENCE seq_codigo_seguimiento START 1;

CREATE OR REPLACE FUNCTION fn_generar_codigo_seguimiento() RETURNS VARCHAR AS $$
DECLARE
    v_seq BIGINT;
BEGIN
    v_seq := NEXTVAL('seq_codigo_seguimiento');
    RETURN 'INC' || TO_CHAR(CURRENT_DATE, 'YYYY')
           || LPAD(v_seq::TEXT, GREATEST(3, LENGTH(v_seq::TEXT)), '0');
END;
$$ LANGUAGE plpgsql;

-- Ahora el código se genera solo al insertar una incidencia
ALTER TABLE incidencias
    ALTER COLUMN i_codigo_seguimiento SET DEFAULT fn_generar_codigo_seguimiento();

-- FN_Validar_Limite_Fotografias: TRUE si aún caben fotos (menos de 3)
CREATE FUNCTION fn_validar_limite_fotografias(p_id_incidencia INT) RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM fotografias WHERE id_incidencia = p_id_incidencia) < 3;
END;
$$ LANGUAGE plpgsql;

-- TRG_Historial_Estado_Insert: primer registro 'Recibido' al crear una incidencia
CREATE FUNCTION trg_fn_historial_estado_insert() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO historial_estados (id_incidencia, id_usuario_encargado, he_estado, he_observacion)
    VALUES (NEW.id_incidencia, NULL, 'Recibido', 'Reporte recibido y registrado por el sistema.');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historial_estado_insert
AFTER INSERT ON incidencias
FOR EACH ROW EXECUTE FUNCTION trg_fn_historial_estado_insert();

-- TRG_Actualizar_Fecha_Incidencia: sincroniza estado, fecha y cierre
CREATE FUNCTION trg_fn_actualizar_fecha_incidencia() RETURNS TRIGGER AS $$
BEGIN
    -- El registro inicial automático (sin usuario) no modifica la incidencia
    IF NEW.id_usuario_encargado IS NULL THEN
        RETURN NEW;
    END IF;

    UPDATE incidencias
    SET i_estado_actual = NEW.he_estado,
        i_fecha_actualizacion = CURRENT_TIMESTAMP,
        i_fecha_cierre = CASE
            WHEN NEW.he_estado IN ('Resuelto', 'Rechazado/Cerrado') THEN CURRENT_TIMESTAMP
            ELSE i_fecha_cierre
        END
    WHERE id_incidencia = NEW.id_incidencia;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_fecha_incidencia
AFTER INSERT ON historial_estados
FOR EACH ROW EXECUTE FUNCTION trg_fn_actualizar_fecha_incidencia();

-- TRG_Auditoria_Incidencias_Update: registra los cambios en AUDITORIA
-- La API indica quién actúa con: SET LOCAL app.id_usuario = '<id>';
-- Si no lo indica, el evento queda como 'SISTEMA'.
CREATE FUNCTION trg_fn_auditoria_incidencias_update() RETURNS TRIGGER AS $$
DECLARE
    v_usuario INT;
BEGIN
    v_usuario := NULLIF(current_setting('app.id_usuario', TRUE), '')::INT;

    INSERT INTO auditoria (id_usuario, au_origen, au_tabla, au_id_registro,
                           au_accion, au_valor_anterior, au_valor_nuevo)
    VALUES (v_usuario,
            CASE WHEN v_usuario IS NULL THEN 'SISTEMA' ELSE 'USUARIO' END,
            'incidencias', NEW.id_incidencia, 'UPDATE',
            TO_JSONB(OLD)::TEXT, TO_JSONB(NEW)::TEXT);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_incidencias_update
AFTER UPDATE ON incidencias
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION trg_fn_auditoria_incidencias_update();