# Guia de Respaldo y Restauracion de Base de Datos y Fotografias

## 1. Orden de ejecucion de scripts SQL
Para levantar o actualizar la base de datos midb desde cero, ejecutar en orden:
1. Scripts iniciales en ProyectoBD/sql-init/ (01 a 03).
2. Migraciones oficiales en db/official/ (002 hasta 009_control_respaldo.sql).

## 2. Verificacion previa al respaldo
Ejecutar el procedimiento de control en midb antes de respaldar:
CALL sp_control_respaldo(NULL, NULL, NULL);

## 3. Generar respaldo (Base de datos + Fotografias)
Ejecutar desde la raiz del repositorio:
powershell -ExecutionPolicy Bypass -File .\ProyectoBD\scripts\respaldar.ps1

## 4. Restaurar en una base separada y validar
Ejecutar el script de restauracion sobre la base separada midb_restaurada:
powershell -ExecutionPolicy Bypass -File .\ProyectoBD\scripts\restaurar.ps1
Luego ejecutar CALL sp_control_respaldo(NULL, NULL, NULL); en midb_restaurada y comprobar que reportes, fotos y eventos coincidan con los obtenidos antes del respaldo.
Para validar la recuperacion completa desde la API, apuntar tanto la cadena de conexion a Database=midb_restaurada como la ruta de imagenes (Photos:Path o INCIDENCIAS_PHOTOS_PATH) a uploads/fotos_restauradas, y abrir un expediente con fotografia adjunta.

## 5. Evidencia para la defensa
Conservar las salidas de ambas consultas EXPLAIN (ANALYZE, BUFFERS) de ProyectoBD/pruebas/04-pruebas-explain.sql, los totales de sp_control_respaldo antes y despues de restaurar, y una captura de la fotografia abierta desde la instancia restaurada.
