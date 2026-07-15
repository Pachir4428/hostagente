# HostAgente — Manual & Documentação do Sistema

Documentação completa da plataforma: arquitetura, procedimentos por área,
instalação, operação e resolução de problemas.

---

## 1. Visão geral

HostAgente é uma plataforma **multi-tenant** (SaaS) para revendedores de dados
móveis em Moçambique. Faz duas coisas:

1. **Vendas automáticas** — deteta pagamentos M-Pesa/e-Mola/mKesh (via MacroDroid
   ou pela Ponte de WhatsApp) e regista/entrega o pacote correspondente.
2. **Bots de WhatsApp** — corre bots Baileys (manuais) em containers isolados,
   com consola, terminal, gestão de grupos e assinaturas.

Cada **tenant** (revendedor) tem os seus dados isolados e uma **chave de API**
própria (`hka_...`). O isolamento é garantido pelo backend a partir dessa chave.

---

## 2. Arquitetura

| Serviço | Stack | Porta | Função |
|--------|-------|-------|--------|
| `api` | NestJS | 3000 | API REST + WebSocket (socket.io) |
| `web` | Next.js 14 | 3001 | Painel |
| `worker` | BullMQ | — | Tarefas em fila |
| `bot-runner` | Express + dockerode | 4001 | Orquestra containers dos bots |
| `bot-engine` | Node | — | Imagem que corre cada bot manual |
| `postgres` | PostgreSQL 16 | 5432 | Base de dados |
| `redis` | Redis 7 | 6379 | Cache, pub/sub, logs dos bots |

- **Pub/sub Redis** por bot: `bot:{id}:status|logs|stats|qr|stream|cmd|stdin|config|sync|broadcast`.
- **Tempo real:** o engine publica em `bot:{id}:stream`; o gateway socket.io reenvia ao painel.
- Bots correm em containers isolados (um por bot), com a sessão do WhatsApp persistida no volume `projects-data`.

---

## 3. Instalação na VPS

Pré-requisitos: Docker + Docker Compose, `.env` preenchido (ver `.env.example`).

```bash
# 1. Preparar a VPS (nginx, firewall) — opcional
sudo bash scripts/setup-vps.sh

# 2. Deploy completo (build + alinhar password + up + db push)
bash scripts/deploy.sh            # ou --no-cache após correções

# 3. HTTPS (grátis, via sslip.io) — recomendado
sudo bash scripts/setup-https.sh
# depois: FRONTEND_API_URL=https://<dominio>/api no .env e re-deploy
```

Comandos úteis (`make help`): `make deploy`, `make logs`, `make backup`,
`make restore FILE=...`, `make health`.

> **Deploy auto-reparável:** o `deploy.sh` alinha a password do Postgres com o
> `.env` antes de subir, eliminando o erro P1000.

---

## 4. Procedimentos por área (revendedor)

### 4.1 Pacotes
Define `valor recebido → dados a entregar`. Cada pagamento reconhecido é casado
por valor (e operadora) com um pacote. Sem pacote correspondente, a venda fica
pendente.

### 4.2 Conta & API
Contém a chave `hka_...` (usada por MacroDroid, bots e ponte) e o endpoint de
ingestão. Podes regenerar a chave (revoga a anterior).

### 4.3 Bot automático (MacroDroid)
1. MacroDroid no telemóvel que recebe os SMS.
2. Macro: gatilho "SMS recebido" → ação "HTTP POST" para `/ingest/macrodroid`
   com cabeçalho `x-api-key`.
3. Corpo: `{ phone, amount, operator, reference?, raw? }`.

### 4.4 Bot manual
1. Bots → Novo bot (Manual).
2. Descarrega **Bot-modelo** ou **Ponte de pagamentos**, ou usa o teu projeto.
3. Carrega ZIP/Ficheiros/Pasta (usa "Carregar para:" para o destino certo).
4. Define o **Arranque** (ex: `index.js`) ou deixa em deteção automática.
5. **Iniciar** → lê o **QR** no painel → estado "Ligado".
6. **Terminal:** comandos e scripts EOF; **atualizar** ficheiros com editor
   (realce de sintaxe) + **Histórico/reverter**; **substituir** ficheiro numa
   pasta específica.

