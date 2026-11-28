# Solo para la base local midb del proyecto.
$ErrorActionPreference = 'Stop'
$container = 'sistema-de-reportes-de-incidencias'
$backupName = 'midb-antes-de-limpieza-' + [guid]::NewGuid().ToString('N') + '.dump'
$backup = Join-Path ([Environment]::GetFolderPath('MyDocuments')) $backupName
docker exec $container pg_dump -U reportes -d midb -Fc -f "/tmp/$backupName"
if ($LASTEXITCODE -ne 0) { throw 'Fallo el respaldo. Se cancela la limpieza.' }
docker cp "${container}:/tmp/$backupName" $backup
if ($LASTEXITCODE -ne 0) { throw 'No se pudo guardar el respaldo local.' }
Write-Host "Respaldo guardado en $backup"
$secret = Read-Host 'Clave de pruebas para las cuentas NUEVAS (10 caracteres minimo)' -AsSecureString
if ($secret.Length -lt 10) { throw 'La clave debe tener al menos 10 caracteres.' }
function New-PasswordHash($secure) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $salt = New-Object byte[] 16
    try { $rng.GetBytes($salt) } finally { $rng.Dispose() }
    $kdf = [Security.Cryptography.Rfc2898DeriveBytes]::new($plain,$salt,210000,[Security.Cryptography.HashAlgorithmName]::SHA256)
    try { return 'pbkdf2$210000$' + [Convert]::ToBase64String($salt) + '$' + [Convert]::ToBase64String($kdf.GetBytes(32)) }
    finally { $kdf.Dispose(); $plain = $null }
}
$sql = @'
BEGIN;
LOCK TABLE rol, areas, usuarios, categorias, incidencias IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE nombres (alias text PRIMARY KEY, correcto text) ON COMMIT DROP;
INSERT INTO nombres VALUES
 ('Desarrollo F?sico', U&'Desarrollo F\00EDsico'), ('Desarrollo F??sico', U&'Desarrollo F\00EDsico'),
 ('Administraci?n', U&'Administraci\00F3n'), ('Administraci??n', U&'Administraci\00F3n');
CREATE TEMP TABLE area_map ON COMMIT DROP AS
 SELECT x.id_area viejo,y.id_area bueno FROM areas x JOIN nombres n ON n.alias=x.a_nombre
 JOIN areas y ON y.a_nombre=n.correcto;
CREATE TEMP TABLE rol_map ON COMMIT DROP AS
 SELECT x.id_rol viejo,y.id_rol bueno FROM rol x JOIN nombres n ON n.alias=x.r_nombre
 JOIN rol y ON y.r_nombre=n.correcto;
UPDATE categorias c SET id_area=m.bueno FROM area_map m WHERE c.id_area=m.viejo;
UPDATE usuarios u SET id_area=m.bueno FROM area_map m WHERE u.id_area=m.viejo;
UPDATE incidencias i SET id_area_solicitante=m.bueno FROM area_map m WHERE i.id_area_solicitante=m.viejo;
UPDATE usuarios u SET id_rol=m.bueno FROM rol_map m WHERE u.id_rol=m.viejo;
DELETE FROM areas a USING area_map m WHERE a.id_area=m.viejo;
DELETE FROM rol r USING rol_map m WHERE r.id_rol=m.viejo;
-- Conservar la categoria mas utilizada minimiza las escrituras sobre expedientes.
CREATE TEMP TABLE plom ON COMMIT DROP AS
 SELECT c.id_categoria, count(i.id_incidencia) usos FROM categorias c JOIN areas a USING(id_area)
 LEFT JOIN incidencias i USING(id_categoria)
 WHERE c.c_nombre IN ('Plomer?a','Plomer??a',U&'Plomer\00EDa') AND a.a_nombre='Mantenimiento'
 GROUP BY c.id_categoria;
CREATE TEMP TABLE elegida ON COMMIT DROP AS SELECT id_categoria FROM plom ORDER BY usos DESC,id_categoria LIMIT 1;
UPDATE incidencias i SET id_categoria=e.id_categoria FROM plom p,elegida e
 WHERE i.id_categoria=p.id_categoria AND p.id_categoria<>e.id_categoria;
