-- 04-pruebas-explain.sql
-- Evidencia de planes de ejecucion y rendimiento de indices (Rol 1 - BD)

SELECT COUNT(*) AS total_registros_incidencias FROM incidencias;

-- 1. Filtro por estado especifico (idx_incidencias_estado)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id_incidencia, i_codigo_seguimiento, i_estado_actual, i_urgencia, i_fecha_creacion
FROM incidencias
WHERE i_estado_actual = 'Recibido'
ORDER BY i_fecha_creacion DESC;

-- 2. Filtro por rango de fechas (idx_incidencias_fecha_creacion)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id_incidencia, i_codigo_seguimiento, i_estado_actual, i_prioridad, i_fecha_creacion
FROM incidencias
WHERE i_fecha_creacion >= TIMESTAMP '2026-08-10 00:00:00'
  AND i_fecha_creacion <  TIMESTAMP '2026-08-13 00:00:00'
ORDER BY i_fecha_creacion DESC;

-- 3. Consulta combinada con JOIN a catalogos, fecha y estado
EXPLAIN (ANALYZE, BUFFERS)
SELECT i.id_incidencia, i.i_codigo_seguimiento, c.c_nombre AS categoria,
       e.e_nombre AS edificio, u.ub_nombre AS ubicacion,
       i.i_estado_actual, i.i_urgencia, i.i_fecha_creacion
FROM incidencias i
JOIN categorias c ON c.id_categoria = i.id_categoria
JOIN ubicaciones u ON u.id_ubicacion = i.id_ubicacion
JOIN edificios e ON e.id_edificio = u.id_edificio
WHERE i.i_fecha_creacion >= TIMESTAMP '2026-09-01 00:00:00'
  AND i.i_fecha_creacion <  TIMESTAMP '2026-09-05 00:00:00'
  AND i.i_estado_actual = 'En proceso';

-- 4. Busqueda puntual por codigo de seguimiento (incidencias_i_codigo_seguimiento_key)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id_incidencia, i_codigo_seguimiento, i_estado_actual, i_urgencia, i_fecha_creacion
FROM incidencias
WHERE i_codigo_seguimiento = 'INC20262500';

/*
RESULTADOS DE EJECUCION (EXPLAIN ANALYZE, BUFFERS):
 total_registros_incidencias 
-----------------------------
                        5000
(1 row)

                                                               QUERY PLAN                                                                
-----------------------------------------------------------------------------------------------------------------------------------------
 Sort  (cost=176.83..177.45 rows=250 width=40) (actual time=0.304..0.315 rows=250 loops=1)
   Sort Key: i_fecha_creacion DESC
   Sort Method: quicksort  Memory: 38kB
   Buffers: shared hit=157
   ->  Bitmap Heap Scan on incidencias  (cost=6.22..166.87 rows=250 width=40) (actual time=0.082..0.216 rows=250 loops=1)
         Recheck Cond: ((i_estado_actual)::text = 'Recibido'::text)
         Heap Blocks: exact=152
         Buffers: shared hit=154
         ->  Bitmap Index Scan on idx_incidencias_estado  (cost=0.00..6.16 rows=250 width=0) (actual time=0.034..0.034 rows=254 loops=1)
               Index Cond: ((i_estado_actual)::text = 'Recibido'::text)
               Buffers: shared hit=2
 Planning:
   Buffers: shared hit=33 read=1
 Planning Time: 0.194 ms
 Execution Time: 0.381 ms
(15 rows)

                                                                              QUERY PLAN                                                                              
----------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Index Scan Backward using idx_incidencias_fecha_creacion on incidencias  (cost=0.28..11.72 rows=72 width=40) (actual time=0.007..0.022 rows=72 loops=1)
   Index Cond: ((i_fecha_creacion >= '2026-08-10 00:00:00'::timestamp without time zone) AND (i_fecha_creacion < '2026-08-13 00:00:00'::timestamp without time zone))
   Buffers: shared hit=6
 Planning:
   Buffers: shared hit=10
 Planning Time: 0.115 ms
 Execution Time: 0.031 ms
(7 rows)

                                                                                    QUERY PLAN                                                                                    
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Nested Loop  (cost=0.58..28.59 rows=14 width=894) (actual time=0.043..0.072 rows=15 loops=1)
   Buffers: shared hit=11
   ->  Nested Loop  (cost=0.43..21.88 rows=14 width=680) (actual time=0.031..0.055 rows=15 loops=1)
         Join Filter: (i.id_ubicacion = u.id_ubicacion)
         Buffers: shared hit=9
         ->  Nested Loop  (cost=0.14..9.26 rows=1 width=640) (actual time=0.016..0.017 rows=1 loops=1)
               Buffers: shared hit=3
               ->  Seq Scan on ubicaciones u  (cost=0.00..1.01 rows=1 width=226) (actual time=0.006..0.006 rows=1 loops=1)
                     Buffers: shared hit=1
               ->  Index Scan using edificios_pkey on edificios e  (cost=0.14..8.16 rows=1 width=422) (actual time=0.009..0.009 rows=1 loops=1)
                     Index Cond: (id_edificio = u.id_edificio)
                     Buffers: shared hit=2
         ->  Index Scan using idx_incidencias_fecha_creacion on incidencias i  (cost=0.28..12.44 rows=14 width=48) (actual time=0.014..0.034 rows=15 loops=1)
               Index Cond: ((i_fecha_creacion >= '2026-09-01 00:00:00'::timestamp without time zone) AND (i_fecha_creacion < '2026-09-05 00:00:00'::timestamp without time zone))
               Filter: ((i_estado_actual)::text = 'En proceso'::text)
               Rows Removed by Filter: 81
               Buffers: shared hit=6
   ->  Memoize  (cost=0.15..3.31 rows=1 width=222) (actual time=0.001..0.001 rows=1 loops=15)
         Cache Key: i.id_categoria
         Cache Mode: logical
         Hits: 14  Misses: 1  Evictions: 0  Overflows: 0  Memory Usage: 1kB
         Buffers: shared hit=2
         ->  Index Scan using categorias_pkey on categorias c  (cost=0.14..3.30 rows=1 width=222) (actual time=0.007..0.008 rows=1 loops=1)
               Index Cond: (id_categoria = i.id_categoria)
               Buffers: shared hit=2
 Planning:
   Buffers: shared hit=200 dirtied=1
 Planning Time: 0.896 ms
 Execution Time: 0.137 ms
(29 rows)

                                                                    QUERY PLAN                                                                     
---------------------------------------------------------------------------------------------------------------------------------------------------
 Index Scan using incidencias_i_codigo_seguimiento_key on incidencias  (cost=0.28..8.30 rows=1 width=40) (actual time=0.011..0.012 rows=1 loops=1)
   Index Cond: ((i_codigo_seguimiento)::text = 'INC20262500'::text)
   Buffers: shared hit=3
 Planning Time: 0.032 ms
 Execution Time: 0.018 ms
(5 rows)

*/
