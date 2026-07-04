FROM node:20-alpine

# Generic Node project runner for uploaded Baileys bots.
# unzip: extract uploaded project ZIPs. git: some npm deps install from git.
RUN apk add --no-cache unzip git

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src/

RUN mkdir -p /data/projects

CMD ["node", "src/index.js"]
