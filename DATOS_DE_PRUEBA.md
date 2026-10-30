# Datos de prueba — CCP Pereira

Productos de ejemplo para probar el sistema, identificados con el prefijo **`TEST-`**.
Así se pueden borrar sin riesgo de tocar datos reales.

## Crear productos de prueba

Doble clic en:

```
C:\Dev\Software expo\crear-productos-prueba.bat
```

o desde consola:

```powershell
cd "C:\Dev\Software expo\backend"
python scripts/seed_test_products.py
```

Crea 6 productos (`TEST-001` a `TEST-006`) con IVA 19%, 5% y 0%, más una
categoría y un proveedor de prueba.

## Producto rápido (solo nombre y cantidad)

En **Productos → Producto rápido** puedes crear un producto escribiendo solo:

- Nombre del producto
- Cantidad inicial

El SKU se genera automático (`PROD-00001`, etc.) y el stock se registra de
inmediato como entrada de inventario. También puedes indicar bodega, SKU,
precio e IVA si lo necesitas.

### Opcional: con stock para probar el POS

```powershell
cd "C:\Dev\Software expo\backend"
python scripts/seed_test_products.py --with-stock
```

Esto crea un ajuste de entrada con 25 unidades por producto (puedes cambiar la
cantidad con `--stock 50`).

## Eliminar productos de prueba

### Opción A — uno por uno desde la interfaz

1. Entra a **Productos**
2. Clic en **Eliminar** en el producto
3. Confirma

Solo funciona si el producto **no tiene ventas ni compras registradas**. Si ya
se vendió o compró, el sistema lo impide para conservar la trazabilidad; en ese
caso usa la opción B o desactiva el producto. Los movimientos internos de
entrada/ajuste sí se eliminan junto con el producto.

### Opción B — borrar todos los datos de prueba

Doble clic en:

```
C:\Dev\Software expo\borrar-productos-prueba.bat
```

o desde consola:

```powershell
cd "C:\Dev\Software expo\backend"
python scripts/cleanup_test_data.py
```

Borra únicamente registros `TEST-`:

- Productos con SKU `TEST-*`
- Movimientos y saldos de inventario de esos productos
- Ítems de ventas/compras/ajustes de esos productos
- Documentos que queden sin ítems
- Categoría y proveedor de prueba si ya no están en uso

## Reglas de borrado

| Caso | ¿Se puede eliminar? |
|---|---|
| Producto sin ventas ni compras | Sí, aunque tenga stock inicial |
| Producto con ventas o compras | No desde la interfaz (desactivar) |
| Producto con imagen | Sí; la imagen también se elimina del disco |
