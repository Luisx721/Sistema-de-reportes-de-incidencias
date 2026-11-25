-- FN_Registrar_Incidencia: detecta duplicados abiertos con bloqueo
CREATE OR REPLACE FUNCTION fn_registrar_incidencia(
    p_id_usuario          INT,
    p_id_categoria        INT,
    p_id_ubicacion        INT,
    p_id_area_solicitante INT,
    p_reportante_nombre   VARCHAR,
    p_reportante_vinculo  VARCHAR,
    p_descripcion         TEXT,
    p_urgencia            VARCHAR,
    p_modalidad           VARCHAR
) RETURNS TABLE (o_id_incidencia INT, o_codigo VARCHAR, o_es_duplicado BOOLEAN) AS $$
DECLARE
    v_id     INT;
    v_codigo VARCHAR;
BEGIN
    -- Serializa los reportes de la misma categoría + ubicación
    PERFORM pg_advisory_xact_lock(p_id_categoria, p_id_ubicacion);

    SELECT i.id_incidencia, i.i_codigo_seguimiento
      INTO v_id, v_codigo
      FROM incidencias i
     WHERE i.id_categoria = p_id_categoria
       AND i.id_ubicacion = p_id_ubicacion
       AND i.i_estado_actual NOT IN ('Resuelto', 'Rechazado/Cerrado')
     ORDER BY i.i_fecha_creacion
     LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_id, v_codigo, TRUE;
        RETURN;
    END IF;

    INSERT INTO incidencias (id_usuario, id_categoria, id_ubicacion, id_area_solicitante,
                             i_reportante_nombre, i_reportante_vinculo, i_descripcion,
                             i_urgencia, i_modalidad_origen)
    VALUES (p_id_usuario, p_id_categoria, p_id_ubicacion, p_id_area_solicitante,
            p_reportante_nombre, p_reportante_vinculo, p_descripcion,
            p_urgencia, p_modalidad)
    RETURNING incidencias.id_incidencia, incidencias.i_codigo_seguimiento
      INTO v_id, v_codigo;

    RETURN QUERY SELECT v_id, v_codigo, FALSE;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION fn_cambiar_estado_incidencia(
    p_id_incidencia INT,
    p_id_usuario    INT,
    p_nuevo_estado  VARCHAR,
    p_observacion   TEXT
) RETURNS TABLE (o_resultado VARCHAR, o_id_historial INT, o_estado_actual VARCHAR) AS $$
DECLARE
    v_estado  VARCHAR;
    v_id_hist INT;
BEGIN
    -- Bloquea la fila: otro cambio sobre la misma incidencia espera aquí
    SELECT i.i_estado_actual INTO v_estado
      FROM incidencias i
     WHERE i.id_incidencia = p_id_incidencia
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'NO_EXISTE'::VARCHAR, NULL::INT, NULL::VARCHAR;
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = p_id_usuario AND u_activo) THEN
        RETURN QUERY SELECT 'USUARIO_INVALIDO'::VARCHAR, NULL::INT, v_estado;
        RETURN;
    END IF;

    IF v_estado IN ('Resuelto', 'Rechazado/Cerrado') THEN
        RETURN QUERY SELECT 'YA_CERRADA'::VARCHAR, NULL::INT, v_estado;
        RETURN;
    END IF;

    IF v_estado = p_nuevo_estado THEN
        RETURN QUERY SELECT 'MISMO_ESTADO'::VARCHAR, NULL::INT, v_estado;
        RETURN;
    END IF;

    -- Para que la auditoría sepa quién hizo el cambio
    PERFORM set_config('app.id_usuario', p_id_usuario::TEXT, TRUE);

    INSERT INTO historial_estados (id_incidencia, id_usuario_encargado, he_estado, he_observacion)
    VALUES (p_id_incidencia, p_id_usuario, p_nuevo_estado, p_observacion)
    RETURNING historial_estados.id_historial INTO v_id_hist;

    RETURN QUERY SELECT 'OK'::VARCHAR, v_id_hist, p_nuevo_estado;
END;
$$ LANGUAGE plpgsql;