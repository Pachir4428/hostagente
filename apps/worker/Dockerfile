FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY prisma ./prisma/
RUN npm install

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

CMD ["node", "dist/index.js"]