DELETE FROM categorias c USING plom p,elegida e WHERE c.id_categoria=p.id_categoria AND p.id_categoria<>e.id_categoria;
UPDATE categorias c SET c_nombre=U&'Plomer\00EDa',c_activo=true FROM elegida e WHERE c.id_categoria=e.id_categoria;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM categorias WHERE c_nombre LIKE 'Plom%' AND c_nombre<>U&'Plomer\00EDa')
 OR NOT EXISTS(SELECT 1 FROM elegida)
 OR EXISTS(SELECT 1 FROM areas WHERE a_nombre LIKE 'Desarrollo F%' AND a_nombre<>U&'Desarrollo F\00EDsico'
 OR a_nombre LIKE 'Administraci%' AND a_nombre<>U&'Administraci\00F3n')
 OR EXISTS(SELECT 1 FROM rol WHERE r_nombre LIKE 'Desarrollo F%' AND r_nombre<>U&'Desarrollo F\00EDsico')
 THEN RAISE EXCEPTION 'Variante imprevista en catalogos. Se revierte la operacion.'; END IF;
END $$;
CREATE TEMP TABLE cuentas(correo text PRIMARY KEY,perfil text,area text,hash text) ON COMMIT DROP;
'@
foreach ($row in @(
    @('admin.dev','Administrador',"U&'Administraci\00F3n'"),
    @('autoridad.dev','Autoridad','NULL'),
    @('jefatura.dev','Jefatura',"U&'Administraci\00F3n'"),
    @('ordenanza.dev','Ordenanza',"U&'Administraci\00F3n'"),
    @('mant.dev','Mantenimiento',"'Mantenimiento'"),
    @('tecnico.dev','Desarrollo F\00EDsico',"U&'Desarrollo F\00EDsico'")
)) {
    $hash = New-PasswordHash $secret
    $sql += "`nINSERT INTO cuentas VALUES ('$($row[0])@local.test', U&'$($row[1])', $($row[2]), '$hash');"
}
$secret.Dispose()
$sql += @'

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM cuentas c LEFT JOIN rol r ON r.r_nombre=c.perfil AND r.r_activo
 LEFT JOIN areas a ON a.a_nombre=c.area AND a.a_activo
 WHERE r.id_rol IS NULL OR (c.area IS NOT NULL AND a.id_area IS NULL))
 THEN RAISE EXCEPTION 'Falta un rol o area activa. Se revierte la operacion.'; END IF;
 IF EXISTS(SELECT 1 FROM cuentas c JOIN usuarios u ON u.u_correo=c.correo JOIN rol r USING(id_rol)
 WHERE r.r_nombre<>c.perfil)
 THEN RAISE EXCEPTION 'Correo de prueba ocupado por otro perfil.'; END IF;
END $$;
INSERT INTO usuarios(id_rol,id_area,u_nombre,u_correo,u_password,u_vinculo,u_correo_verificado,u_activo)
SELECT r.id_rol,a.id_area,c.perfil || ' de prueba',c.correo,c.hash,'Personal Administrativo',true,true
FROM cuentas c JOIN rol r ON r.r_nombre=c.perfil LEFT JOIN areas a ON a.a_nombre=c.area
ON CONFLICT(u_correo) DO UPDATE SET u_activo=true,u_correo_verificado=true;
SELECT c.c_nombre,count(i.id_incidencia) AS reportes FROM categorias c LEFT JOIN incidencias i USING(id_categoria)
GROUP BY c.id_categoria ORDER BY c.c_nombre;
SELECT r.r_nombre,u.u_correo,u.u_activo FROM usuarios u JOIN rol r USING(id_rol) JOIN cuentas c ON c.correo=u.u_correo ORDER BY r.r_nombre;
COMMIT;
'@
$sql | docker exec -i $container psql -X -q -v ON_ERROR_STOP=1 -U reportes -d midb
if ($LASTEXITCODE -ne 0) { throw 'No se completo la transaccion. Ver el error de PostgreSQL.' }
Write-Host 'Listo. Las cuentas existentes conservan su clave.'
