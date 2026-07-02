FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY prisma ./prisma/
RUN npm install

# openssl is required for Prisma to correctly detect the libssl version at
# generate time; without it, Prisma silently falls back to openssl-1.1.x
# even when binaryTargets explicitly lists linux-musl-openssl-3.0.x, which
# then fails to load at runtime ("Error loading shared library libssl.so.1.1").
RUN apk add --no-cache openssl

RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/dist ./dist/

# openssl is also needed at runtime: Prisma re-detects the libssl version
# when the query engine starts, not just at generate time.
RUN apk add --no-cache openssl

CMD ["node", "dist/index.js"]
