# ─── Stage 1: deps ─────────────────────────────────────────────────────────────
# Install ALL dependencies (including devDeps needed for build)

FROM node:22-alpine AS deps

WORKDIR /app

# Copy only the manifests first — Docker caches this layer until they change
COPY package.json package-lock.json ./
COPY prisma.config.ts ./

RUN npm ci --frozen-lockfile

# ─── Stage 2: builder ──────────────────────────────────────────────────────────
# Generate Prisma client and compile TypeScript

FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the custom Prisma client output
RUN npx prisma generate --schema=./prisma/schema

# Compile TypeScript → /dist
RUN npm run build

# ─── Stage 3: production ───────────────────────────────────────────────────────
# Minimal runtime image — no devDependencies, no TypeScript source

FROM node:22-alpine AS production

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nodeuser

# Copy only what's needed to run
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodeuser:nodejs /app/prisma.config.ts ./prisma.config.ts

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev \
 && npm cache clean --force

USER nodeuser

EXPOSE 5000

# Healthcheck — matches docker-compose healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]