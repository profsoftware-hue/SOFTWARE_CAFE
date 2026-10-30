# SOFTWARE_CAFE

Sistema de inventario y ventas para **Fundación Nuestro Futuro / CCP Pereira**.

## Stack

- Backend: Python 3.11, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16.
- Frontend: React, Vite, TypeScript, Tailwind CSS.
- Autenticación: JWT.

## Estructura

- `backend/`: API REST, modelos, migraciones y scripts.
- `frontend/`: aplicación web (POS, inventario, reportes y cierres).
- `fase1_sql_postgresql_ccp_pereira.sql`: esquema inicial de base de datos.

## Configuración

1. Copiar `.env.example` a `.env` en la raíz.
2. Completar credenciales de PostgreSQL y definir un `SECRET_KEY` seguro.
3. Backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

4. Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Ramas

- `main`: versión estable.
- `desarrollo`: integración y cambios en curso.
- `produccion`: versión desplegada en producción.

## Documentación

- `DATOS_DE_PRUEBA.md`: datos de ejemplo y limpieza.
- `IMPRESORA_TM-U220.md`: configuración de impresión 76 mm.
- `fase1_arquitectura_ccp_pereira.md`: arquitectura y decisiones.

## Seguridad

- No subir `.env` ni credenciales al repositorio.
- Cambiar el `SECRET_KEY` antes de desplegar.
- Usar HTTPS y una cuenta de base de datos con permisos mínimos.
