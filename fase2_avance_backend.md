# Fase 2 — Avance backend (CCP Pereira)

Estado: **completada**

## Implementado

1. **Backend FastAPI** con estructura modular (`app/api`, `app/models`, `app/schemas`, `app/services`).
2. **Conexión PostgreSQL** vía SQLAlchemy 2.x (usa `.env` / `../.env`).
3. **Autenticación JWT en cookie HttpOnly** (`/auth/login`, `/auth/me`) y creación del primer admin por script.
4. **Usuarios, roles y permisos (RBAC)**: catálogo de permisos, roles del sistema y personalizados, asignación múltiple de roles y control de acceso por permiso.
5. **Catálogos**: categorías, proveedores, clientes, bodegas.
6. **Productos**:
   - CRUD base
   - carga/reemplazo de imagen JPG/PNG
   - límite 2 MB
   - redimensionado
   - guardado en `UPLOAD_DIR`
   - rutas de uploads protegidas por token.
7. **Inventario y POS**:
   - compras
   - ventas
   - ajustes
   - cotización POS (`/inventory/pos/quote`)
   - kardex (`/inventory/kardex`)
   - stock actual (`/inventory/stock/current`).
8. **Reportes base**:
   - valor total inventario
   - stock bajo
   - top productos vendidos
   - ventas por rango de fechas.
9. **Alembic configurado** con baseline inicial.

## Validaciones realizadas

- Compilación de código Python exitosa.
- Inicio de servidor Uvicorn exitoso.
- Prueba de endpoint de salud exitosa (`/health`).
- Conexión a BD validada con `SOFTWARE_CAFE`.

## Archivos clave

- `backend/app/main.py`
- `backend/app/api/router.py`
- `backend/app/api/routes/*.py`
- `backend/app/models/*.py`
- `backend/app/schemas/*.py`
- `backend/app/services/images.py`
- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/requirements.txt`
