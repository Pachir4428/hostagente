# Testar com Supabase (localhost) antes de ir para a VPS

Este guia usa o Supabase **só como Postgres hospedado** — toda a lógica da
aplicação continua igual (Prisma, NestJS, JWT próprio). A única mudança é de
onde vem a base de dados.

---

## 1 — Criar o projeto Supabase

1. Cria conta/projeto em https://supabase.com/dashboard
2. Espera o projeto ficar pronto (~2 min)
3. Vai a **Project Settings → Database → Connection string**
4. Copia dois URLs diferentes:
   - **Connection pooling** (modo *Transaction*, porta `6543`) → vai para `DATABASE_URL`
   - **Direct connection** (porta `5432`) → vai para `DIRECT_URL`

> Por que dois URLs? O Supabase usa PgBouncer para pooling de conexões em
> runtime (`DATABASE_URL`), mas o Prisma Migrate precisa de uma conexão direta
> sem pooler para aplicar migrações (`DIRECT_URL`). Isto já está configurado
> em `apps/api/prisma/schema.prisma` e `apps/worker/prisma/schema.prisma`.

---

## 2 — Configurar o `.env` local

```bash
cp .env.example .env
```

Preenche o `.env` com:

```env
# Cole os dois URLs do Supabase (substitua password e host reais)
DATABASE_URL="postgresql://postgres.xxxxxxxx:SENHA@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxxxxxx:SENHA@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require"

REDIS_PASSWORD=uma_password_qualquer_local

JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
INTERNAL_SECRET=$(openssl rand -hex 32)

FRONTEND_URL=http://localhost:3001
FRONTEND_API_URL=http://localhost:3000
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
```

Gera os 3 secrets de uma vez:
```bash
for var in JWT_SECRET JWT_REFRESH_SECRET INTERNAL_SECRET; do
  echo "$var=$(openssl rand -hex 32)"
done
```
(copia o resultado para o `.env`)

`POSTGRES_PASSWORD` **não é necessário** neste modo — o `docker-compose.supabase.yml`
não sobe nenhum container Postgres local.

---

## 3 — Aplicar o schema no Supabase

```bash
make supabase-migrate
```

Isto corre `npx prisma migrate deploy` dentro de um container temporário
usando `DIRECT_URL`, criando as tabelas (`User`, `Bot`, `Plan`, `Subscription`,
`Payment`) no teu projeto Supabase. Podes confirmar no dashboard do Supabase em
**Table Editor**.

---

## 4 — Subir a stack local

```bash
make supabase-up
```

Isto constrói e sobe `api`, `worker`, `bot-runner`, `web` e um `redis` local
(não precisa de Postgres local — usa o Supabase). Confirma que subiu tudo:

```bash
docker compose -f docker-compose.supabase.yml ps
make supabase-health
```

Deves ver `{"status":"ok", ...}`.

---

## 5 — Testar

- **Frontend:** http://localhost:3001 → cria uma conta em `/register`, faz login
- **API/Docs (Swagger):** http://localhost:3000/api/docs
- Confirma no Supabase (**Table Editor → User**) que o registo criou uma linha

Ver logs em tempo real:
```bash
make supabase-logs SVC=api
```

Parar tudo:
```bash
make supabase-down
```

---

## 6 — Levar para a VPS

Depois de confirmares que tudo funciona local + Supabase, tens duas opções na VPS:

### Opção A — Manter Supabase em produção (recomendado se já validaste)

No `.env` da VPS, define os mesmos `DATABASE_URL`/`DIRECT_URL` do Supabase.
O `docker-compose.prod.yml` já lê essas variáveis automaticamente e, quando
definidas, usa-as **em vez** do container `postgres` local:

```bash
# .env na VPS
DATABASE_URL="postgresql://postgres.xxxxxxxx:SENHA@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxxxxxx:SENHA@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require"
```

Depois faz o deploy normal — o container `postgres` continua definido no
compose mas fica sem uso; podes remover o serviço `postgres` do
`docker-compose.prod.yml` manualmente se quiseres poupar RAM na VPS.

```bash
bash scripts/deploy.sh
```

### Opção B — Voltar ao Postgres próprio na VPS

Não definas `DATABASE_URL`/`DIRECT_URL` no `.env` da VPS — o
`docker-compose.prod.yml` usa por padrão o container `postgres` local com
`POSTGRES_PASSWORD`, exatamente como antes. Sem alterações necessárias.

---

## Notas

- O container `bot-network` externo (criado por `scripts/setup-vps.sh`) só é
  necessário para `docker-compose.prod.yml`. O `docker-compose.supabase.yml`
  cria a sua própria rede (`bot-network-supabase`) e não precisa dele.
- `docker-compose.small.yml` (VPS de 2GB RAM) ainda não lê `DATABASE_URL`
  externo — se quiseres usar Supabase numa VPS pequena, usa
  `docker-compose.prod.yml` (Opção A acima), que tem menos serviços a mais
  para desligar (`postgres` fica ocioso mas não obrigatório).
