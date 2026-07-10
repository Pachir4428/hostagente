#!/bin/bash
# Configura HTTPS para o HostAgente com nginx + Let's Encrypt.
# Não precisas de comprar domínio: por omissão usa um domínio sslip.io que
# aponta para o IP público desta VPS (ex.: 185-27-135-66.sslip.io).
#
# Uso:
#   sudo bash scripts/setup-https.sh                # domínio sslip.io automático
#   sudo bash scripts/setup-https.sh meu.dominio.com  # domínio próprio
set -e

if [ "$(id -u)" != "0" ]; then
  echo "Corre com sudo: sudo bash scripts/setup-https.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Domínio: argumento, ou sslip.io a partir do IP público.
DOMAIN="$1"
if [ -z "$DOMAIN" ]; then
  IP="$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')"
  DOMAIN="$(echo "$IP" | tr '.' '-').sslip.io"
fi
echo "Domínio a usar: $DOMAIN"

# Dependências
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx curl

# Config nginx (HTTP; o certbot acrescenta o SSL a seguir)
cat > /etc/nginx/sites-available/hostagente.conf << NGINX
server {
    listen 80;
    server_name $DOMAIN;

    # Painel (Next.js) na 3001
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # API (NestJS) na 3000, servida em /api
    location /api/ {
        rewrite ^/api/(.*)\$ /\$1 break;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 20m;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/hostagente.conf /etc/nginx/sites-enabled/hostagente.conf
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx

# Abrir portas HTTP/HTTPS se o ufw estiver ativo
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

# Emitir/instalar certificado (redireciona HTTP->HTTPS automaticamente)
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || {
  echo "certbot falhou. Confirma que a porta 80 está acessível e que $DOMAIN aponta para este IP."
  exit 1
}

echo ""
echo "==================================================================="
echo " HTTPS pronto:  https://$DOMAIN"
echo "==================================================================="
echo ""
echo "FALTA 1 PASSO — reconstruir o painel a apontar para a API em HTTPS:"
echo ""
echo "  cd $ROOT_DIR"
echo "  # garante que o .env tem esta linha (o painel chama a API na mesma origem):"
echo "  grep -q '^FRONTEND_API_URL=' .env && \\"
echo "    sed -i 's#^FRONTEND_API_URL=.*#FRONTEND_API_URL=https://$DOMAIN/api#' .env || \\"
echo "    echo 'FRONTEND_API_URL=https://$DOMAIN/api' >> .env"
echo "  bash scripts/deploy.sh --no-cache"
echo ""
echo "Depois abre  https://$DOMAIN  — cadeado verde e PWA instalável. 🎉"
