param([string]$Contenedor = "sistema-de-reportes-de-incidencias", [string]$BaseDatos = "midb", [string]$Usuario = "reportes", [string]$RutaFotos = "backend\Incidencias.Api\uploads\fotos", [string]$CarpetaBackups = "ProyectoBD\backups")
$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$destino = Join-Path $CarpetaBackups "backup_$ts"
$destinoFotos = Join-Path $destino "fotos"
New-Item -ItemType Directory -Force -Path $destinoFotos -ErrorAction Stop | Out-Null
Write-Host "1. Respaldando base de datos $BaseDatos..."
docker exec $Contenedor pg_dump -U $Usuario -d $BaseDatos --clean --if-exists -f /tmp/respaldo_midb.sql
if ($LASTEXITCODE -ne 0) { throw "Error al ejecutar pg_dump en $Contenedor." }
docker cp "${Contenedor}:/tmp/respaldo_midb.sql" "$destino\midb.sql"
if ($LASTEXITCODE -ne 0) { throw "Error al copiar midb.sql desde $Contenedor." }
Write-Host "2. Respaldando fotografias desde $RutaFotos..."
if ((Test-Path $RutaFotos) -and ((Get-ChildItem -Path $RutaFotos -Force).Count -gt 0)) { Copy-Item -Path "$RutaFotos\*" -Destination $destinoFotos -Recurse -Force -ErrorAction Stop }
$totalFotos = (Get-ChildItem -Path $destinoFotos -File -Recurse -ErrorAction Stop).Count
Write-Host "3. Obteniendo conteos de verificacion..."
$sw.Stop()
Write-Host "RESPALDO COMPLETADO - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Carpeta: $destino"
Write-Host "Archivo SQL: $destino\midb.sql"
Write-Host "Fotos respaldadas: $totalFotos archivo(s)"
Write-Host "Tiempo empleado: $([math]::Round($sw.Elapsed.TotalSeconds, 2)) segundos"
Write-Host "--- Conteos en BD origen ($BaseDatos) ---"
docker exec $Contenedor psql -U $Usuario -d $BaseDatos -v ON_ERROR_STOP=1 -c "CALL sp_control_respaldo(NULL, NULL, NULL);"
if ($LASTEXITCODE -ne 0) { throw "Error al consultar conteos en $BaseDatos." }
