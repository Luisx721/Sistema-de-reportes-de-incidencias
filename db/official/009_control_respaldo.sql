CREATE OR REPLACE PROCEDURE sp_control_respaldo(
    OUT reportes bigint,
    OUT fotos bigint,
    OUT eventos bigint
)
LANGUAGE SQL AS $$
    SELECT (SELECT count(*) FROM incidencias),
           (SELECT count(*) FROM fotografias),
           (SELECT count(*) FROM historial_estados);
$$;
