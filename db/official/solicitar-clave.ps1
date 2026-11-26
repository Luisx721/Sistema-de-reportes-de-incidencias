$ErrorActionPreference = 'Stop'
$secure = Read-Host 'Contraseña local para tecnico.dev@local.test' -AsSecureString
if ($secure.Length -lt 10) { throw 'Usa al menos 10 caracteres.' }

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

$salt = New-Object byte[] 16
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($salt) }
finally { $rng.Dispose() }

$derive = [System.Security.Cryptography.Rfc2898DeriveBytes]::new($plain, $salt, 210000, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
try { $hash = $derive.GetBytes(32) }
finally { $derive.Dispose(); $plain = $null }

$encoded = 'pbkdf2$210000$' + [Convert]::ToBase64String($salt) + '$' + [Convert]::ToBase64String($hash)
$container = 'sistema-de-reportes-de-incidencias'

docker cp db/official/004_dev_seed.sql "$container`:/tmp/004_dev_seed.sql"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo transferir la semilla.' }

docker exec $container psql -v ON_ERROR_STOP=1 -v "rol2_password_hash=$encoded" -U reportes -d midb -f /tmp/004_dev_seed.sql
if ($LASTEXITCODE -ne 0) { throw 'La semilla de desarrollo falló.' }

$encoded = $null; $hash = $null; $salt = $null; $secure.Dispose()
