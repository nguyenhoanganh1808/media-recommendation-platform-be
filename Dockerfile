FROM node:slim AS builder
LABEL stage=builder

WORKDIR /app

RUN npm install -g pnpm

RUN apt-get update -y && apt-get install -y openssl

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma generate

RUN pnpm build

FROM node:slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/cert ./dist/src/cert

EXPOSE 3443

CMD ["node", "dist/src/server.js"]