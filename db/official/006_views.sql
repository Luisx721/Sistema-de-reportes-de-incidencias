-- Vistas oficiales del sistema. Aplicar después de 003_rol2_versions.sql.
-- Uso interno: VW_Listado_incidencias incluye identidad del reportante.
-- El seguimiento público no debe consultar esta vista sin ocultar/filtrar esos campos.

CREATE OR REPLACE VIEW VW_Listado_incidencias AS
SELECT
    i.id_incidencia,
    i.i_codigo_seguimiento,
    i.i_descripcion,
    i.i_urgencia,
    i.i_prioridad,
    i.i_estado_actual,
    i.i_modalidad_origen,
    i.i_fecha_creacion,
    i.i_fecha_actualizacion,
    i.i_fecha_cierre,
    i.id_categoria,
    c.c_nombre AS categoria,
    c.id_area AS id_area_responsable,
    ar.a_nombre AS area_responsable,
    i.id_ubicacion,
    u.ub_nombre AS ubicacion,
    u.ub_tipo AS tipo_ubicacion,
    e.id_edificio,
    e.e_nombre AS edificio,
    i.id_area_solicitante,
    asol.a_nombre AS area_solicitante,
    i.id_usuario,
    us.u_nombre AS usuario_registro,
    i.i_reportante_nombre,
    i.i_reportante_vinculo,
    COALESCE(v.version, 1) AS version
FROM incidencias i
JOIN categorias c ON c.id_categoria = i.id_categoria
JOIN areas ar ON ar.id_area = c.id_area
JOIN ubicaciones u ON u.id_ubicacion = i.id_ubicacion
JOIN edificios e ON e.id_edificio = u.id_edificio
LEFT JOIN areas asol ON asol.id_area = i.id_area_solicitante
LEFT JOIN usuarios us ON us.id_usuario = i.id_usuario
LEFT JOIN rol2_incident_versions v ON v.id_incidencia = i.id_incidencia;

COMMENT ON VIEW VW_Listado_incidencias IS
    'Listado interno con joins de incidencia, categoría, área responsable, ubicación, edificio y usuario. Contiene identidad del reportante: no usar en respuestas públicas.';

CREATE OR REPLACE VIEW VW_Reporte_Estadistico_Categorias AS
SELECT
    c.id_categoria,
    c.c_nombre AS categoria,
    c.c_activo,
    ar.a_nombre AS area_responsable,
    COUNT(i.id_incidencia) AS total,
    COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Recibido') AS recibido,
    COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'En proceso') AS en_proceso,
    COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'En espera de materiales/autorización') AS en_espera,
    COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Resuelto') AS resuelto,
    COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Rechazado/Cerrado') AS rechazado_cerrado,
    COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Recibido')
        / NULLIF(COUNT(i.id_incidencia), 0), 2), 0) AS pct_recibido,
    COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'En proceso')
        / NULLIF(COUNT(i.id_incidencia), 0), 2), 0) AS pct_en_proceso,
    COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'En espera de materiales/autorización')
        / NULLIF(COUNT(i.id_incidencia), 0), 2), 0) AS pct_en_espera,
    COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Resuelto')
        / NULLIF(COUNT(i.id_incidencia), 0), 2), 0) AS pct_resuelto,
    COALESCE(ROUND(100.0 * COUNT(i.id_incidencia) FILTER (WHERE i.i_estado_actual = 'Rechazado/Cerrado')
        / NULLIF(COUNT(i.id_incidencia), 0), 2), 0) AS pct_rechazado_cerrado
FROM categorias c
JOIN areas ar ON ar.id_area = c.id_area
LEFT JOIN incidencias i ON i.id_categoria = c.id_categoria
GROUP BY c.id_categoria, c.c_nombre, c.c_activo, ar.a_nombre;

COMMENT ON VIEW VW_Reporte_Estadistico_Categorias IS
    'Conteo por categoría de los cinco estados y porcentajes con división protegida (total cero => 0). Incluye categorías sin incidencias.';
