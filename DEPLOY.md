# Guia de Deploy — Bot Hosting Platform

---

## ATENÇÃO

Todos os comandos são executados **na VPS via SSH** (Linux/Ubuntu).  
Não execute no Windows CMD ou PowerShell.

---

## Requisitos da VPS

| Recurso | Mínimo     | Recomendado    |
|---------|------------|----------------|
| CPU     | 2 vCPU     | 4 vCPU         |
| RAM     | 4 GB       | 8 GB           |
| Disco   | 40 GB SSD  | 80 GB SSD      |
| SO      | Ubuntu 22.04 ou 24.04 LTS    |

---

> **Queres testar tudo em `localhost` com Supabase antes de tocar na VPS?**
> Consulta **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** — usa
> `docker-compose.supabase.yml` e não precisa de Postgres local nem de VPS.

---

## Deploy Rápido (num único script)

```bash
# 1. Ligar à VPS
ssh root@SEU_IP

# 2. Clonar o repositório
git clone https://github.com/Pachir4428/hostagente.git
cd hostagente

# 3. Executar setup completo (instala Docker, nano, vim, Node, firewall)
bash scripts/setup-vps.sh

# 4. Configurar variáveis de ambiente
cp .env.example .env
nano .env       # editar senhas e secrets

# 5. Build e deploy
bash scripts/deploy.sh
```

Após o deploy:
- **API:**      http://SEU_IP:3000
- **Frontend:** http://SEU_IP:3001
- **Health:**   http://SEU_IP:3000/health

---

## Passo a Passo Manual

### 1 — Instalar dependências

```bash
apt update
apt install -y docker.io docker-compose-v2 git nano vim curl openssl
systemctl enable --now docker
docker network create bot-network
```

### 2 — Clonar e configurar

```bash
git clone https://github.com/Pachir4428/hostagente.git
cd hostagente
cp .env.example .env
nano .env
```

Gerar secrets seguros:
```bash
openssl rand -hex 32   # executar 3 vezes para JWT_SECRET, JWT_REFRESH_SECRET, INTERNAL_SECRET
```

Preencher o `.env`:
```env
POSTGRES_PASSWORD=UmaPasswordForte123!
REDIS_PASSWORD=OutraPassword456!
JWT_SECRET=resultado_do_openssl
JWT_REFRESH_SECRET=outro_resultado_openssl
INTERNAL_SECRET=mais_um_resultado_openssl
FRONTEND_URL=http://localhost:3001
FRONTEND_API_URL=http://localhost:3000
APP_VERSION=1.0.0

# Cookies de autenticação
COOKIE_SECURE=false        # true em produção com HTTPS
COOKIE_SAMESITE=lax

# Segredos de webhook (obrigatórios em produção)
MPESA_WEBHOOK_SECRET=resultado_do_openssl
EMOLA_WEBHOOK_SECRET=resultado_do_openssl
MKESH_WEBHOOK_SECRET=resultado_do_openssl
```

> **Sem domínio?** Deixe `FRONTEND_URL=http://localhost:3001` e `COOKIE_SECURE=false`.  
> **Com domínio + HTTPS?** Use `FRONTEND_URL=https://seudominio.com` e `COOKIE_SECURE=true` — obrigatório para as cookies de autenticação funcionarem.

### 3 — Build das imagens

```bash
docker build -t bot-platform-api:latest    ./apps/api
docker build -t bot-platform-runner:latest ./apps/bot-runner
docker build -t bot-platform-worker:latest ./apps/worker
docker build -t bot-engine:latest          ./apps/bot-engine
docker build -t bot-platform-web:latest    ./apps/web
```

### 4 — Iniciar serviços

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 5 — Migrações da base de dados

