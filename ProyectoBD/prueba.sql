BEGIN;
INSERT INTO areas (a_nombre, a_es_responsable) VALUES ('Mantenimiento', TRUE);
INSERT INTO categorias (id_area, c_nombre)
VALUES ((SELECT id_area FROM areas WHERE a_nombre = 'Mantenimiento'), 'Plomería');
INSERT INTO edificios (e_nombre) VALUES ('Edificio A');
INSERT INTO ubicaciones (id_edificio, ub_nombre)
VALUES ((SELECT id_edificio FROM edificios WHERE e_nombre = 'Edificio A'), 'Aula 1');
INSERT INTO incidencias (id_categoria, id_ubicacion, i_descripcion, i_modalidad_origen)
VALUES ((SELECT id_categoria FROM categorias LIMIT 1),
        (SELECT id_ubicacion FROM ubicaciones LIMIT 1),
        'Fuga de agua en la entrada del aula', 'Comunitario');
SELECT id_incidencia, i_codigo_seguimiento, i_estado_actual FROM incidencias;
SELECT id_incidencia, he_estado, id_usuario_encargado FROM historial_estados;
ROLLBACK;