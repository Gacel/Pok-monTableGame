# Makefile — atajos de desarrollo local (ver docs/02-LOCAL_DEV.md)
# Uso: make up | make down | make logs s=hello | make sh s=hello
#
# La lógica real vive en ./dev.sh: detecta el comando de compose disponible
# (`docker compose` v2 vs `docker-compose` v1 vs podman) y fija DOCKER_HOST al
# socket rootless cuando toca. Este Makefile solo delega, para que ambos
# caminos no se desincronicen.
#
# IMPORTANTE: si `make` no está instalado (y sin sudo no se puede instalar),
# usa ./dev.sh con los mismos nombres de comando:  ./dev.sh up

DEV := ./dev.sh

.DEFAULT_GOAL := help

.PHONY: help up up-d down ps logs sh rebuild test clean urls doctor fmt lint typecheck

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Levanta todo el stack (build)
	$(DEV) up

up-d: ## Levanta todo el stack en segundo plano
	$(DEV) up-d

down: ## Para y elimina contenedores y red
	$(DEV) down

ps: ## Estado de los servicios
	$(DEV) ps

logs: ## Logs en vivo de un servicio: make logs s=hello
	$(DEV) logs $(s)

sh: ## Shell dentro de un contenedor: make sh s=hello
	$(DEV) sh $(s)

rebuild: ## Reconstruye un servicio: make rebuild s=hello
	$(DEV) rebuild $(s)

test: ## Tests de un servicio: make test s=hello
	$(DEV) test $(s)

clean: ## Para todo y BORRA volúmenes (resetea las BD)
	$(DEV) clean

urls: ## Muestra los puertos en los que queda expuesto el stack
	$(DEV) urls

doctor: ## Diagnostica el entorno sin levantar nada
	$(DEV) doctor

fmt: ## Formatea el código
	npm run format

lint: ## Linter
	npm run lint

typecheck: ## Comprobación de tipos
	npm run typecheck
