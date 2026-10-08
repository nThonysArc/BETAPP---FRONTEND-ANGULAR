# Parche frontend: supervisor por maquina en cada corte

Extrae este ZIP SOBRE LA RAIZ del repo `BETAPP---FRONTEND-ANGULAR` (acepta reemplazar). Requiere el parche de backend ya desplegado (usa `GET /api/usuarios`).
Verificado: `ng build` de desarrollo sin errores y prueba en navegador headless con API simulada (el selector precarga el supervisor del corte anterior y envia el elegido). No se probo contra el backend real.

## Que cambia
- `corte-form`: nueva tarjeta "Supervisor por maquina" (una fila por maquina del detalle, un solo supervisor por maquina). Se precarga del corte anterior; una maquina nueva usa el supervisor sugerido. Si un supervisor ya no esta activo, se sigue mostrando para no perderlo al editar un corte historico.
- `maquina-form-dialog`: selector "Supervisor sugerido". Antes, editar una maquina enviaba la solicitud SIN supervisorId y el backend le borraba el supervisor.
- Modelos y `usuario.service.ts` nuevos.

## Sobre "Ver katos"
Este parche NO toca ese boton: en el codigo actual funciona (probado en navegador con API simulada). Si en produccion no responde, revisa en Vercel que el despliegue sea el ultimo commit y que `environment.ts` apunte a tu backend de Railway.
