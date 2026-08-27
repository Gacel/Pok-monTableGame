# _hello (servicio temporal)

Servicio mínimo de Fastify para validar el pipeline de Docker/compose en la **Fase 0**
(`docs/01-IMPLEMENTATION_PLAN.md` → C0.2). **Se elimina al cerrar la Fase 0**, cuando el
gateway (C0.3) y los primeros servicios reales estén en marcha.

> **Nota (2026-07-11):** sigue presente en el repo pese a que el gateway y
> `game-service`/`frontend` ya están en marcha — pendiente de retirarlo.

## Contrato

| Método | Ruta      | Respuesta |
|--------|-----------|-----------|
| GET    | `/health` | `{ status, service, uptime }` |
| GET    | `/`       | `{ message, service }` |

## Probar

```bash
docker compose up --build hello
curl http://localhost:3000/health
```
