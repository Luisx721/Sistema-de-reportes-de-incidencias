-- Extensión separada para la API Rol 2. No forma parte de ProyectoBD/sql-init y no se aplica automáticamente.
-- Aplicar una vez acordado el despliegue y después de crear usuarios institucionales.
CREATE TABLE IF NOT EXISTS rol2_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rol2_sessions_user ON rol2_sessions(id_usuario);
