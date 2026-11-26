-- Catálogos mínimos opcionales para desarrollo. No modifica registros existentes ni usuarios.
-- Aplicar a una base que ya tiene el esquema oficial y las áreas de desarrollo.
INSERT INTO areas(a_nombre,a_tipo,a_es_responsable)
VALUES ('Mantenimiento','Responsable',TRUE),('Desarrollo Físico','Responsable',TRUE)
ON CONFLICT(a_nombre) DO NOTHING;
INSERT INTO categorias(id_area,c_nombre,c_descripcion)
SELECT a.id_area,x.nombre,'Categoría de desarrollo'
FROM (VALUES ('Mantenimiento','Electricidad'),('Mantenimiento','Plomería'),
             ('Desarrollo Físico','Edificios'),('Desarrollo Físico','Espacios comunes')) AS x(area,nombre)
JOIN areas a ON a.a_nombre=x.area
WHERE NOT EXISTS (SELECT 1 FROM categorias c WHERE c.c_nombre=x.nombre);

-- Mantiene la ubicación usada por Probar-Recorrido-Rol2.ps1 si ya existe.
INSERT INTO edificios(e_nombre)
SELECT 'Edificio de Prueba'
WHERE NOT EXISTS (SELECT 1 FROM edificios WHERE e_nombre='Edificio de Prueba');
INSERT INTO ubicaciones(id_edificio,ub_nombre,ub_tipo)
SELECT e.id_edificio,'Aula 1','Interior'
FROM edificios e
WHERE e.e_nombre='Edificio de Prueba'
  AND NOT EXISTS (SELECT 1 FROM ubicaciones u WHERE u.id_edificio=e.id_edificio AND u.ub_nombre='Aula 1');
