param([string]$BackupDir = "", [string]$Contenedor = "sistema-de-reportes-de-incidencias", [string]$BaseDestino = "midb_restaurada", [string]$Usuario = "reportes", [string]$RutaFotosRestauradas = "backend\Incidencias.Api\uploads\fotos_restauradas", [string]$CarpetaBackups = "ProyectoBD\backups")
$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
if ([string]::IsNullOrWhiteSpace($BackupDir)) { $ultimo = Get-ChildItem -Path $CarpetaBackups -Directory -Filter "backup_*" -ErrorAction Stop | Sort-Object Name -Descending | Select-Object -First 1; if (-not $ultimo) { throw "No se encontraron respaldos en $CarpetaBackups." }; $BackupDir = $ultimo.FullName }
$sqlFile = Join-Path $BackupDir "midb.sql"
if (-not (Test-Path $sqlFile)) { throw "No se encontro el archivo $sqlFile." }
Write-Host "1. Preparando base de datos destino $BaseDestino..."
docker exec $Contenedor psql -U $Usuario -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $BaseDestino;"
if ($LASTEXITCODE -ne 0) { throw "Error al eliminar $BaseDestino." }
docker exec $Contenedor psql -U $Usuario -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $BaseDestino;"
if ($LASTEXITCODE -ne 0) { throw "Error al crear $BaseDestino." }
Write-Host "2. Restaurando esquema y registros desde $sqlFile..."
docker cp $sqlFile "${Contenedor}:/tmp/restaurar_midb.sql"
if ($LASTEXITCODE -ne 0) { throw "Error al copiar respaldo al contenedor." }
docker exec $Contenedor psql -U $Usuario -d $BaseDestino -v ON_ERROR_STOP=1 -f /tmp/restaurar_midb.sql | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Error SQL al restaurar en $BaseDestino." }
Write-Host "3. Restaurando fotografias en $RutaFotosRestauradas..."
if (Test-Path $RutaFotosRestauradas) { Remove-Item -Path $RutaFotosRestauradas -Recurse -Force -ErrorAction Stop }
New-Item -ItemType Directory -Force -Path $RutaFotosRestauradas -ErrorAction Stop | Out-Null
$origenFotos = Join-Path $BackupDir "fotos"
if ((Test-Path $origenFotos) -and ((Get-ChildItem -Path $origenFotos -Force).Count -gt 0)) { Copy-Item -Path "$origenFotos\*" -Destination $RutaFotosRestauradas -Recurse -Force -ErrorAction Stop }
$totalFotos = (Get-ChildItem -Path $RutaFotosRestauradas -File -Recurse -ErrorAction Stop).Count
Write-Host "4. Verificando conteos post-restauracion..."
$sw.Stop()
Write-Host "RESTAURACION COMPLETADA EN $([math]::Round($sw.Elapsed.TotalSeconds, 2)) segundos"
Write-Host "Base de datos destino: $BaseDestino"
Write-Host "Carpeta de fotos restauradas: $RutaFotosRestauradas ($totalFotos archivo(s))"
Write-Host "--- Conteos en BD restaurada ($BaseDestino) ---"
docker exec $Contenedor psql -U $Usuario -d $BaseDestino -v ON_ERROR_STOP=1 -c "CALL sp_control_respaldo(NULL, NULL, NULL);"
if ($LASTEXITCODE -ne 0) { throw "Error al verificar conteos en $BaseDestino." }
Write-Host "Para probar desde la API, apunta ConnectionStrings a Database=$BaseDestino y Photos:Path a uploads/fotos_restauradas"
