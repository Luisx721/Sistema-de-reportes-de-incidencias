-- Esquema provisional aislado para desarrollo. No representa el DDL institucional.
CREATE TABLE app_users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario varchar(160) NOT NULL UNIQUE,
    nombre varchar(180) NOT NULL,
    perfil varchar(80) NOT NULL,
    area varchar(160),
    password_hash bytea NOT NULL,
    password_salt bytea NOT NULL,
    activo boolean NOT NULL DEFAULT true
);

CREATE TABLE app_sessions (
    token_hash char(64) PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL
);
CREATE INDEX app_sessions_user_id_idx ON app_sessions(user_id);

CREATE TABLE incidents (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code varchar(32) NOT NULL UNIQUE,
    category varchar(120) NOT NULL,
    location varchar(160) NOT NULL,
    description varchar(2000) NOT NULL,
    reference varchar(250),
    state varchar(80) NOT NULL,
    priority varchar(20),
    requester_area varchar(160),
    responsible_unit varchar(160),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at timestamptz NOT NULL,
    updated_at timestamptz
);
CREATE INDEX incidents_created_at_idx ON incidents(created_at DESC);
CREATE INDEX incidents_state_idx ON incidents(state);

CREATE TABLE incident_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incident_code varchar(32) NOT NULL REFERENCES incidents(code) ON DELETE CASCADE,
    state varchar(80) NOT NULL,
    note varchar(2000) NOT NULL,
    actor_user_id bigint REFERENCES app_users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL
);
CREATE INDEX incident_history_code_date_idx ON incident_history(incident_code, created_at);
