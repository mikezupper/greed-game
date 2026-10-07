FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY vendor ./vendor
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.21.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/.data
COPY package*.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src ./src
COPY scripts/backup.ts ./scripts/backup.ts
RUN mkdir .data && chown node:node .data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server/main.ts"]
