# Parche v2: corrige el commit 4656b2a y aplica el diseño BetaApp

Este ZIP se extrae sobre tu repo tal como está ahora (commit 4656b2a) y lo deja compilando.

## Cómo aplicarlo (Windows)
1. Extrae el ZIP **sobre la raíz del repo**, aceptando reemplazar archivos.
2. En CMD o PowerShell, dentro del repo:
   - `npm install`
   - `npm start`
3. Abre http://localhost:4200/login. Tras iniciar sesión debe abrirse el Panel principal.

## Qué corrige del commit 4656b2a
Ese commit reemplazó seis archivos por versiones antiguas. Este parche devuelve cuatro a su estado del commit 5206602 y rehace el login:
- `src/app/app.routes.ts`: recupera todas las rutas (dashboard, admin, procesos, cortes, historial). Sin ellas, "/" cargaba otra vez el login.
- `src/app/app.config.ts`: recupera `provideNativeDateAdapter()` (lo necesitan los selectores de fecha).
- `src/app/core/models/corte.model.ts` y `proceso-diario.model.ts`: recuperan el modelo vigente (`CorteDetalle`, `detalles`, `totalCortes`).
- `login.component.ts/html`: vuelven a usar `inject()` (era lo que causaba el error TS2729) y recuperan el botón de mostrar contraseña.

## Qué agrega del diseño
- Se elimina la plantilla de bienvenida de Angular de `app.component.html`.
- Tokens en `src/styles/beta-tokens.css` y mapeo a Angular Material en `src/styles/beta-material.scss` (temas claro, oscuro y planta).
- Selector de tema (`core/theme`, `shared/theme-toggle`) en el login y el panel.
- Colores fijos de las pantallas reemplazados por tokens; `index.html` en español con las fuentes nuevas.
- `package.json` y `package-lock.json`: se agrega `@angular/animations`.

## Verificado
Compilación de desarrollo y de producción con todas las rutas, sin errores ni avisos de presupuesto. No se probó en un navegador ni se ejecutaron los tests.
