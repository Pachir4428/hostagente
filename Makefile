.PHONY: help build deploy logs health ps stop restart migrate seed clean dev backup restore \
	build-no-cache deploy-no-cache supabase-migrate supabase-up supabase-down \
	supabase-logs supabase-health

# Cores
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RESET  := \033[0m

help: ## Mostra esta ajuda
	@echo ""
	@echo "$(GREEN)Bot Hosting Platform$(RESET) — Comandos disponíveis:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-16s$(RESET) %s\n", $$1, $$2}'
	@echo ""

## ── Desenvolvimento ────────────────────────────────────────
dev: ## Iniciar stack de desenvolvimento
	docker compose up -d postgres redis
	@echo "$(GREEN)Postgres e Redis prontos. Agora corra os serviços manualmente.$(RESET)"

dev-full: ## Iniciar stack completa de desenvolvimento
	docker compose up -d

dev-down: ## Parar stack de desenvolvimento
	docker compose down

## ── Produção ────────────────────────────────────────────────
build: ## Construir todas as imagens Docker
	docker build -t bot-platform-api:latest ./apps/api
	docker build -t bot-platform-runner:latest ./apps/bot-runner
	docker build -t bot-engine:latest ./apps/bot-engine
	docker build -t bot-platform-worker:latest ./apps/worker
	docker build -t bot-platform-web:latest ./apps/web
	@echo "$(GREEN)Build concluído.$(RESET)"

build-no-cache: ## Construir todas as imagens sem usar cache (usar após corrigir bugs)
	docker build --no-cache -t bot-platform-api:latest ./apps/api
	docker build --no-cache -t bot-platform-runner:latest ./apps/bot-runner
	docker build --no-cache -t bot-engine:latest ./apps/bot-engine
	docker build --no-cache -t bot-platform-worker:latest ./apps/worker
	docker build --no-cache -t bot-platform-web:latest ./apps/web
	@echo "$(GREEN)Build (sem cache) concluído.$(RESET)"

deploy: ## Deploy completo (build + migrate + up)
	bash scripts/deploy.sh

deploy-no-cache: ## Deploy completo sem cache Docker (usar após git pull de correções)
	bash scripts/deploy.sh --no-cache

up: ## Subir serviços de produção
	docker compose -f docker-compose.prod.yml up -d --remove-orphans

stop: ## Parar todos os serviços de produção
	docker compose -f docker-compose.prod.yml down

restart: ## Reiniciar todos os serviços
	docker compose -f docker-compose.prod.yml restart

restart-api: ## Reiniciar apenas a API
	docker compose -f docker-compose.prod.yml restart api

## ── Base de Dados ────────────────────────────────────────────
migrate: ## Sincronizar o schema na base de dados (cria/atualiza tabelas via prisma db push)
	docker compose -f docker-compose.prod.yml exec -T api npx prisma db push --skip-generate

migrate-dev: ## Criar nova migração (dev)
	cd apps/api && npx prisma migrate dev

studio: ## Abrir Prisma Studio
	cd apps/api && npx prisma studio

## ── Teste local com Supabase ──────────────────────────────────
supabase-migrate: ## Aplicar o schema Prisma na base de dados Supabase (usa DATABASE_URL/DIRECT_URL do .env)
	docker compose -f docker-compose.supabase.yml run --rm api npx prisma db push --skip-generate

supabase-up: ## Construir e subir a stack local ligada ao Supabase
	docker compose -f docker-compose.supabase.yml up -d --build

supabase-down: ## Parar a stack local do Supabase
	docker compose -f docker-compose.supabase.yml down

supabase-logs: ## Ver logs da stack local do Supabase (ex: make supabase-logs SVC=api)
	docker compose -f docker-compose.supabase.yml logs -f $(SVC)

supabase-health: ## Verificar saúde da API a correr contra o Supabase
	@docker compose -f docker-compose.supabase.yml exec -T api curl -sf http://localhost:3000/health || echo "API não disponível"

## ── Monitorização ────────────────────────────────────────────
logs: ## Ver logs de um serviço (ex: make logs SVC=api)
	docker compose -f docker-compose.prod.yml logs -f $(SVC)

logs-all: ## Ver todos os logs
	docker compose -f docker-compose.prod.yml logs -f

ps: ## Estado dos serviços
	docker compose -f docker-compose.prod.yml ps

health: ## Verificar saúde da API
	@docker compose -f docker-compose.prod.yml exec -T api curl -sf http://localhost:3000/health || echo "API não disponível"

## ── Backups ──────────────────────────────────────────────────
backup: ## Criar backup da base de dados (backups/*.sql.gz)
	bash scripts/backup-db.sh

restore: ## Restaurar backup: make restore FILE=backups/hostagente-....sql.gz
	bash scripts/restore-db.sh $(FILE)

## ── Limpeza ──────────────────────────────────────────────────
clean: ## Remover imagens e volumes não usados
	docker system prune -f
	docker volume prune -f
