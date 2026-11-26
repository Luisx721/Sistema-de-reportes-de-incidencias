param(
    [string]$ContainerName = "sistema-de-reportes-de-incidencias",
    [string]$DbUser = "reportes",
    [string]$DbName = "midb",
    [string]$PhotosSource = "backend/Incidencias.Api/uploads/fotos",
    [string]$BackupRoot = "ProyectoBD/backups"
)

$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $BackupRoot "backup_$timestamp"
$photosBackupDir = Join-Path $backupDir "fotos"
$dumpFile = Join-Path $backupDir "midb.sql"

New-Item -ItemType Directory -Force -Path $photosBackupDir | Out-Null

Write-Host "1. Respaldando base de datos '$DbName'..."
cmd /c "docker exec $ContainerName pg_dump -U $DbUser -d $DbName --clean --if-exists > `"$dumpFile`""
if ($LASTEXITCODE -ne 0) { throw "Error al ejecutar pg_dump." }

Write-Host "2. Respaldando fotografias desde '$PhotosSource'..."
if (Test-Path $PhotosSource) {
    Copy-Item -Path "$PhotosSource\*" -Destination $photosBackupDir -Recurse -Force -ErrorAction SilentlyContinue
} else {
    New-Item -ItemType Directory -Force -Path $PhotosSource | Out-Null
}
$fotosCount = (Get-ChildItem -Path $photosBackupDir -File -Recurse | Measure-Object).Count

Write-Host "3. Obteniendo conteos de verificacion..."
$conteos = docker exec -i $ContainerName psql -U $DbUser -d $DbName -t -A -F ": " -c "
SELECT 'incidencias', COUNT(*) FROM incidencias
UNION ALL SELECT 'historial_estados', COUNT(*) FROM historial_estados
UNION ALL SELECT 'fotografias', COUNT(*) FROM fotografias
UNION ALL SELECT 'categorias', COUNT(*) FROM categorias
UNION ALL SELECT 'ubicaciones', COUNT(*) FROM ubicaciones;
"

$sw.Stop()
$tiempo = "{0:N2} segundos" -f $sw.Elapsed.TotalSeconds

$resumen = @(
    "RESPALDO COMPLETADO - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "Carpeta: $backupDir",
    "Archivo SQL: $dumpFile",
    "Fotos respaldadas: $fotosCount archivo(s)",
    "Tiempo empleado: $tiempo",
    "--- Conteos en BD origen ($DbName) ---"
) + $conteos

$resumen | Set-Content -Path (Join-Path $backupDir "resumen_respaldo.txt") -Encoding UTF8
$resumen | ForEach-Object { Write-Host $_ }
