param(
    [string]$BackupDir = "",
    [string]$ContainerName = "sistema-de-reportes-de-incidencias",
    [string]$DbUser = "reportes",
    [string]$TargetDb = "midb_restaurada",
    [string]$PhotosTarget = "backend/Incidencias.Api/uploads/fotos_restauradas"
)

$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    $latest = Get-ChildItem -Path "ProyectoBD/backups" -Directory -Filter "backup_*" |
              Sort-Object Name -Descending | Select-Object -First 1
    if ($null -eq $latest) { throw "No se encontro ningun respaldo en ProyectoBD/backups." }
    $BackupDir = $latest.FullName
}

$dumpFile = Join-Path $BackupDir "midb.sql"
$photosBackupDir = Join-Path $BackupDir "fotos"

if (-not (Test-Path $dumpFile)) { throw "No existe el archivo SQL en: $dumpFile" }

Write-Host "1. Preparando base de datos destino '$TargetDb'..."
if ($TargetDb -ne "midb") {
    docker exec -i $ContainerName psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $TargetDb;" | Out-Null
    docker exec -i $ContainerName psql -U $DbUser -d postgres -c "CREATE DATABASE $TargetDb;" | Out-Null
}

Write-Host "2. Restaurando esquema y registros desde '$dumpFile'..."
cmd /c "docker exec -i $ContainerName psql -U $DbUser -d $TargetDb < `"$dumpFile`"" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Error al restaurar el respaldo SQL." }

Write-Host "3. Restaurando fotografias en '$PhotosTarget'..."
New-Item -ItemType Directory -Force -Path $PhotosTarget | Out-Null
if (Test-Path $photosBackupDir) {
    Copy-Item -Path "$photosBackupDir\*" -Destination $PhotosTarget -Recurse -Force -ErrorAction SilentlyContinue
}
$fotosCount = (Get-ChildItem -Path $PhotosTarget -File -Recurse | Measure-Object).Count

Write-Host "4. Verificando conteos post-restauracion..."
$conteos = docker exec -i $ContainerName psql -U $DbUser -d $TargetDb -t -A -F ": " -c "
SELECT 'incidencias', COUNT(*) FROM incidencias
UNION ALL SELECT 'historial_estados', COUNT(*) FROM historial_estados
UNION ALL SELECT 'fotografias', COUNT(*) FROM fotografias
UNION ALL SELECT 'categorias', COUNT(*) FROM categorias
UNION ALL SELECT 'ubicaciones', COUNT(*) FROM ubicaciones;
"

$sw.Stop()
$tiempo = "{0:N2} segundos" -f $sw.Elapsed.TotalSeconds

Write-Host ""
Write-Host "RESTAURACION COMPLETADA EN $tiempo"
Write-Host "Base de datos destino: $TargetDb"
Write-Host "Carpeta de fotos restauradas: $PhotosTarget ($fotosCount archivo(s))"
Write-Host "--- Conteos en BD restaurada ($TargetDb) ---"
$conteos | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "Para apuntar la API a la carpeta restaurada, configura en appsettings.json:"
Write-Host '  "Photos": { "Path": "uploads/fotos_restauradas" }'
Write-Host 'O mediante variable de entorno antes de iniciar dotnet run:'
Write-Host '  $env:INCIDENCIAS_PHOTOS_PATH = "uploads/fotos_restauradas"'
