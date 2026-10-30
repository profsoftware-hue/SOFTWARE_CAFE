# Seguridad para producción

## 1. Cuenta de base de datos con privilegios mínimos

La aplicación no debe conectarse con un superusuario. Crear un rol dedicado:

```sql
CREATE ROLE ccp_app LOGIN PASSWORD 'CAMBIAR_ESTA_CLAVE';
```

Ejecutar `backend/scripts/create_app_role.sql` como administrador de PostgreSQL y
luego cambiar en `.env`:

```env
DB_USER=ccp_app
DB_PASSWORD=...
```

## 2. SECRET_KEY

Generar una clave única antes de desplegar:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

La aplicación **no arranca** en `ENVIRONMENT=production` si `SECRET_KEY` está vacío,
es el valor por defecto o tiene menos de 32 caracteres.

## 3. CORS

Configurar únicamente el dominio real del frontend:

```env
CORS_ORIGINS=https://tu-dominio.com
```

En producción no se permite `*`.

## 4. HTTPS y proxy

Publicar la API detrás de HTTPS (Nginx, Caddy o un balanceador). No exponer
PostgreSQL a Internet.

## 5. Migraciones

Antes del primer despliegue:

```bash
cd backend
alembic upgrade head
```

La migración base crea el esquema únicamente si `ccp.roles` no existe.
