# Prompt para OpenCode — Sistema de Inventario y Ventas CCP Pereira

Actúa como arquitecto de software y desarrollador senior full-stack.

Voy a construir un SISTEMA DE INVENTARIO Y VENTAS completo para la empresa **CCP Pereira** (Pereira, Colombia), con una interfaz web profesional tipo ERP/SaaS, similar a Siigo o Loggro. El nombre "CCP Pereira" debe aparecer en el encabezado de la aplicación, la pantalla de login y en todos los rótulos y reportes impresos.

## REGLA N.º 1: CREDENCIALES DE BASE DE DATOS

ANTES de escribir cualquier código:

1. PÍDEME las credenciales de la base de datos existente.
2. Cuando te las entregue, créalas en un archivo `.env` en la raíz del proyecto.
3. Crea también un `.env.example` con las mismas variables pero SIN valores reales.
4. Agrega `.env` al `.gitignore` inmediatamente. Nunca expongas credenciales en el código fuente.
5. Conecta a la base de datos en MODO LECTURA primero, analiza el esquema completo (tablas, columnas, relaciones) y muéstrame un resumen de lo que encontraste.
6. NO ejecutes CREATE, ALTER, DROP ni DELETE sin presentarme primero el SQL exacto y pedirme confirmación explícita.

Las variables esperadas son:

DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_DIALECT=
SECRET_KEY=
ENVIRONMENT=
UPLOAD_DIR=

## FUNCIONALIDAD REQUERIDA

1. Gestión de productos: SKU, código de barras, nombre, descripción, categoría, proveedor, costo, precio de venta sin IVA, tarifa de IVA configurable por producto (19% general, 5% reducida, 0% exento/excluido), precio final con IVA calculado automáticamente, stock mínimo e imagen del producto.
2. Imágenes de producto (OBLIGATORIO): cada producto debe soportar la carga de una imagen (JPG/PNG) desde el formulario del producto. Guardar el archivo en una carpeta de uploads configurada por `UPLOAD_DIR` y almacenar la ruta en la tabla de productos. Mostrar la imagen en el listado de productos, en la ficha del producto y en el POS. Incluir carga con vista previa y posibilidad de reemplazarla.
3. Entradas de mercancía: compras a proveedores, devoluciones de clientes y ajustes positivos.
4. Salidas de mercancía: ventas, mermas, daños y ajustes negativos, siempre con motivo.
5. Kardex: historial completo de movimientos por producto, fecha, bodega y tipo de movimiento.
6. Punto de venta (POS): búsqueda por código de barras o nombre, muestra la imagen de cada producto, carrito, cálculo automático de subtotal, IVA discriminado y total.
7. Rótulos (con logo/encabezado de CCP Pereira): por cada venta, generar un rótulo/comprobante tipo factura con datos del producto, precio, IVA y código de barras. Al cierre de jornada, generar un rótulo resumen con todo lo vendido en el día (productos, cantidades, subtotal, IVA y total).
8. Reportes: existencias actuales, productos con stock bajo, productos más vendidos, valor total del inventario y ventas por rango de fechas.
9. Usuarios y roles: administrador, vendedor y bodega, con autenticación JWT y control de permisos.

## REGLAS DE NEGOCIO

- La tarifa principal de IVA es 19% (Colombia), pero debe ser configurable por producto.
- Toda venta descuenta automáticamente el inventario al confirmarse.
- Nunca actualizar el stock directamente: registrar cada cambio como un movimiento de inventario trazable.
- Validar que no se pueda vender más cantidad de la disponible en stock.
- Moneda: pesos colombianos (COP), con formato de miles.
- Límite de tamaño de imagen: 2 MB; redimensionar a un tamaño razonable para el listado.

## STACK TÉCNICO

- Backend: Python + FastAPI + SQLAlchemy, con migraciones en Alembic.
- Base de datos: la existente (confirmar dialecto según credenciales: PostgreSQL o MySQL).
- Frontend: React + Vite + TypeScript + Tailwind CSS.
- Autenticación: JWT.
- Generación de PDF para rótulos y reportes.
- Servir archivos de uploads como estáticos protegidos.
- Variables de entorno desde `.env` con pydantic-settings.

## DISEÑO DE INTERFAZ

Interfaz profesional tipo dashboard de software contable moderno, con identidad "CCP Pereira":

1. Panel lateral (sidebar) con menú: Dashboard, Inventario, Productos, Entradas, Salidas, Ventas/POS, Rótulos, Reportes, Usuarios y Configuración.
2. Dashboard con tarjetas de resumen: ventas del día, valor del inventario, productos con stock bajo y total de productos.
3. Tablas con paginación, búsqueda, filtros, miniatura de imagen del producto y exportación.
4. Formularios modales para crear y editar registros, incluyendo carga de imagen con vista previa.
5. Alertas visuales para stock bajo y validaciones.
6. Diseño limpio, coherente y responsive, con una paleta de colores seria y corporativa.

## MODO DE TRABAJO

1. Fase 0: pedir credenciales, crear `.env`, conectar en modo lectura y documentar el esquema actual.
2. Fase 1: presentar el plan de arquitectura y los cambios de base de datos propuestos (SQL completo, incluyendo el campo de imagen en productos) y esperar mi aprobación.
3. Fase 2: implementar backend (modelos, endpoints, lógica de inventario, IVA y carga de imágenes).
4. Fase 3: implementar frontend completo siguiendo el diseño descrito.
5. Fase 4: rótulos en PDF con encabezado CCP Pereira, reportes y pruebas.
6. Fase 5: README con instrucciones de instalación y ejecución local.

Trabaja por fases, ejecuta el código, verifica que el backend arranque y el frontend compile antes de cerrar cada fase, y repórtame el avance al terminar cada una.

Empieza ahora por la Fase 0: pídeme las credenciales de la base de datos.
