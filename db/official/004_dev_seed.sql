-- Datos de desarrollo repetibles. Ejecutar con psql y -v rol2_password_hash='<hash PBKDF2>'
-- El valor debe venir de la herramienta local solicitar-clave.ps1; no almacenar secretos aquí.
INSERT INTO rol(r_nombre,r_descripcion) VALUES
 ('Administrador','Administración'),('Autoridad','Autoridad institucional'),('Jefatura','Jefatura de área'),
 ('Ordenanza','Personal de reporte'),('Mantenimiento','Equipo de mantenimiento'),('Desarrollo Físico','Equipo de desarrollo físico')
ON CONFLICT(r_nombre) DO UPDATE SET r_activo=TRUE;
INSERT INTO areas(a_nombre,a_tipo,a_es_responsable) VALUES
 ('Mantenimiento','Responsable',TRUE),('Desarrollo Físico','Responsable',TRUE),('Administración','Solicitante',FALSE)
ON CONFLICT(a_nombre) DO UPDATE SET a_activo=TRUE;
INSERT INTO categorias(id_area,c_nombre,c_descripcion)
SELECT a.id_area,x.nombre,'Categoría mínima para desarrollo' FROM (VALUES ('Mantenimiento','Electricidad'),('Mantenimiento','Plomería'),('Desarrollo Físico','Edificios'),('Desarrollo Físico','Espacios comunes')) x(area,nombre) JOIN areas a ON a.a_nombre=x.area
ON CONFLICT(c_nombre) DO UPDATE SET c_activo=TRUE;
INSERT INTO edificios(e_nombre) VALUES ('Edificio de Prueba') ON CONFLICT(e_nombre) DO UPDATE SET e_activo=TRUE;
INSERT INTO ubicaciones(id_edificio,ub_nombre,ub_tipo)
SELECT e.id_edificio,'Aula 1','Interior' FROM edificios e WHERE e.e_nombre='Edificio de Prueba'
AND NOT EXISTS(SELECT 1 FROM ubicaciones u WHERE u.id_edificio=e.id_edificio AND u.ub_nombre='Aula 1');
-- Cuenta técnico: password hash PBKDF2 SHA-256 en formato pbkdf2$210000$base64(salt)$base64(hash).
INSERT INTO usuarios(id_rol,id_area,u_nombre,u_correo,u_password,u_vinculo,u_correo_verificado,u_activo)
SELECT r.id_rol,a.id_area,'Técnico de Desarrollo','tecnico.dev@local.test',:'rol2_password_hash','Personal Administrativo',TRUE,TRUE
FROM rol r CROSS JOIN areas a WHERE r.r_nombre='Desarrollo Físico' AND a.a_nombre='Desarrollo Físico'
ON CONFLICT(u_correo) DO UPDATE SET u_password=EXCLUDED.u_password,u_activo=TRUE,id_rol=EXCLUDED.id_rol,id_area=EXCLUDED.id_area;
