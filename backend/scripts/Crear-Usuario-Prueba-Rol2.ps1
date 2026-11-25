param(
  [string]$Username = 'tecnico.rol2',
  [string]$Name = 'Técnico de prueba Rol 2',
  [ValidateSet('Mantenimiento','Desarrollo Físico')]
  [string]$Profile = 'Mantenimiento',
  [string]$Area = ''
)
$ErrorActionPreference = 'Stop'
$secure = Read-Host 'Contraseña temporal (no se guarda en archivos)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$salt = New-Object byte[] 16
$rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
$rng.GetBytes($salt)
$derive = New-Object Security.Cryptography.Rfc2898DeriveBytes($password, $salt, 210000, [Security.Cryptography.HashAlgorithmName]::SHA256)
$derived = $derive.GetBytes(32)
$hexHash = [BitConverter]::ToString($derived).Replace('-', '')
$hexSalt = [BitConverter]::ToString($salt).Replace('-', '')
$env:PGPASSWORD = if ($env:ROL2_DB_PASSWORD) { $env:ROL2_DB_PASSWORD } else { 'rol2_dev_local' }
$escapedUser = $Username.Replace("'", "''")
$escapedName = $Name.Replace("'", "''")
$escapedProfile = $Profile.Replace("'", "''")
$escapedArea = $Area.Replace("'", "''")
try {
  docker exec -e PGPASSWORD="$env:PGPASSWORD" incidencias-rol2-postgres psql -v ON_ERROR_STOP=1 -U rol2_app -d incidencias_rol2 -c "INSERT INTO app_users(usuario,nombre,perfil,area,password_hash,password_salt) VALUES ('$escapedUser','$escapedName','$escapedProfile',NULLIF('$escapedArea',''),decode('$hexHash','hex'),decode('$hexSalt','hex')) ON CONFLICT(usuario) DO UPDATE SET nombre=EXCLUDED.nombre,perfil=EXCLUDED.perfil,area=EXCLUDED.area,password_hash=EXCLUDED.password_hash,password_salt=EXCLUDED.password_salt,activo=true;"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo insertar el usuario de prueba.' }
  Write-Host "Usuario provisional '$Username' creado/actualizado con perfil $Profile."
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue; $password=$null; $secure=$null; $derive.Dispose(); $rng.Dispose() }