```bash
# Aguardar o container "api" ficar saudável e depois:
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

### 6 — Verificar

```bash
docker compose -f docker-compose.prod.yml ps
# O host normalmente não tem `curl` instalado — testa a partir de dentro do container:
docker compose -f docker-compose.prod.yml exec api curl -sf http://localhost:3000/health
```

---

## VPS com 2GB RAM — Análise e Solução

### Por que o compose completo não cabe em 2GB

| Serviço | RSS idle | RSS pico |
|---------|----------|---------|
| OS + Docker daemon | — | ~350 MB |
| postgres | 30 MB | 100 MB |
| redis | 5 MB | 30 MB |
| api (NestJS) | 120 MB | 250 MB |
| web (Next.js) | 150 MB | 280 MB |
| bot-runner | 80 MB | 180 MB |
| worker | 80 MB | 200 MB |
| **Total completo** | **~815 MB** | **~1 390 MB** |

O total máximo é ~1,4 GB mas os **picos de startup** (NestJS a carregar todos os módulos em simultâneo) podem passar de 2 GB temporariamente e causar OOM.

> **`deploy.resources.limits.memory` no docker-compose.prod.yml é ignorado** pelo `docker compose` fora do modo Swarm. Só `mem_limit` ao nível do serviço é respeitado.

---

### Solução: usar `docker-compose.small.yml`

Este ficheiro usa `mem_limit` real, limita postgres e redis, e não inclui `bot-runner` nem `worker`:

```bash
# 1. Criar swap de 2 GB (obrigatório — cobre picos de startup)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10

# 2. Deploy dos serviços essenciais
docker compose -f docker-compose.small.yml up -d
```

**Orçamento de memória do `docker-compose.small.yml`:**

| Serviço | `mem_limit` | RSS real idle |
|---------|------------|---------------|
| postgres | 150 MB | ~40 MB |
| redis | 64 MB | ~10 MB |
| api | 280 MB | ~130 MB |
| web | 300 MB | ~160 MB |
| OS + Docker | — | ~350 MB |
| **Total** | **794 MB** | **~690 MB** |

Com 2 GB de swap, os picos de arranque são absorvidos sem OOM.

---

### Adicionar bot-runner e worker depois

Só activar quando `docker stats` mostrar RAM disponível:

```bash
# Ver uso em tempo real
docker stats --no-stream

# Adicionar bot-runner (orquestrador de containers WhatsApp)
docker compose -f docker-compose.prod.yml up -d bot-runner

# Adicionar worker (processamento de mensagens / IA)
docker compose -f docker-compose.prod.yml up -d worker
```

---

### Monitorização

```bash
docker stats
docker compose -f docker-compose.small.yml ps
docker compose -f docker-compose.small.yml logs -f api
```


---

## Comandos do Dia-a-Dia

```bash
# Estado dos serviços
docker compose -f docker-compose.prod.yml ps

# Logs em tempo real
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f bot-runner

# Reiniciar um serviço
docker compose -f docker-compose.prod.yml restart api

# Parar tudo
docker compose -f docker-compose.prod.yml down

# Uso de recursos
docker stats
```

---

## Atualizar após novo push no GitHub

```bash
cd hostagente
git pull

# Uso normal (usa cache do Docker — builds mais rápidos)
docker build -t bot-platform-api:latest ./apps/api
docker compose -f docker-compose.prod.yml up -d --no-deps api

# Se a atualização mudou apenas ficheiros de configuração (schema.prisma,
# tsconfig.json, Dockerfile) o Docker pode reaproveitar uma camada em cache
# desatualizada. Nesse caso reconstrói sem cache:
docker build --no-cache -t bot-platform-api:latest ./apps/api

# Ou, de forma mais simples, usa o Makefile:
make deploy-no-cache
```

---

## Resolução de Problemas

Esta secção documenta, por ordem cronológica típica, os erros mais comuns ao construir e subir a stack pela primeira vez numa VPS nova.

### `nano: command not found`
```bash
apt install -y nano
```

### `npm: command not found` (na VPS, fora do container)
```bash
apt install -y nodejs npm
# OU via nodesource:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### `docker-compose: command not found`
```bash
apt install -y docker-compose-v2
# Usar sempre: docker compose (com espaço, sem hífen)
```

