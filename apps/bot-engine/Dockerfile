FROM node:20-alpine

# Install chromium and dependencies for puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    udev \
    && rm -rf /var/cache/apk/*

# Tell puppeteer to use system chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_BIN=/usr/bin/chromium-browser

WORKDIR /app

COPY package.json ./
RUN npm install

COPY src ./src/

RUN mkdir -p /data/sessions

EXPOSE 5000

CMD ["node", "src/index.js"]
