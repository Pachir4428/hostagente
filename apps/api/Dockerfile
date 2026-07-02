FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# openssl is required for Prisma to correctly detect the libssl version at
# generate time; without it, Prisma silently falls back to openssl-1.1.x
# even when binaryTargets explicitly lists linux-musl-openssl-3.0.x, which
# then fails to load at runtime ("Error loading shared library libssl.so.1.1").
RUN apk add --no-cache openssl

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY tsconfig.json ./
COPY nest-cli.json ./
COPY src ./src/

# Build
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/dist ./dist/

# openssl is also needed at runtime: Prisma re-detects the libssl version
# when the query engine starts, not just at generate time.
RUN apk add --no-cache curl openssl

EXPOSE 3000

CMD ["node", "dist/main"]
