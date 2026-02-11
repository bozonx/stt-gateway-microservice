ARG NODE_MAJOR=22
FROM node:${NODE_MAJOR}-alpine AS builder

WORKDIR /app

ENV NODE_ENV=production
ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=8080
ENV TZ=UTC
ENV LOG_LEVEL=warn

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prefer-offline || pnpm install --prefer-offline

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY test ./test
COPY jest.config.ts jest.d.ts ./
RUN pnpm build
RUN pnpm prune --prod

FROM node:${NODE_MAJOR}-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=8080
ENV TZ=UTC
ENV LOG_LEVEL=warn

RUN apk add --no-cache tini curl

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8080

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/src/entry-node.js"]