Credenciais (`PAINEL_API_URL/KEY/BOT_ID`) são **injetadas** no container.

### 4.5 Grupos & assinaturas
- Adiciona um grupo pelo **ID**, com **plano** e **validade**.
- **Varrer** (bot ligado) para o bot colher descrição, admins e membros.
- Menu **Grupos**: vê estado (ativa/a expirar/expirada) e **renova**.
- Avisos automáticos por email antes de expirar.

### 4.6 Broadcast
Página do bot → botão megafone: envia uma mensagem aos clientes (todos ou dos
últimos 30 dias) via o bot, com pausa anti-spam.

### 4.7 Assinatura, cupões e recibos
Escolhe plano → checkout (Visa/PayPal/M-Pesa/e-Mola) → aplica cupão → paga.
Recibo em **PDF** no histórico de faturas.

### 4.8 Insights
Pacotes mais vendidos, melhores clientes, horas de pico e dias fortes,
ticket médio e clientes recorrentes (últimos 90 dias).

### 4.9 Convidar & Ganhar (referências)
Link/código de convite; acompanha convidados e ativos.

---

## 5. Procedimentos por área (super admin)

- **Plataforma:** resumo geral.
- **Tenants:** gerir revendedores (suspender/reativar).
- **Planos & Cupões:** criar/editar planos (preço, limites, funcionalidades) e cupões.
- **Pagamentos:** confirmar/rejeitar pagamentos manuais (M-Pesa/e-Mola).
- **Receita:** MRR, receita por plano, top revendedores.
- **Definições & API:** assistente IA, gateways de pagamento, SMTP (email).
- **Marca & Landing:** white-label (nome, logo, favicon, cor, conteúdos da landing).
- **Relatórios / Logs / Comunicados / Suporte.**

---

## 6. API para bots (x-api-key)

| Endpoint | Método | Função |
|---------|--------|--------|
| `/ingest/macrodroid` | POST | Registar pagamento (MacroDroid/ponte) |
| `/bot-api/products` | GET/POST/DELETE | Gerir pacotes por comando |
| `/bot-api/bots/:id/info` | GET | Verificar credenciais |
| `/bot-api/bots/:id/groups` | POST | Reportar grupos do WhatsApp |
| `/bot-api/bots/:id/groups/:gid/renew` | POST | Renovar assinatura de grupo (após pagamento) |

Autenticação: cabeçalho `x-api-key: hka_...`.

---

## 7. Backups & recuperação

```bash
make backup                                   # cria backups/*.sql.gz (mantém 14)
make restore FILE=backups/hostagente-....sql.gz
```
Backup automático diário (cron):
```
0 3 * * * cd ~/hostagente && bash scripts/backup-db.sh >> backups/cron.log 2>&1
```

---

## 8. Resolução de problemas

| Sintoma | Causa provável | Solução |
|--------|----------------|---------|
| `P1000 Authentication failed` | password do Postgres ≠ `.env` | `bash scripts/deploy.sh` (alinha) ou `scripts/fix-db-auth.sh` |
| Painel com UI antiga | imagens não reconstruídas | `bash scripts/deploy.sh --no-cache` |
| 502 Bad Gateway | container `web`/`api` em baixo | ver `make logs`, confirmar containers `Up` |
| Upload "erro interno" | pasta de projetos sem escrita | ver mensagem (agora detalhada) + volume `projects-data` |
| Grupos não aparecem | bot não reporta | clicar **Varrer** com o bot ligado; ver `📡 Painel recebeu…` no terminal |
| PWA não instala | site em HTTP | ativar **HTTPS** (`setup-https.sh`) |
| Bot em "Erro" | crashou > 5x | ver logs; corrigir código; **Iniciar** |

---

## 9. Segurança

- Chaves dos gateways e do assistente **cifradas** (AES-256-GCM) e nunca reenviadas ao frontend.
- Cada tenant isolado pela sua `x-api-key`.
- Recomendado: HTTPS ativo, número de WhatsApp dedicado, chave de API em segredo.

---

_Para ajuda contextual dentro do painel: **Ajuda & Guias** ou o assistente IA
(canto inferior direito)._
