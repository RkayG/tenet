# Multi-stage build for Tenet Framework
# 1. Dependency Stage
FROM node:18-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

# 2. Build Stage
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run db:generate
RUN pnpm run build

# 3. Production Stage
FROM node:18-alpine AS prod
RUN corepack enable
WORKDIR /app

# Copy production dependencies and built assets
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile
RUN pnpm run db:generate

EXPOSE 3000
CMD ["node", "dist/server.js"]