### `curl: command not found` ao testar `/health`
O **host** da VPS pode não ter `curl` instalado — mas a imagem `api` já o inclui.
Testa sempre a partir de dentro do container, nunca do host:
```bash
docker compose -f docker-compose.prod.yml exec api curl -sf http://localhost:3000/health
```

### `pull access denied for bot-platform-web` (ou qualquer outra imagem)
Significa que a imagem **não foi construída localmente** — o Docker tentou baixá-la
de um registry remoto que não existe. Constrói a imagem em falta antes do `up -d`:
```bash
docker build -t bot-platform-web:latest ./apps/web
```
Confirma que todas as 5 imagens existem antes de subir a stack:
```bash
docker images | grep -E "bot-platform|bot-engine"
```

### `unable to evaluate symlinks in Dockerfile path: ... no such file or directory`
O código local está desatualizado em relação ao GitHub (Dockerfile ainda não existia
quando o repositório foi clonado). Atualiza e tenta de novo:
```bash
git fetch origin
git checkout main
git pull origin main
```

### Erro `tsc`: `Cannot read file '/tsconfig.base.json'`
Cada app (`apps/api`, `apps/worker`, `apps/bot-runner`) tem o seu próprio
`tsconfig.json` autossuficiente — não depende de ficheiros fora do contexto de
build do Docker. Se este erro voltar a aparecer após um `git pull`, confirma que
puxaste a versão mais recente e reconstrói sem cache (`docker build --no-cache ...`).

### Erro `tsc`: `This expression is not callable` (helmet, compression, cookie-parser)
Corrigido usando `import helmet from 'helmet'` (import default) em vez de
`import * as helmet from 'helmet'` (import de namespace, não invocável). Se
customizares `src/main.ts`, mantém os imports como `default import`.

### `COPY failed: file not found ... stat prisma / stat public`
Os Dockerfiles copiam apenas pastas que existem no contexto de build. Se
adicionares uma nova dependência do Prisma a um app, garante que existe uma
pasta `prisma/schema.prisma` dentro desse app (ex: `apps/worker/prisma/schema.prisma`)
e que o Dockerfile tem `COPY prisma ./prisma/` seguido de `RUN npx prisma generate`.

### `PrismaClientInitializationError: ... Error loading shared library libssl.so.1.1`
O Node Alpine usa OpenSSL 3.x, mas o Prisma por padrão gera um engine para
OpenSSL 1.1. Isto precisa de **duas** correções, ambas já aplicadas:

1. `binaryTargets` no `schema.prisma`:
   ```prisma
   generator client {
     provider      = "prisma-client-js"
     binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
   }
   ```
2. **O binário `openssl` tem de estar instalado na imagem** — sem ele, o
   Prisma não consegue detectar a versão do OpenSSL (mostra o aviso
   `Prisma failed to detect the libssl/openssl version`) e assume 1.1 de
   qualquer forma, ignorando o `binaryTargets`. Os `Dockerfile` de `apps/api`
   e `apps/worker` já correm `apk add --no-cache openssl` tanto no estágio de
   build (antes do `prisma generate`) como no estágio final de runtime (o
   engine volta a detectar a versão do OpenSSL quando a app arranca).

Se este erro reaparecer, confirma que o teu `git pull` trouxe as duas
correções e reconstrói **sem cache**:
```bash
git pull origin main
docker build --no-cache -t bot-platform-api:latest ./apps/api
docker build --no-cache -t bot-platform-worker:latest ./apps/worker
```

### `npm ci` error / package-lock.json missing
```bash
# Já corrigido nos Dockerfiles (usa npm install)
# Se persistir: git pull e rebuildar
```

