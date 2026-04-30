FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S zerogap -u 1001
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder --chown=zerogap:nodejs /app/dist ./dist
USER zerogap
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:5000/health || exit 1
CMD ["node", "dist/server.js"]
