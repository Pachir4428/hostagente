FROM node:20-alpine

# Baileys talks to WhatsApp over websockets — no Chromium/puppeteer needed.
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src/

RUN mkdir -p /data/sessions /data/scripts

CMD ["node", "src/index.js"]
