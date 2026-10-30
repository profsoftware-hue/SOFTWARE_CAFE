# Fase 1 — Propuesta de arquitectura (CCP Pereira)

## 1) Estado actual validado

- Motor confirmado: **PostgreSQL 16**.
- Base conectada en modo lectura: **SOFTWARE_CAFE**.
- Resultado de exploración: **sin tablas de negocio** (solo objetos de sistema).

## 2) Arquitectura propuesta

## Backend (FastAPI)

- **Framework**: FastAPI + SQLAlchemy 2.x + Alembic.
- **Capas**:
  - `api`: rutas REST por módulo.
  - `schemas`: validaciones de entrada/salida (Pydantic).
  - `models`: entidades ORM.
  - `services`: reglas de negocio (stock, IVA, POS, reportes).
  - `repositories`: acceso a datos.
  - `core`: configuración, seguridad JWT, dependencias.
- **Módulos funcionales**:
  - Autenticación y usuarios/roles.
  - Catálogos: productos, categorías, proveedores, clientes, bodegas.
  - Inventario: entradas, salidas, ajustes, kardex.
  - Ventas POS: carrito, confirmación, descuento automático de inventario.
  - Rótulos/PDF y reportes.

## Frontend (React + Vite + TypeScript + Tailwind)

- Layout dashboard tipo ERP con sidebar:
  - Dashboard, Inventario, Productos, Entradas, Salidas, Ventas/POS, Rótulos, Reportes, Usuarios, Configuración.
- Componentes base:
  - Tablas con paginación/filtros/búsqueda/exportación.
  - Modales de creación/edición.
  - Carga de imagen con vista previa.
- Gestión de estado:
  - React Query para fetch/cache.
  - Store liviano para sesión y carrito POS.

## Seguridad

- JWT (access token) con permisos por rol:
  - `ADMIN`, `SELLER`, `WAREHOUSE`.
- Hash de contraseñas (Argon2 o BCrypt).
- Endpoints protegidos por dependencia de roles.

## Imágenes de productos

- Límite de archivo: **2 MB**.
- Formatos: JPG/PNG.
- Guardado físico en `UPLOAD_DIR`.
- En BD se almacena ruta y metadatos (`image_path`, `image_mime_type`, `image_size_bytes`).
- Servicio de archivos por endpoint autenticado (estático protegido).

## Inventario y trazabilidad

- Regla central: **el stock nunca se edita directo**.
- Todo cambio pasa por `inventory_movements`.
- `inventory_balances` se actualiza automáticamente por trigger.
- Validación de no-stock-negativo en BD y backend.

## IVA y precios

- `vat_rate` configurable por producto (0, 0.05, 0.19).
- `final_price_incl_tax` como columna calculada en BD.
- En venta se guarda snapshot de precio + IVA por ítem.

## PDF y rótulos

- Rótulo de venta por transacción (encabezado CCP Pereira).
- Rótulo resumen por día (productos, cantidades, subtotal, IVA, total).

---

## 3) Flujo operativo clave

1. Usuario inicia sesión (JWT).
2. Crea/edita productos (incluye imagen).
3. Registra entradas (compras/devoluciones/ajustes +).
4. En POS confirma venta:
   - calcula subtotal + IVA + total,
   - cambia estado a confirmada,
   - trigger genera salidas de inventario,
   - valida stock disponible.
5. Kardex y reportes leen movimientos trazables.

---

## 4) Plan técnico de implementación (Fase 2+)

1. Scaffold backend + configuración `.env` + Alembic.
2. Crear migración inicial con el SQL propuesto.
3. Endpoints Auth + Users/Roles.
4. Endpoints Catálogos y Productos (con carga de imagen).
5. Endpoints Inventario (entradas/salidas/ajustes/kardex).
6. Endpoints POS + confirmación de ventas.
7. Endpoints Reportes + PDF.
8. Frontend completo por módulos.
9. Pruebas mínimas: auth, stock, IVA, no stock negativo.

---

## 5) Entregable de Fase 1

- SQL completo propuesto: `fase1_sql_postgresql_ccp_pereira.sql`.
- **No se ha ejecutado ningún CREATE/ALTER/DROP/DELETE en la BD**.
