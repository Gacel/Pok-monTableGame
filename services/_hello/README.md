# _hello (servicio temporal)

Servicio mínimo de Fastify para validar el pipeline de Docker/compose en la **Fase 0**
(`docs/IMPLEMENTATION_PLAN.md` → C0.2). **Se elimina al cerrar la Fase 0**, cuando el
gateway (C0.3) y los primeros servicios reales estén en marcha.

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
