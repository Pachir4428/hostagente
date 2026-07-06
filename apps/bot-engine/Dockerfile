FROM node:20-alpine

# Tools most Baileys projects need at runtime/build:
#  - unzip: extract uploaded project ZIPs
#  - git: some npm deps install from git
#  - ffmpeg: audio/video/sticker processing
#  - python3/make/g++ (build-base): native npm modules (sharp, etc.)
#  - bash: many uploaded scripts use bash
RUN apk add --no-cache unzip git ffmpeg bash python3 make g++ libc6-compat

# `pkg` shim so Termux-style commands work here (Alpine uses apk):
#   pkg install X   -> apk add X
#   pkg update/upgrade -> apk update/upgrade
#   nodejs-lts -> nodejs
RUN printf '%s\n' \
  '#!/bin/sh' \
  'cmd="$1"; shift 2>/dev/null || true' \
  'args=""' \
  'for a in "$@"; do [ "$a" = "-y" ] && continue; a=$(echo "$a" | sed "s/nodejs-lts/nodejs/"); args="$args $a"; done' \
  'case "$cmd" in' \
  '  install|add) exec apk add --no-cache $args ;;' \
  '  uninstall|remove) exec apk del $args ;;' \
  '  update) exec apk update ;;' \
  '  upgrade) exec apk upgrade ;;' \
  '  *) echo "pkg: comando $cmd mapeado para apk"; exec apk $cmd $args ;;' \
  'esac' \
  > /usr/local/bin/pkg && chmod +x /usr/local/bin/pkg

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src/

RUN mkdir -p /data/projects

CMD ["node", "src/index.js"]
