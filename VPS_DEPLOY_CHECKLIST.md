# 🚀 Checklist de Deploy — Bot Hosting Platform

## ✅ PRÉ-REQUISITOS (na VPS)
- [ ] Ubuntu 22.04 ou 24.04 LTS
- [ ] Mínimo: 2 vCPU, 4GB RAM, 40GB SSD
- [ ] Acesso SSH como root
- [ ] Domínio apontando para o IP da VPS (opcional)

---

## 🔧 PASSO 1: Conectar à VPS

```bash
ssh root@SEU_IP_DA_VPS
```

---

## 📦 PASSO 2: Setup Inicial (Automático)

```bash
# Clonar repositório
git clone https://github.com/Pachir4428/hostagent.git
cd hostagent

# Executar setup (instala Docker, Node, Firewall, etc)
bash scripts/setup-vps.sh
```

**O que o setup faz:**
- Atualiza sistema (apt-get update/upgrade)
- Instala Docker e Docker Compose
- Instala Node.js v20
- Configura Firewall (ufw)
- Instala Nginx e Certbot (SSL)
- Configura timezone

---

## 🔐 PASSO 3: Configurar Variáveis de Ambiente

```bash
# Copiar exemplo
cp .env.example .env

# Editar com valores reais
nano .env
```

**Variáveis obrigatórias a editar:**

```env
# Senhas (MUDAR!)
POSTGRES_PASSWORD=Nova_Senha_Postgres_123!
REDIS_PASSWORD=Nova_Senha_Redis_456!

# JWT Secrets (gerar com openssl rand -hex 32)
JWT_SECRET=seu_jwt_secret_aqui
JWT_REFRESH_SECRET=seu_refresh_secret_aqui
INTERNAL_SECRET=seu_internal_secret_aqui

# URLs (trocar pelo seu domínio/IP)
FRONTEND_URL=https://seudominio.com
FRONTEND_API_URL=https://api.seudominio.com

# Cookies — OBRIGATÓRIO true em produção HTTPS
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

# Segredos de webhook de pagamento (gerar com openssl rand -hex 32)
MPESA_WEBHOOK_SECRET=segredo_mpesa
EMOLA_WEBHOOK_SECRET=segredo_emola
MKESH_WEBHOOK_SECRET=segredo_mkesh
```

**Gerar todos os secrets de uma vez:**

```bash
for var in JWT_SECRET JWT_REFRESH_SECRET INTERNAL_SECRET MPESA_WEBHOOK_SECRET EMOLA_WEBHOOK_SECRET MKESH_WEBHOOK_SECRET; do
  echo "$var=$(openssl rand -hex 32)"
done
```

---

## 🐳 PASSO 4: Build e Deploy

```bash
# Verificar .env
cat .env | grep -E "JWT_SECRET|POSTGRES_PASSWORD|REDIS_PASSWORD"

# Fazer deploy (build das imagens Docker + containers)
bash scripts/deploy.sh
```

**O script deploy.sh:**
1. ✅ Valida variáveis do .env
2. ✅ Faz git pull (atualiza código)
3. ✅ Build das imagens Docker
4. ✅ Sobe containers (postgres, redis, api, web, worker, etc)
5. ✅ Cria volumes para dados persistentes

---

## 🌍 PASSO 5: Configurar Nginx (SSL/HTTPS)

```bash
# Editar configuração Nginx
nano /etc/nginx/sites-available/bot-platform.conf

# Ativar site
ln -s /etc/nginx/sites-available/bot-platform.conf /etc/nginx/sites-enabled/

# Testar configuração
nginx -t

# Recarregar Nginx
systemctl reload nginx

# Gerar certificado SSL (Certbot)
certbot certonly --nginx -d seudominio.com -d api.seudominio.com
```

---

## 📋 PASSO 6: Verificar Deployment

```bash
# Ver status dos containers
docker ps -a

# Ver logs (tempo real)
docker compose -f docker-compose.prod.yml logs -f api

# Testar API
curl http://localhost:3000/health

# Testar Frontend
curl http://localhost:3001
```

---

## ✨ Após Deploy bem-sucedido

- **API:**       https://api.seudominio.com (ou http://IP:3000)
- **Frontend:**  https://seudominio.com (ou http://IP:3001)
- **Health:**    https://api.seudominio.com/health
- **Banco:**     PostgreSQL em container (backup: `/var/lib/docker/volumes`)
- **Cache:**     Redis em container

---

## 🔄 Atualizar Código em Produção

```bash
cd /root/hostagent1
git pull origin main
bash scripts/deploy.sh
```

---

## 🚨 Troubleshooting

### Container não sobe?
```bash
docker logs container_name
docker compose -f docker-compose.prod.yml logs api
```

### Erro de conexão ao banco?
```bash
# Verificar se Postgres está rodando
docker ps | grep postgres

# Conectar ao banco para testar
docker exec -it bot-postgres psql -U postgres -d bothosting
```

### Nginx não encontra upstream?
```bash
# Testar resolução DNS
nslookup localhost
curl -v http://localhost:3000
```

### Sem espaço em disco?
```bash
df -h
docker system prune -a  # Remove images não utilizadas
```

---

## 📊 Monitoramento Contínuo

```bash
# Ver uso de recursos
docker stats

# Ver logs consolidados
docker compose -f docker-compose.prod.yml logs --tail=100 -f

# Backup do banco de dados
docker exec bot-postgres pg_dump -U postgres bothosting > backup.sql
```

---

## 🔒 Segurança

- [ ] Firewall ativo (UFW)
- [ ] SSH apenas com chaves (sem password)
- [ ] Certificado SSL/TLS instalado
- [ ] `.env` com permissões restritas: `chmod 600 .env`
- [ ] Todas as senhas e secrets diferentes dos exemplos
- [ ] `COOKIE_SECURE=true` definido (obrigatório com HTTPS)
- [ ] Segredos de webhook configurados (`*_WEBHOOK_SECRET`)
- [ ] Backups automáticos do banco configurados

---

**Dúvidas ou problemas?** Consulte `DEPLOY.md` ou `README.md`
