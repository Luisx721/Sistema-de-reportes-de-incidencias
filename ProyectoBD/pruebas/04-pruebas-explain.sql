-- Conteo total e indices activos en la tabla incidencias
SELECT count(*) AS total_incidencias FROM incidencias;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'incidencias'
ORDER BY indexname;

ANALYZE incidencias;

-- Consulta 1: Rango de 30 dias
EXPLAIN (ANALYZE, BUFFERS)
SELECT i_codigo_seguimiento, i_estado_actual, i_fecha_creacion
FROM incidencias
WHERE i_estado_actual = 'Recibido'
  AND i_fecha_creacion >= current_date - interval '30 days'
ORDER BY i_fecha_creacion DESC;

-- Consulta 2: Rango de 1 dia (comparacion de volumen y plan)
EXPLAIN (ANALYZE, BUFFERS)
SELECT i_codigo_seguimiento, i_estado_actual, i_fecha_creacion
FROM incidencias
WHERE i_estado_actual = 'Recibido'
  AND i_fecha_creacion >= current_date - interval '1 day'
ORDER BY i_fecha_creacion DESC;
