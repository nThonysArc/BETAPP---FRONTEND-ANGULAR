# Modo sin conexion (PWA + cola de envios)

## Que hace
- **Se instala y abre sin internet** (service worker). En el celular: menu del navegador > "Instalar app".
- **Precarga**: al abrir el proceso del dia CON red, se guardan en el dispositivo catalogos, cortes y plantilla.
- **Sin red** se puede: abrir el proceso, ver cortes, crear/editar cortes, registrar materia prima y cerrar/reabrir
  el proceso. Todo queda guardado en el dispositivo (IndexedDB) y se marca "Sin enviar".
- **Al volver la red** se envia solo, en orden, y la respuesta del servidor reemplaza lo provisional.
- La franja inferior dice siempre el estado: "Sin conexion", cuantos pendientes hay, y si el servidor rechazo alguno
  (con botones Reintentar / Descartar). Nada se descarta sin avisar.

## Que NO hace todavia
- Generar el PNG del reporte ni el "Avance en vivo" sin red (se calculan en el servidor). Es la etapa siguiente.
- Iniciar sesion sin red (hay que haber iniciado sesion antes). Crear el proceso diario sin red.

## Como probarlo
1. `ng serve`, iniciar sesion, abrir el proceso del dia (precarga).
2. DevTools (F12) > Network > "Offline".
3. Crear 2 cortes: aparecen con la etiqueta "Sin enviar" y la franja amarilla.
4. Quitar "Offline": en segundos se envian y desaparecen las etiquetas.
(El service worker solo existe en el build de produccion; la capa de datos funciona tambien en `ng serve`.)

## Pruebas automaticas
`ng test --include='src/app/core/offline/**/*.spec.ts'` (usa IndexedDB real del navegador).
