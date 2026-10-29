# ============================================
# Etapa 1: compilar Angular (Node 22)
# ============================================
FROM node:22-alpine AS build
WORKDIR /app

# Dependencias en capa separada: solo se reinstalan si cambia el lock
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# URL publica del backend (incluye /api). En Railway se define como variable
# del servicio frontend: API_URL=https://<tu-backend>.up.railway.app/api
# Es una constante de compilacion: si cambia, hay que volver a desplegar.
ARG API_URL
RUN if [ -n "$API_URL" ]; then \
      sed -i "s|https://TU-BACKEND.up.railway.app/api|$API_URL|" src/environments/environment.ts; \
    fi \
 && if grep -q "TU-BACKEND" src/environments/environment.ts; then \
      echo "ERROR: falta la variable API_URL (URL del backend con /api)" >&2; exit 1; \
    fi

RUN npx ng build --configuration production

# ============================================
# Etapa 2: servir estaticos con nginx
# ============================================
FROM nginx:1.27-alpine

# La imagen oficial aplica envsubst a /etc/nginx/templates/*.template al iniciar,
# asi nginx escucha en el $PORT que inyecta Railway.
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/avance-produccion-frontend/browser /usr/share/nginx/html

EXPOSE 8080
