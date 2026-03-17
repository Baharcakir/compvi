# Frontend Dockerfile for Railway (and any host that injects $PORT)
#
# The difference from the local Dockerfile: nginx needs to listen on whatever
# port Railway assigns ($PORT), not hardcoded 80. We use envsubst to replace
# $PORT in the nginx config at container startup.

# =============================================================================
# Stage 1 — build React app
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

ARG VITE_WS_URL=""
ARG VITE_API_URL=""
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# =============================================================================
# Stage 2 — nginx with dynamic $PORT support
# =============================================================================
FROM nginx:1.25-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

COPY --from=builder /app/dist /usr/share/nginx/html

# Use a template — envsubst fills in $PORT at startup
COPY nginx/nginx.conf /etc/nginx/templates/default.conf.template

# $PORT default — Railway always overrides this
ENV PORT=80

EXPOSE $PORT

# envsubst replaces $PORT in the template, then nginx starts
CMD ["/bin/sh", "-c", "envsubst '$PORT $BACKEND_HOST' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]