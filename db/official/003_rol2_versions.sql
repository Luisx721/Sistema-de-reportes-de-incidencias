-- Extensión de concurrencia para la API Rol 2; instalar tras ProyectoBD/sql-init.
-- La versión sube una sola vez por cambio de estado. Prioridad se incrementa en la misma
-- transacción de la API, que actualiza el contador explícitamente.
CREATE TABLE IF NOT EXISTS rol2_incident_versions (
    id_incidencia INT PRIMARY KEY REFERENCES incidencias(id_incidencia) ON DELETE CASCADE,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0)
);
INSERT INTO rol2_incident_versions(id_incidencia)
SELECT id_incidencia FROM incidencias ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION rol2_init_incident_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO rol2_incident_versions(id_incidencia) VALUES (NEW.id_incidencia) ON CONFLICT DO NOTHING;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rol2_init_incident_version ON incidencias;
CREATE TRIGGER trg_rol2_init_incident_version AFTER INSERT ON incidencias
FOR EACH ROW EXECUTE FUNCTION rol2_init_incident_version();
CREATE OR REPLACE FUNCTION rol2_bump_incident_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE rol2_incident_versions SET version = version + 1 WHERE id_incidencia = NEW.id_incidencia;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rol2_bump_incident_version ON incidencias;
CREATE TRIGGER trg_rol2_bump_incident_version AFTER UPDATE OF i_estado_actual ON incidencias
FOR EACH ROW WHEN (OLD.i_estado_actual IS DISTINCT FROM NEW.i_estado_actual)
EXECUTE FUNCTION rol2_bump_incident_version();
