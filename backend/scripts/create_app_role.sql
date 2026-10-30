-- Rol de aplicación con privilegios mínimos para PostgreSQL.
-- Ejecutar como superusuario y reemplazar la contraseña antes de usar.
--
-- CREATE ROLE ccp_app LOGIN PASSWORD 'CAMBIAR_ESTA_CLAVE';
-- Luego actualizar DB_USER=ccp_app y DB_PASSWORD=... en .env

GRANT CONNECT ON DATABASE "SOFTWARE_CAFE" TO ccp_app;
GRANT USAGE ON SCHEMA ccp TO ccp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ccp TO ccp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ccp TO ccp_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA ccp
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ccp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA ccp
  GRANT USAGE, SELECT ON SEQUENCES TO ccp_app;
