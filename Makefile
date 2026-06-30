.PHONY: help build deploy logs health ps stop restart migrate seed clean dev

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

deploy: ## Deploy completo (build + migrate + up)
	bash scripts/deploy.sh

up: ## Subir serviços de produção
	docker compose -f docker-compose.prod.yml up -d --remove-orphans

stop: ## Parar todos os serviços de produção
	docker compose -f docker-compose.prod.yml down

restart: ## Reiniciar todos os serviços
	docker compose -f docker-compose.prod.yml restart

restart-api: ## Reiniciar apenas a API
	docker compose -f docker-compose.prod.yml restart api

## ── Base de Dados ────────────────────────────────────────────
migrate: ## Executar migrações Prisma
	docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy

migrate-dev: ## Criar nova migração (dev)
	cd apps/api && npx prisma migrate dev

studio: ## Abrir Prisma Studio
	cd apps/api && npx prisma studio

## ── Monitorização ────────────────────────────────────────────
logs: ## Ver logs de um serviço (ex: make logs SVC=api)
	docker compose -f docker-compose.prod.yml logs -f $(SVC)

logs-all: ## Ver todos os logs
	docker compose -f docker-compose.prod.yml logs -f

ps: ## Estado dos serviços
	docker compose -f docker-compose.prod.yml ps

health: ## Verificar saúde da API
	@curl -sf http://localhost:3000/health | python3 -m json.tool 2>/dev/null || echo "API não disponível"

## ── Limpeza ──────────────────────────────────────────────────
clean: ## Remover imagens e volumes não usados
	docker system prune -f
	docker volume prune -f
