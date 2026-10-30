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

## Ejecutar API

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Swagger

- `http://localhost:8000/docs`

## Módulos implementados

- Auth JWT
- Usuarios y roles
- Catálogos (categorías, proveedores, clientes, bodegas)
- Productos con carga/reemplazo de imagen y alta rápida (nombre + cantidad, SKU automático)
- Compras, ventas POS, ajustes, kardex y stock actual
- Reportes base (valor inventario, stock bajo, top productos, ventas por rango)
- Uploads protegidos por token
