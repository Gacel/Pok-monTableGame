# Makefile — atajos de desarrollo local (ver docs/LOCAL_DEV.md)
# Uso: make up | make down | make logs s=hello | make sh s=hello

COMPOSE := docker compose

.DEFAULT_GOAL := help

.PHONY: help up down ps logs sh rebuild test clean fmt lint typecheck

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Levanta todo el stack (build)
	$(COMPOSE) up --build

up-d: ## Levanta todo el stack en segundo plano
	$(COMPOSE) up --build -d

down: ## Para y elimina contenedores y red
	$(COMPOSE) down

ps: ## Estado de los servicios
	$(COMPOSE) ps

logs: ## Logs en vivo de un servicio: make logs s=hello
	$(COMPOSE) logs -f $(s)

sh: ## Shell dentro de un contenedor: make sh s=hello
	$(COMPOSE) exec $(s) sh

rebuild: ## Reconstruye un servicio: make rebuild s=hello
	$(COMPOSE) up --build -d $(s)

test: ## Tests de un servicio: make test s=hello
	$(COMPOSE) run --rm $(s) npm test

clean: ## Para todo y BORRA volúmenes (resetea las BD)
	$(COMPOSE) down -v

fmt: ## Formatea el código
	npm run format

lint: ## Linter
	npm run lint

typecheck: ## Comprobación de tipos
	npm run typecheck