### Container `api` ou `worker` fica em `Restarting`
```bash
docker compose -f docker-compose.prod.yml logs api --tail=50
docker compose -f docker-compose.prod.yml logs worker --tail=50
```
Os erros mais comuns já cobertos acima (Prisma/OpenSSL, imports quebrados). Após
corrigir, reconstrói **sem cache** a imagem afetada e sobe de novo:
```bash
docker build --no-cache -t bot-platform-api:latest ./apps/api
docker compose -f docker-compose.prod.yml up -d
```

### Erro de migrações
```bash
# Verificar se o postgres está a correr
docker compose -f docker-compose.prod.yml ps postgres
# Tentar novamente a migração
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

### Erro `tzdata` durante apt upgrade (Ubuntu 24.04)
```bash
export DEBIAN_FRONTEND=noninteractive
ln -fs /usr/share/zoneinfo/Africa/Maputo /etc/localtime
echo "Africa/Maputo" > /etc/timezone
apt install --reinstall -y tzdata
dpkg --configure -a
```

### `dpkg` error ao instalar Docker: `trying to overwrite '/usr/libexec/docker/cli-plugins/docker-compose'`
Acontece quando a VPS já tinha `docker-compose-v2` instalado via apt do
Ubuntu e o script tenta instalar o `docker-compose-plugin` oficial da Docker
(mesmo ficheiro, pacotes diferentes). Remove o pacote antigo primeiro:
```bash
apt-get remove -y docker-compose-v2
dpkg --configure -a
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### `nginx -t` falha com `open() ".../sites-enabled/bot-platform.conf" failed (2: No such file or directory)`
Em VPS com painel de hosting (cPanel/Virtualmin/DirectAdmin), o `nginx.conf`
principal pode referenciar explicitamente `sites-enabled/bot-platform.conf`
(com extensão `.conf`) em vez de usar wildcard. Garante que tanto o ficheiro
em `sites-available` como o link em `sites-enabled` têm a extensão `.conf`:
```bash
ln -sf /etc/nginx/sites-available/bot-platform.conf /etc/nginx/sites-enabled/bot-platform.conf
nginx -t
```

### VPS já tem Apache/Exim/BIND (painel de hosting pré-configurado)
Se `nginx` não conseguir arrancar porque a porta 80 já está em uso, a VPS
provavelmente já corre Apache (comum em VPS com painel de hosting
pré-instalado). Ou usas portas diferentes para a app (`IP:3000`/`IP:3001`,
sem nginx/SSL), ou paras o Apache conscientemente:
```bash
systemctl stop apache2
systemctl disable apache2
systemctl start nginx
```
⚠️ Isto derruba qualquer site que já esteja a correr via Apache nesta VPS —
confirma antes que não há nada crítico lá.

---

## Com Domínio + SSL (Opcional)

```bash
apt install -y nginx certbot python3-certbot-nginx
nano /etc/nginx/sites-available/bot-platform.conf
```

Conteúdo do ficheiro nginx (substituir `seudominio.com`):

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/bot-platform.conf /etc/nginx/sites-enabled/bot-platform.conf
nginx -t && systemctl reload nginx
certbot --nginx -d seudominio.com --non-interactive --agree-tos --email teu@email.com
```

> **Importante após activar HTTPS:** edite o `.env` e defina:
> ```env
> FRONTEND_URL=https://seudominio.com
> COOKIE_SECURE=true
> ```
> Sem `COOKIE_SECURE=true`, o browser rejeita os cookies de autenticação em HTTPS.

---

## Arquitetura

```
Internet
   │
   ▼
[Nginx :80/:443]  ← SSL via Certbot (opcional, só com domínio)
   ├── Frontend Next.js  :3001
   └── API NestJS        :3000
           ├── PostgreSQL    (interno)
           └── Redis         (interno)
                ├── Worker BullMQ
                └── Bot Runner → containers isolados por bot
```
