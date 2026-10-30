# Frontend CCP Pereira (Fase 3)

Interfaz web tipo ERP/SaaS para **Inventario y Ventas CCP Pereira**.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- React Router
- React Query
- Axios

## Requisitos

- Node.js 20+
- Backend FastAPI corriendo en `http://localhost:8000`

## Variables de entorno

Crear `frontend/.env` a partir de `frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Instalar y ejecutar

```bash
cd frontend
npm install
npm run dev
```

## Compilar

```bash
npm run build
```

## Módulos incluidos

- Login con marca CCP Pereira
- Dashboard
- Inventario (stock/kardex)
- Productos (con carga y vista previa de imagen)
- Entradas (compras)
- Salidas (ajustes)
- Ventas / POS
- Rótulos (UI preparada para Fase 4 PDF)
- Reportes
- Usuarios
- Configuración
