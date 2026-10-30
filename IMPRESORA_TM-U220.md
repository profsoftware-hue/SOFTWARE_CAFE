# Impresora Epson TM-U220 — CCP Pereira

La app imprime los recibos y cierres en formato de **76 mm**, el papel de la TM-U220.

## 1. Instalar y predeterminar la impresora (solo una vez)

1. Instala el driver oficial de Epson para **TM-U220**.
2. En Windows: **Configuración → Bluetooth y dispositivos → Impresoras y escáneres**.
3. Selecciona **EPSON TM-U220** → **Establecer como predeterminada**.
4. Verifica el ancho de papel: **76 mm** (3 pulgadas).

Con esto, cualquier impresión del navegador saldrá por la TM-U220.

## 2. Impresión directa sin diálogo

Los navegadores no permiten que una web elija una impresora por código; siempre
usan la **impresora predeterminada de Windows**. Para que imprima sin abrir el
diálogo, abre el POS con:

```
C:\Dev\Software expo\start-pos-silencioso.bat
```

Si tu navegador aún muestra la vista previa, usa el modo kiosco (pantalla
completa, impresión silenciosa garantizada):

```
C:\Dev\Software expo\start-pos-kiosco.bat
```

Ambos abren Chrome/Edge con `--kiosk-printing`, de modo que al pulsar
**Imprimir recibo** o **Imprimir cierre** envía directo a la impresora
predeterminada.

> Los scripts usan un perfil de Chrome aparte (`CCP-Pereira-POS`). La primera
> vez tendrás que iniciar sesión en la app; después queda guardada la sesión.

## 3. Uso normal

Si abres la app en un navegador normal, al imprimir aparecerá el diálogo de
impresión. Selecciona **EPSON TM-U220** una vez; Chrome recuerda esa elección
para las siguientes impresiones.

## 4. Si no imprime

- Verifica que el servicio **Cola de impresión** de Windows esté iniciado.
- Revisa que la TM-U220 esté encendida y con papel.
- Haz una prueba desde el Panel de control de Windows.
- Confirma que el ancho de papel configurado sea 76 mm, no 80 mm.
