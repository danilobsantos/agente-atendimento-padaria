# syntax=docker/dockerfile:1

# Both production services share this image. Docker Compose selects the process
# to run: Next.js for `web` and Socket.IO for `websocket`.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
# Keep development dependencies because the websocket service runs through tsx.
RUN npm ci

FROM dependencies AS builder
WORKDIR /app

COPY . .

# The Prisma client is generated into src/generated/prisma and is intentionally
# not committed to the repository.
RUN npx prisma generate

# NEXT_PUBLIC_* variables are embedded by Next.js at build time. They are
# intentionally build arguments, never secrets.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_WEBSOCKET_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_WEBSOCKET_URL=${NEXT_PUBLIC_WEBSOCKET_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# tsx is a development dependency but is required at runtime by
# `npm run websocket`; copy the complete dependency tree deliberately.
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/src/server ./src/server

EXPOSE 3000 3001

# Docker Compose overrides this command for the websocket service.
CMD ["npm", "run", "start"]
