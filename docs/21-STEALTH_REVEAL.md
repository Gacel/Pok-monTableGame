# STEALTH_REVEAL.md — Revelación de ocultos por daño de área

> Implementado en el ticket **T1.1** (Épica 1 · Sigilo) del roadmap
> [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md). Vigente desde 2026-07-13.

## Por qué existe

El sigilo (Fase 3) ya ocultaba a los Pokémon en hierba alta (`isHidden`), daba emboscada
×1.5 y los censuraba por niebla. Pero **un AoE que alcanzaba a un oculto no lo revelaba**:
seguía invisible, haciendo el sigilo inmune "al fuego a ciegas". T1.1 lo corrige: al ser
golpeado por un ataque de área, un oculto enemigo se **descubre**.

## Comportamiento

En el bucle de daño de `GameService.cast`
([`GameService.ts`](../services/game-service/src/services/GameService.ts)): tras dañar a un
ocupante enemigo, **si sobrevive y estaba oculto**, pasa a `isHidden = false`, se marca
`revealed = true`, se registra `👁️ ¡X descubierto!` y se emite el evento **`reveal`**
(canal de [T0.1](15-TURN_EVENTS.md); lo consumirá T1.2 para el flash). Si el golpe es KO,
la pieza se retira y no procede revelar.

**Flag `revealed`** (nuevo en `Pokemon`, `packages/shared/src/domain.ts`): imprescindible
porque `updateStealthVisibility` se ejecuta justo después del `cast` y **re-ocultaría** al
Pokémon si sigue en hierba sin enemigo adyacente, deshaciendo el revelado en la misma
acción. La rama de re-ocultado ahora exige `!pokemon.revealed`. El flag se **limpia al
moverse** (`play`): reubicarse permite volver a esconderse por el flujo normal de sigilo.

**Emboscada intacta:** `computeMoveDamage` lee `attacker.isHidden`, que sigue `true`
durante todo el bucle de daño (`caster.isHidden = false` se aplica *después*). Revelar a la
víctima no toca al atacante, así que la emboscada ×1.5 depende solo de si el **atacante**
estaba oculto al lanzar.

**Niebla:** el filtro de eventos de `getStateDTO` censura los de un enemigo aún oculto para
el solicitante; en cuanto la víctima se revela (`isHidden = false`), sus eventos (`damage`,
`reveal`) pasan a verse para el rival.

## Verificación

- Tests: [`services/game-service/test/stealthReveal.test.ts`](../services/game-service/test/stealthReveal.test.ts)
  — revelado persistente por AoE (visible en el DTO del rival tras `updateStealthVisibility`),
  emboscada ×1.5 solo con atacante oculto, y KO sin `reveal` redundante. Se actualizó el
  test de niebla de T0.1 (un oculto golpeado ahora se revela).
- game-service **39/39**; `tsc` limpio en los 3 workspaces; imagen Docker sana.

## Pendiente / relacionado

- **T1.2 (frontend):** consumir el evento `reveal` para el flash/"!" estilo Metal Gear
  (usa la primitiva `flash` de `FxLayer`, [T0.4](18-VISUAL_FEEDBACK.md)).
- La censura de eventos de un oculto (niebla) volverá a tener trigger de integración con
  la curación en hierba de T2.2 (evento `heal` sobre un Pokémon que sigue oculto).
