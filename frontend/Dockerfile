# =============================================================================
# Stage 1 — build the React app with Vite
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cached layer — only re-runs if package.json changes)
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy source and build
# FIX: VITE_WS_URL and VITE_API_URL are intentionally left empty.
# The frontend uses relative paths (/ws/detect, /upload) so the browser
# sends requests to the same origin that served the HTML. nginx then
# proxies them to the backend container. Baking in "localhost" or any
# absolute URL here would break every non-local deployment.
ARG VITE_WS_URL=""
ARG VITE_API_URL=""
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# =============================================================================
# Stage 2 — serve with nginx
# =============================================================================
FROM nginx:1.25-alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace default nginx config with our proxy config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Remove the default nginx.conf listen block so ours is the only one
RUN rm -f /etc/nginx/conf.d/default.conf.bak

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]