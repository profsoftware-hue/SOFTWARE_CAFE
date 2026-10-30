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

## 6. Usuarios, roles y permisos

- No existe registro público ni endpoint de bootstrap de administradores.
- El primer administrador se crea por consola con `backend/scripts/create_admin.py`.
- Los permisos se asignan a roles; los usuarios heredan la unión de permisos de sus roles.
- El rol `ADMIN` conserva acceso total y no puede perder permisos.
- Los roles del sistema no se pueden eliminar.
- Solo usuarios con `users.manage` o `roles.manage` pueden modificar usuarios o roles.
- Un gestor que no sea `ADMIN` no puede asignar el rol `ADMIN`, modificar cuentas administradoras ni otorgar permisos que él mismo no tenga.
- Los cambios de contraseña invalidan los tokens emitidos anteriormente para ese usuario.
- La jerarquía `*.manage` incluye el permiso de lectura `*.view` correspondiente.
