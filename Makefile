# Makefile — atajos de desarrollo local (ver docs/02-LOCAL_DEV.md)
# Uso: make up | make down | make logs s=hello | make sh s=hello

# Autodetecta Docker Compose v2 (plugin "docker compose") o v1 (binario "docker-compose")
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.DEFAULT_GOAL := help

.PHONY: help up up-d down ps logs sh rebuild test clean fmt lint typecheck install guard-s

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

# Verifica que se haya pasado s=<servicio> en los targets que lo requieren
guard-s:
	@if [ -z "$(s)" ]; then \
		echo "Error: falta el servicio. Uso: make $(firstword $(MAKECMDGOALS)) s=<servicio> (p.ej. game-service)"; \
		exit 1; \
	fi

up: ## Levanta todo el stack (build)
	$(COMPOSE) up --build

up-d: ## Levanta todo el stack en segundo plano
	$(COMPOSE) up --build -d

down: ## Para y elimina contenedores y red
	$(COMPOSE) down

ps: ## Estado de los servicios
	$(COMPOSE) ps

logs: ## Logs en vivo (todos, o uno: make logs s=hello)
	$(COMPOSE) logs -f $(s)

sh: guard-s ## Shell dentro de un contenedor: make sh s=hello
	$(COMPOSE) exec $(s) sh

rebuild: ## Reconstruye el stack, o uno: make rebuild s=hello
	$(COMPOSE) up --build -d $(s)

test: guard-s ## Tests de un servicio: make test s=hello
	$(COMPOSE) run --rm $(s) npm test

clean: ## Para todo y BORRA volúmenes (resetea las BD)
	$(COMPOSE) down -v

install: ## Instala dependencias del monorepo (node_modules)
	npm install

node_modules: package.json
	npm install

fmt: node_modules ## Formatea el código
	npm run format

lint: node_modules ## Linter
	npm run lint

typecheck: node_modules ## Comprobación de tipos
	npm run typecheck
