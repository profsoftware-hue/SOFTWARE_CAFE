# Backend CCP Pereira (Fase 2)

API REST para inventario y ventas con FastAPI + SQLAlchemy.

## Requisitos

- Python 3.11+
- Acceso a PostgreSQL (base `SOFTWARE_CAFE`)

## Instalación

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Variables de entorno

Se toman desde el `.env` en la raíz del proyecto (`C:\Dev\Software expo\.env`).

Variables mínimas:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_DIALECT=postgresql`
- `SECRET_KEY`
- `UPLOAD_DIR`

## Primer administrador

El sistema no expone creación pública de usuarios. Después de migrar la base, crea el primer administrador por consola:

```bash
cd backend
python scripts/create_admin.py --username admin --email admin@ccp.local --name "Administrador CCP"
```

El script solicita la contraseña de forma interactiva.

## Ejecutar API

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Swagger

- `http://localhost:8000/docs`

## Módulos implementados

- Auth JWT en cookie HttpOnly
- Usuarios, roles y permisos (RBAC)
- Catálogos (categorías, proveedores, clientes, bodegas)
- Productos con carga/reemplazo de imagen y alta rápida (nombre + cantidad, SKU automático)
- Compras, ventas POS, ajustes, kardex y stock actual
- Reportes base (valor inventario, stock bajo, top productos, ventas por rango)
- Uploads protegidos por token
