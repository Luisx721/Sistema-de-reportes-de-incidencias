-- Catálogos de desarrollo para la API Rol 2. Seguro de volver a ejecutar.
-- Usa los nombres y relaciones del esquema oficial: areas, categorias,
-- edificios y ubicaciones. No elimina ni reemplaza registros existentes.

INSERT INTO areas(a_nombre,a_tipo,a_es_responsable)
VALUES ('Mantenimiento','Responsable',TRUE),
       ('Desarrollo Físico','Responsable',TRUE)
ON CONFLICT(a_nombre) DO NOTHING;

INSERT INTO categorias(id_area,c_nombre,c_descripcion)
SELECT a.id_area,x.nombre,'Categoría de reporte de incidencias'
FROM (VALUES ('Mantenimiento','Electricidad'),
             ('Mantenimiento','Mobiliario'),
             ('Mantenimiento','Agua y saneamiento'),
             ('Desarrollo Físico','Edificios'),
             ('Desarrollo Físico','Espacios comunes')) AS x(area,nombre)
JOIN areas a ON a.a_nombre=x.area
WHERE NOT EXISTS (SELECT 1 FROM categorias c WHERE c.c_nombre=x.nombre);

INSERT INTO edificios(e_nombre)
VALUES ('Edificio de Prueba'),
       ('Edificio de Aulas'),
       ('Biblioteca'),
       ('Edificio Administrativo'),
       ('Laboratorios'),
       ('Auditorio'),
       ('Cafetería'),
       ('Plaza Central')
ON CONFLICT(e_nombre) DO NOTHING;

INSERT INTO ubicaciones(id_edificio,ub_nombre,ub_tipo)
SELECT e.id_edificio,x.ubicacion,x.tipo
FROM (VALUES ('Edificio de Prueba','Aula 1','Interior'),
             ('Edificio de Aulas','Aula 1','Interior'),
             ('Edificio de Aulas','Pasillo principal','Interior'),
             ('Biblioteca','Sala de lectura','Interior'),
             ('Biblioteca','Acceso principal','Exterior'),
             ('Edificio Administrativo','Recepción','Interior'),
             ('Laboratorios','Laboratorio 1','Interior'),
             ('Auditorio','Acceso principal','Interior'),
             ('Cafetería','Comedor','Interior'),
             ('Plaza Central','Plaza','Exterior')) AS x(edificio,ubicacion,tipo)
JOIN edificios e ON e.e_nombre=x.edificio
WHERE NOT EXISTS (
    SELECT 1 FROM ubicaciones u
    WHERE u.id_edificio=e.id_edificio AND u.ub_nombre=x.ubicacion
);
