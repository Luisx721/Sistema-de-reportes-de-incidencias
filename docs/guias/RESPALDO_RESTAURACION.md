# Guia de Respaldo y Restauracion de Base de Datos y Fotografias

## 1. Orden de ejecucion de scripts SQL
Para levantar o actualizar la base de datos midb desde cero, ejecutar en orden:
1. Scripts iniciales en ProyectoBD/sql-init/ (01 a 03).
2. Migraciones oficiales en db/official/ (001 hasta 009_control_respaldo.sql).

## 2. Verificacion previa al respaldo
Ejecutar el procedimiento de control en midb antes de respaldar:
CALL sp_control_respaldo(NULL, NULL, NULL);

## 3. Generar respaldo (Base de datos + Fotografias)
Ejecutar desde la raiz del repositorio:
powershell -ExecutionPolicy Bypass -File .\ProyectoBD\scripts\respaldar.ps1

## 4. Restaurar en una base separada y validar
Ejecutar el script de restauracion:
powershell -ExecutionPolicy Bypass -File .\ProyectoBD\scripts\restaurar.ps1
Luego ejecutar CALL sp_control_respaldo(NULL, NULL, NULL); en midb_restaurada y comprobar que reportes, fotos y eventos coincidan. Para validar las imagenes desde la API, configurar Photos:Path en uploads/fotos_restauradas.
