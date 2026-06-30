# Bot Hosting Platform

Plataforma completa para hospedar, gerir e monitorizar bots WhatsApp com interface web, IA integrada e pagamentos para Moçambique (M-Pesa, e-Mola, mKesh).

## Funcionalidades

- Bots WhatsApp — Ligação via QR Code ou Código de Emparelhamento
- Upload de Scripts — Carregue bots personalizados via `.zip` ou `.js`
- IA Integrada — Respostas automáticas com OpenAI, Anthropic, Gemini
- Pagamentos — M-Pesa, e-Mola, mKesh (planos FREE / PRO / ENTERPRISE)
- Suporte — Sistema de tickets com mensagens encadeadas
- Multi-tenant — Cada utilizador tem os seus bots completamente isolados
- Real-time — WebSocket para QR Code, status e código de emparelhamento
- SMTP — Envio de e-mails configurável por utilizador

---

## Arquitetura

```
hostagent1/
├── apps/
│   ├── api/          → NestJS — REST API + WebSocket
│   ├── bot-runner/   → Orquestrador Docker (1 container por bot)
│   ├── bot-engine/   → Baileys WhatsApp (corre dentro de cada container)
│   ├── worker/       → BullMQ — processamento de mensagens + IA
│   └── web/          → Next.js 14 — Interface web
├── nginx/            → Configuração Nginx + SSL
├── docker-compose.yml        → Desenvolvimento local
└── docker-compose.prod.yml   → Produção
```

---

## Stack

| Camada    | Tecnologia                              |
|-----------|-----------------------------------------|
| API       | NestJS 10, Prisma, PostgreSQL 16        |
| Filas     | BullMQ + Redis 7                        |
| Bots      | Baileys (WhatsApp), Dockerode           |
| Frontend  | Next.js 14 App Router, Tailwind CSS     |
| Real-time | Socket.io + Redis Pub/Sub               |
| Auth      | JWT em cookies httpOnly (access 15m + refresh 7d) |
| Infra     | Docker, Nginx, Certbot SSL              |

---

## Requisitos da VPS

| Recurso | Mínimo     | Recomendado |
|---------|------------|-------------|
| CPU     | 2 vCPU     | 4 vCPU      |
| RAM     | 4 GB       | 8 GB        |
| Disco   | 40 GB SSD  | 80 GB SSD   |
| SO      | Ubuntu 22.04 ou 24.04 LTS | Ubuntu 24.04 LTS |

> Testado em: Hetzner, Contabo, DigitalOcean, AWS EC2.

---

## Deploy em Produção — Guia Rápido

> Guia completo com todos os detalhes em **[DEPLOY.md](./DEPLOY.md)**

```bash
# 1. Ligar à VPS como root
ssh root@SEU_IP

# 2. Instalar Docker (Ubuntu)
apt update && apt install -y docker.io docker-compose-v2 git
systemctl enable --now docker

# 3. Clonar o repositório
git clone https://github.com/Pachir4428/hostagent1.git
cd hostagent1

# 4. Configurar variáveis de ambiente
cp .env.example .env
nano .env      # preencher com os seus valores

# 5. Criar rede Docker e fazer build
docker network create bot-network
docker build -t bot-platform-api:latest    ./apps/api
docker build -t bot-platform-runner:latest ./apps/bot-runner
docker build -t bot-platform-worker:latest ./apps/worker
docker build -t bot-engine:latest          ./apps/bot-engine
docker build -t bot-platform-web:latest    ./apps/web

# 6. Subir os serviços
docker compose -f docker-compose.prod.yml up -d

# 7. Executar migrações da base de dados
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Acesso:
#   API:      http://SEU_IP:3000
#   Frontend: http://SEU_IP:3001
#   Health:   http://SEU_IP:3000/health
```

---

## Comandos do Dia-a-Dia

```bash
# Ver estado dos serviços
docker compose -f docker-compose.prod.yml ps

# Logs em tempo real
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker

# Reiniciar um serviço
docker compose -f docker-compose.prod.yml restart api

# Parar tudo
docker compose -f docker-compose.prod.yml down

# Atualizar após novo push
git pull
docker build -t bot-platform-api:latest ./apps/api
docker compose -f docker-compose.prod.yml up -d --no-deps api

# Uso de recursos
docker stats
```

---

## Portas Utilizadas

| Porta | Serviço              |
|-------|----------------------|
| 3000  | API NestJS           |
| 3001  | Frontend Next.js     |
| 5432  | PostgreSQL (interno) |
| 6379  | Redis (interno)      |
| 4001  | Bot Runner (interno) |

---

## Segurança

- Tokens JWT em **cookies httpOnly** — nunca expostos a JavaScript (protecção XSS)
- Access token (15 min) + refresh token (7 dias); endpoint `/auth/refresh` para rotação automática
- Rate limiting global + limites apertados nos endpoints de autenticação (brute force)
- Validação de senha forte obrigatória no registo e reset (min 8 chars, upper/lower/digit)
- Webhooks de pagamento verificados por **HMAC-SHA256** sobre o corpo original (timing-safe)
- CORS sem wildcard `*` quando `credentials: true` — allowlist explícita por env var
- Comunicação API ↔ Runner com segredo interno (`x-internal-secret`)
- Todos os dados filtrados por `userId` do JWT (multi-tenant seguro)
- Helmet.js para headers de segurança HTTP
- Chaves API exibidas mascaradas na interface

---

## Licença

MIT
