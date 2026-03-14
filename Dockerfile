FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y \
  openssl libcairo2 libpango1.0-0 libjpeg-dev libgif-dev librsvg2-dev \
  python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate

FROM base AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/@napi-rs ./node_modules/@napi-rs
COPY --from=builder /app/seed.js ./seed.js
COPY --from=deps /app/node_modules/bcryptjs ./node_modules/bcryptjs

RUN mkdir -p /data && chown nextjs:nodejs /data
USER nextjs

EXPOSE 8080
CMD ["sh", "-c", "node /app/seed.js && exec node /app/server.js"]
