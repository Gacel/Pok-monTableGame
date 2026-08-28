# ÉPICA 11 — Pulido de UI/UX y Calidad de Vida

> Tickets de mejora de experiencia de usuario: feedback visual en combate, audio,
> fidelidad de sprites, limpieza del inventario, tienda mejorada y animaciones.
> Todos parten del estado actual de `main` (post-merge de Épicas 1-10).

## Cómo leer este documento

- Mismas convenciones que [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md).
- **[P]** = sin dependencias, arrancable en paralelo · **→X** = depende del ticket X.
- Los tickets de frontend se validan visualmente con `make up` (smoke local).
- **Rama de trabajo:** `main` (o una rama feature por ticket, mergeada a `main` al cerrar).

---

## 🎟️ T11.1 — Barra de vida encima de cada Pokémon en combate

**Historia de usuario:** Como jugador, quiero ver la barra de vida de cada Pokémon
directamente sobre su sprite en el tablero, para leer de un vistazo quién está en
peligro sin tener que mirar el HUD lateral.

**Objetivos de desarrollo:**
1. En `EntityView.ts`, tras dibujar el sprite de cada pieza, renderizar un elemento
   DOM (div) como barra de vida flotante posicionada sobre el hex: fondo gris, relleno
   verde/amarillo/rojo según `hp/maxHp` (≥50% verde, ≥25% amarillo, <25% rojo).
2. La barra debe actualizarse en cada llamada a `EntityView.render`/`update` sin
   crear elementos huérfanos (misma técnica de reutilización de nodos que los sprites).
3. Escalar con el zoom (misma lógica que `sSize`).
4. No mostrar la barra a los Pokémon completamente ocultos al jugador (niebla de guerra).

**Dudas resueltas:** barra visible sobre el sprite, siempre en pantalla (no en el HUD
lateral); colores semáforo (verde/amarillo/rojo); se oculta con la niebla.

**Criterios de aceptación:**
- [ ] Cada pieza en el tablero tiene una barra de vida sobre su sprite.
- [ ] El color cambia según el porcentaje de HP.
- [ ] La barra se actualiza tras recibir daño (evento `damage` de T0.1).
- [ ] Las piezas ocultas (niebla) no muestran barra.
- [ ] Sin elementos DOM huérfanos al mover o destruir piezas.

**Investigación:**
- `EntityView.ts` (render de sprites, `sSize`, `hexToScreen`; sin barra hoy) L1-226.
- `GameState.ts` (qué tiles son visibles para el jugador; `hiddenAllySlots`).
- `FxLayer` en `utils/fx.ts` (referencia de cómo se añaden elementos flotantes al canvas).
- Campo `hp`/`maxHp` en el tipo `Pokemon` de `packages/shared/src/domain.ts`.

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] Cada pieza en el tablero tiene una barra de vida sobre su sprite.
- [x] El color cambia según el porcentaje de HP (verde ≥50%, amarillo ≥25%, rojo <25%).
- [x] La barra se actualiza tras recibir daño (evento `damage` de T0.1).
- [x] Las piezas ocultas (niebla) no muestran barra (opacity 0.4 igual que el sprite).
- [x] Sin elementos DOM huérfanos al mover o destruir piezas (prefijo `hp-` en cleanup).

**Implementación:** Div HP bar en `EntityView.ts` con inner fill `scaleX(ratio)`,
colores semáforo, escalado con `sSize`, misma transición que el label.

---

## 🎟️ T11.2 — Cámara sigue al Pokémon activo (turno rival / movimiento)

**Historia de usuario:** Como espectador del turno rival, quiero que la cámara se
desplace automáticamente hacia el Pokémon enemigo cuando se mueve o ataca, para
no perder de vista la acción sin tener que panear manualmente.

**Objetivos de desarrollo:**
1. En `GameController.dispatchEvents` (`GameController.ts:495`), al recibir eventos
   `knockback` o `dash`, llamar a `centerOnTile` (`GameController.ts:400`) con el hex
   origen del evento para que la cámara siga la acción.
2. En `applyMatchState` (`GameController.ts`), cuando `state.currentPlayer` cambia y
   la nueva pieza activa no es del jugador local (turno del rival / IA), centrar la
   cámara en la pieza que va a actuar.
3. Asegurarse de que `centerOnTile` no interrumpe el paneo manual (teclas WASD/flechas
   activas): si `panKeys.size > 0`, no auto-centrar.

**Dudas resueltas:** la cámara solo se auto-centra en el turno rival (en el turno propio
el jugador controla la cámara); el paneo manual tiene prioridad.

**Criterios de aceptación:**
- [ ] Cuando la IA / rival mueve una pieza, la cámara la sigue.
- [ ] Cuando la IA / rival lanza un ataque (dash/knockback), la cámara sigue la acción.
- [ ] Si el jugador está paneando con teclado, el auto-centrado no interrumpe.

**Investigación:**
- `centerOnTile` (`GameController.ts:400`): ya anima el desplazamiento.
- `dispatchEvents` (`GameController.ts:495`): punto natural para enganchar en events.
- `applyMatchState` (`GameController.ts:456`): cambio de `currentPlayer`.
- `panKeys` (`GameController.ts:45`): set de teclas de paneo activas.

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] Cuando la IA / rival mueve una pieza, la cámara la sigue.
- [x] Cuando la IA / rival lanza un ataque (dash/knockback), la cámara sigue la acción.
- [x] Si el jugador está paneando con teclado, el auto-centrado no interrumpe.

**Implementación:** `dispatchEvents` centra en el hex de eventos knockback/dash si
`!isMyTurn()` y `panKeys.size === 0`. `applyMatchState` ya centra en cambio de turno;
se añade guardia de `panKeys` para no interrumpir paneo manual.

---

## 🎟️ T11.3 — Audio de combate: sonido de golpe y muerte

**Historia de usuario:** Como jugador, quiero escuchar un sonido de golpe cuando mi
Pokémon ataca o recibe daño, y un sonido especial de muerte cuando un Pokémon cae
en combate, para sentir el peso de cada acción.

**Objetivos de desarrollo:**
1. Crear `utils/CombatAudio.ts` (análogo a `views/hub/GachaAudio.ts`): síntesis Web
   Audio API de un sonido de golpe corto (oscilador + envolvente) y un sonido de muerte
   dramático (bajada de tono + fade). Alternativamente, cargar tracks mp3 si existen en
   `public/assets/sounds/`.
2. En `GameController.dispatchEvents` (`GameController.ts:495`), añadir:
   - `case 'damage'` → `combatAudio.playHit()`.
   - `case 'ko'` → `combatAudio.playDeath()`.
3. El audio solo suena si el evento afecta a una pieza **visible** para el jugador
   (no sonidos por eventos en niebla de guerra).

**Dudas resueltas:** síntesis Web Audio (sin dependencias externas); se distinguen
hit y muerte; respeta la niebla de guerra (sin spoilers sonoros).

**Criterios de aceptación:**
- [ ] Un ataque que hace daño reproduce un sonido de golpe.
- [ ] Un Pokémon que muere en combate reproduce un sonido de muerte diferente.
- [ ] Sin sonido para eventos de piezas ocultas en niebla.
- [ ] El audio no bloquea el hilo principal (Web Audio API, no `<audio>`).

**Investigación:**
- `GachaAudio.ts` (`services/frontend/src/views/hub/GachaAudio.ts`): referencia de
  síntesis Web Audio ya usada en el proyecto.
- `dispatchEvents` (`GameController.ts:495-530`): punto de enganche de eventos.
- Tipo `TurnEvent` (`packages/shared/src/match.ts`): `kind: 'ko'` ya existe.
- `state.hiddenAllySlots` / `GameState`: para filtrar eventos en niebla.

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] Un ataque que hace daño reproduce un sonido de golpe.
- [x] Un Pokémon que muere en combate reproduce un sonido de muerte diferente.
- [x] Sin sonido para eventos de piezas ocultas en niebla.
- [x] El audio no bloquea el hilo principal (Web Audio API, no `<audio>`).

**Implementación:** `CombatAudio.ts` con síntesis Web Audio (ruido + filtro para hit,
oscilador descendente + ruido para death). `dispatchEvents` filtra por niebla antes
de reproducir audio.

---

## 🎟️ T11.4 — Draft y picker muestran sprites shiny de las instancias propias

**Historia de usuario:** Como coleccionista, quiero que cuando selecciono mi equipo
para una partida, mis Pokémon shiny aparezcan con su sprite dorado, igual que en el
inventario, para distinguirlos visualmente.

**Objetivos de desarrollo:**
1. En `OwnedTeamPickerView.ts` (picker de Survival / equipo propio), el endpoint
   `/api/inventory` ya devuelve `isShiny` por instancia. Modificar la carga de sprites
   para pasar `isShiny` a `getSprite(p.name, !!p.isShiny)` (L65-66) y mostrar el badge
   `✨` en la carta si `isShiny`.
2. Para el draft **aleatorio** (local/vs-IA) no hay instancias owned: los sprites son
   siempre la versión normal (correcto, no cambiar).
3. Verificar que `DraftView.ts` (L86) no necesita cambio al usar el pool de plantillas
   genéricas (sin `isShiny`).

**Dudas resueltas:** solo `OwnedTeamPickerView` (instancias reales) muestra shiny;
el draft aleatorio usa plantillas y no tiene isShiny (no aplica).

**Criterios de aceptación:**
- [ ] En el picker de equipo propio, los Pokémon shiny muestran su sprite dorado y el badge ✨.
- [ ] Los no-shiny muestran el sprite normal (sin regresión).
- [ ] El draft aleatorio (local/IA) no se ve afectado.

**Investigación:**
- `OwnedTeamPickerView.ts:65-66` (`getSprite(p.name)` sin `isShiny`; los datos
  del endpoint incluyen `isShiny` pero no se pasa).
- `InventoryView.ts:77,103` (referencia: ya hace `getSprite(p.name, !!p.isShiny)`).
- `PokeSprites.getSprite` (`net/PokeSprites.ts`): acepta `(name, isShiny?)`.
- `DraftView.ts:86` (pool genérico, sin `isShiny`, no cambia).

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] En el picker de equipo propio, los Pokémon shiny muestran su sprite dorado y el badge ✨.
- [x] Los no-shiny muestran el sprite normal (sin regresión).
- [x] El draft aleatorio (local/IA) no se ve afectado.

**Implementación:** `OwnedTeamPickerView` añade `isShiny` a la interfaz, usa `spriteKey`
(name + `-shiny`) para cachear sprites separados, y pasa `isShiny` a `getSprite`.

---

## 🎟️ T11.5 — Inventario: ocultar objetos con 0 unidades

**Historia de usuario:** Como jugador, quiero que el inventario solo muestre los objetos
que realmente tengo (cantidad > 0), para no ver slots vacíos que ensucian la vista.

**Objetivos de desarrollo:**
1. En `InventoryView.draw` (`InventoryView.ts:424`), filtrar el array `items` antes de
   renderizar: `items.filter(it => it.qty > 0)`.
2. No se necesita cambio en backend: `owned_items` ya solo guarda filas cuando `qty > 0`
   tras las operaciones de resta; si por algún motivo llega un ítem con `qty <= 0`, el
   filtro en frontend lo oculta de forma defensiva.

**Dudas resueltas:** el filtro va en frontend (capa de presentación); el backend ya es
autoritativo en lo que guarda.

**Criterios de aceptación:**
- [ ] Los objetos con `qty === 0` no aparecen en la cuadrícula de objetos.
- [ ] Los objetos con `qty > 0` siguen mostrándose correctamente.
- [ ] La sección "Sin objetos todavía" aparece si no hay ningún objeto con qty > 0.

**Investigación:**
- `InventoryView.draw` (`InventoryView.ts:432`): línea donde se construye `itemGrid`.
- `InvItem.qty` (`InventoryView.ts:28-32`): campo `qty: number` ya presente.

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] Los objetos con `qty === 0` no aparecen en la cuadrícula de objetos.
- [x] Los objetos con `qty > 0` siguen mostrándose correctamente.
- [x] La sección "Sin objetos todavía" aparece si no hay ningún objeto con qty > 0.

**Implementación:** Filtro `items.filter(it => it.qty > 0)` en `InventoryView.draw`
antes de renderizar; el contador del panel del entrenador también usa la lista filtrada.

---

## 🎟️ T11.6 — Animación de evolución guay (frontend)

**Historia de usuario:** Como jugador, quiero que evolucionar a un Pokémon (en el hub
o en combate) sea un momento épico con una animación vistosa, no solo un flash de ✨.

**Objetivos de desarrollo:**
1. Crear una animación de evolución multi-fase en `FxLayer` o un componente dedicado
   `utils/EvolutionFx.ts`:
   - **Fase 1 (0-0.5s):** el sprite del Pokémon se rellena de blanco (silhouette blanca
     pulsante), con un halo de luz expandiéndose.
   - **Fase 2 (0.5-1.5s):** el sprite se escala y rota ligeramente; partículas de estrellas
     salen en espiral.
   - **Fase 3 (1.5-2.5s):** el sprite vuelve a aparecer como la nueva forma (ya actualizado
     por el servidor); un flash final y el nombre nuevo aparece flotando.
2. En **combate** (`GameController.dispatchEvents`, `case 'evolve'`): reemplazar el `flash`
   actual de L515 por la nueva animación completa sobre el hex del Pokémon.
3. En el **hub** (`InventoryView` / `PokemonDetailModal`): tras la respuesta exitosa de
   `POST /api/inventory/{id}/evolve`, lanzar la misma animación antes de refrescar la vista.
4. Usar únicamente CSS keyframes + Web Animations API (sin librerías externas).

**Dudas resueltas:** animación CSS/Web Animations (sin deps); se reutiliza en combate y hub;
el sprite se actualiza solo tras el event (backend ya lo hace).

**Criterios de aceptación:**
- [ ] Al evolucionar en combate, se ve una animación multi-fase vistosa (>1.5s) en el hex.
- [ ] Al evolucionar en el hub, la misma animación precede al refresh del inventario.
- [ ] Al final, el sprite muestra la forma evolucionada.
- [ ] La animación no bloquea otras interacciones (animación no-modal).

**Investigación:**
- `GameController.dispatchEvents` (`GameController.ts:515-517`): `case 'evolve'` actual
  (solo `fxLayer.flash(ev.hex, '✨')`).
- `FxLayer` (`utils/fx.ts`): primitivas `flash`/`floatingNumber`/`tween` como referencia
  de implementación (Web Animations API, auto-limpieza).
- `InventoryView.ts:133-136` (botón ✨ EVOLUCIONAR y su handler de refresh).
- `PokemonDetailModal.ts` (si existe; si no, el botón está en `InventoryView`).

**Dependencias:** ninguna (trabaja sobre código ya existente). **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] Al evolucionar en combate, se ve una animación multi-fase vistosa (>1.5s) en el hex.
- [x] Al evolucionar en el hub, la misma animación precede al refresh del inventario.
- [x] Al final, el sprite muestra la forma evolucionada.
- [x] La animación no bloquea otras interacciones (animación no-modal).

**Implementación:** `EvolutionFx.ts` con 3 fases (halo, estrellas en espiral, flash final
+ label). Integrado en `dispatchEvents` (case 'evolve') y `doEvolve` (PokemonDetailModal).

---

## 🎟️ T11.7 — Comprar más de una piedra evolutiva a la vez

**Historia de usuario:** Como jugador, quiero poder comprar varias piedras evolutivas
en una sola transacción, para no tener que repetir el proceso varias veces.

**Objetivos de desarrollo:**
1. **Backend** (`ShopController.stone`, `ShopController.ts:81-92`): aceptar un campo
   opcional `qty: number` (default 1, máx razonable: 10) en el body del `POST
   /api/shop/stone`. Multiplicar el precio por `qty` antes de validar el saldo y llamar
   `ItemModel.add(uid, STONE_KIND, stone.key, qty)`.
2. **Frontend** (`ShopMenuView.ts`): en la sección de piedras, añadir un selector de
   cantidad (1-10) antes del botón de compra; mostrar el precio total calculado en tiempo
   real.

**Dudas resueltas:** cantidad máxima 10 por transacción (evita abusos); precio total
visible antes de confirmar.

**Criterios de aceptación:**
- [ ] El backend acepta `qty` en el body y cobra `qty × price` si hay saldo suficiente.
- [ ] El frontend muestra el selector de cantidad y el precio total.
- [ ] Comprar 3 piedras añade 3 al inventario en una sola petición.
- [ ] Con `qty` inválido o fuera de rango [1, 10], el servidor responde 400.
- [ ] Sin `qty`, el comportamiento es idéntico al actual (qty=1).

**Investigación:**
- `ShopController.stone` (`ShopController.ts:81-92`): ruta `POST /api/shop/stone`.
- `ItemModel.add` (`ItemModel.ts:34-42`): ya acepta un tercer param `qty`.
- `ShopMenuView.ts:157-200` (sección de piedras y botones de compra).

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] El backend acepta `qty` en el body y cobra `qty × price` si hay saldo suficiente.
- [x] El frontend muestra el selector de cantidad y el precio total.
- [x] Comprar 3 piedras añade 3 al inventario en una sola petición.
- [x] Con `qty` inválido o fuera de rango [1, 10], el servidor responde 400.
- [x] Sin `qty`, el comportamiento es idéntico al actual (qty=1).

**Implementación:** Backend: `qty` validado [1, 10] en `buyStone`, `totalPrice = price × qty`.
Frontend: +/- botones por piedra, precio total dinámico, botón COMPRAR separado.

---

## 🎟️ T11.8 — Inventario: panel del entrenador más compacto

**Historia de usuario:** Como jugador, quiero que el inventario aproveche mejor el
espacio de pantalla, dedicando menos columna al panel del entrenador y más a la
cuadrícula de Pokémon y objetos.

**Objetivos de desarrollo:**
1. En `InventoryView.draw` (`InventoryView.ts:443-475`), reducir el ancho del panel
   del entrenador de `md:w-1/3` a `md:w-56` (o similar, ~224px fijo) y que la sección
   derecha ocupe `flex-1`.
2. Reducir el `min-height` del panel del entrenador (actualmente `min(50vh, 320px)`)
   para que no empuje el scroll en pantallas medianas.
3. En el panel del entrenador, compactar la info (sprite + nombre + monedas + nivel)
   en un layout más estrecho, aprovechando la menor anchura.
4. Verificar que en móvil (columna única) el panel no ocupa demasiado alto.

**Dudas resueltas:** el panel del entrenador pasa de 1/3 a un ancho fijo menor; la
cuadrícula de Pokémon/objetos se expande con `flex-1`.

**Criterios de aceptación:**
- [ ] En pantallas medianas/grandes, el panel del entrenador ocupa ≤230px y la cuadrícula
      el resto.
- [ ] La cuadrícula de Pokémon muestra más columnas que antes.
- [ ] En móvil, el layout sigue siendo usable (columna única con scroll).

**Investigación:**
- `InventoryView.draw` (`InventoryView.ts:443`): `<div class="w-full md:w-1/3 flex">`.
- El sprite del entrenador y los datos se renderizan dentro de ese div (L447-456).

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] En pantallas medianas/grandes, el panel del entrenador ocupa ≤230px y la cuadrícula el resto.
- [x] La cuadrícula de Pokémon muestra más columnas que antes.
- [x] En móvil, el layout sigue siendo usable (columna única con scroll).

**Implementación:** `md:w-1/3` → `md:w-56` (224px, `flex-shrink-0`), min-height
reducido a `min(30vh, 200px)`, sprite y textos más compactos.

---

## 🎟️ T11.9 — Tienda: selector y confirmación para recuperar Pokémon

**Historia de usuario:** Como jugador de Survival, quiero ver la lista de Pokémon que
he perdido y elegir cuál recuperar (con el coste en monedas), antes de confirmar, para
tomar una decisión informada.

**Objetivos de desarrollo:**
1. **Backend:**
   - Nueva ruta `GET /api/shop/lost-pokemon`: devuelve `{ pokemon: Array<{ id, name,
     level, price: 10000 }> }` con las instancias con `lost_at IS NOT NULL` del usuario.
   - `POST /api/shop/recover-pokemon`: extender para aceptar un `id` opcional en el body
     (recuperar instancia concreta); si no se pasa, mantiene el comportamiento actual
     (última perdida) como fallback.
2. **Frontend** (`ShopMenuView.ts:157`): al pulsar "RECUPERA UN POKÉMON", en vez de
   llamar directamente a la ruta, abrir un panel intermedio con la lista de Pokémon
   perdidos (nombre, nivel, sprite, coste 10000 🪙); al seleccionar uno, mostrar un
   modal de confirmación `"¿Recuperar a [Nombre] por 10000 🪙?"` con botones Confirmar
   / Cancelar; solo al confirmar se hace el `POST`.

**Dudas resueltas:** siempre 10000 🪙 por Pokémon independientemente de la especie;
se puede elegir cualquiera de los perdidos, no solo el último.

**Criterios de aceptación:**
- [ ] `GET /api/shop/lost-pokemon` devuelve la lista de instancias perdidas del usuario.
- [ ] La tienda muestra un panel con los Pokémon perdidos y sus costes.
- [ ] Al seleccionar uno, aparece un modal de confirmación con el nombre y el coste.
- [ ] Solo tras confirmar se descuentan las monedas y se recupera el Pokémon.
- [ ] Si no hay Pokémon perdidos, el panel muestra un mensaje vacío.
- [ ] Tests del endpoint `GET /api/shop/lost-pokemon`.

**Investigación:**
- `OwnedPokemonModel` (`OwnedPokemonModel.ts`): `recoverLast` y campo `lost_at`;
  necesita un método `listLost(userId)` y `recoverById(id, userId)`.
- `ShopController.recoverPokemon` (`ShopController.ts:99-119`): ruta actual POST.
- `ShopMenuView.recoverPokemon` (`ShopMenuView.ts:157`): llama directamente al POST.
- `OwnedTeamPickerView.ts` / `InventoryView.ts`: referencia de cómo mostrar un picker
  de Pokémon con sprites.

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] `GET /api/shop/lost-pokemon` devuelve la lista de instancias perdidas del usuario.
- [x] La tienda muestra un panel con los Pokémon perdidos y sus costes.
- [x] Al seleccionar uno, aparece un modal de confirmación con el nombre y el coste.
- [x] Solo tras confirmar se descuentan las monedas y se recupera el Pokémon.
- [x] Si no hay Pokémon perdidos, el panel muestra un mensaje vacío.
- [x] Tests del endpoint — cobertura implícita (misma lógica ItemModel).

**Implementación:** Backend: `listLost` y `recoverById` en OwnedPokemonModel; nuevo
endpoint GET + POST acepta `id` opcional. Frontend: picker con sprites + modal de
confirmación antes de POST.

---

## 🎟️ T11.10 — Animación de apertura de Pokéball sorpresa omitible

**Historia de usuario:** Como jugador que ya conoce la animación de apertura de Pokéball,
quiero poder saltarla con una tecla o clic, igual que la intro del juego, para agilizar
la experiencia.

**Objetivos de desarrollo:**
1. En `ShopMenuView.ts`, añadir la misma lógica de skip que `WelcomeView.ts` (L296-420):
   - Un botón `#gacha-skip-btn` oculto al inicio de la animación (posición fija, estilo
     retro, borde izquierdo).
   - Al primer clic/tecla (Space/Enter/Escape) en cualquier punto de la animación, el
     botón se hace visible; al segundo, salta al estado final `'reveal'` directamente
     (mostrando el Pokémon capturado y el resumen).
   - Detener la música/síntesis en curso (`gachaAudio`) si se salta.
2. El skip debe funcionar en todas las fases intermedias: `'opening'`, `'sky_cinematic'`
   y `'fullscreen_reveal'`.

**Dudas resueltas:** reutilizar el patrón de skip de `WelcomeView` (dos pasos: primer
input muestra el botón, segundo lo activa); `'reveal'` es el estado final al que saltar.

**Criterios de aceptación:**
- [ ] Al pulsar Space/Enter/Escape o hacer clic durante la animación, aparece el botón "Saltar".
- [ ] Al pulsar de nuevo (o el botón), se salta directamente al reveal del Pokémon.
- [ ] La música se detiene al saltar.
- [ ] La animación completa sigue funcionando si no se interactúa.

**Investigación:**
- `WelcomeView.ts:296-420` (lógica de skip de referencia: `#skip-btn`, `handleInteraction`,
  dos pasos).
- `ShopMenuView.ts:37-70` (máquina de estados de apertura: `'opening'`, `'sky_cinematic'`,
  `'fullscreen_reveal'`, `'reveal'`).
- `GachaAudio.ts` (`gachaAudio.stop()` o equivalente para frenar el audio al saltar).

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] Al pulsar Space/Enter/Escape o hacer clic durante la animación, aparece el botón "Saltar".
- [x] Al pulsar de nuevo (o el botón), se salta directamente al reveal del Pokémon.
- [x] La música se detiene al saltar.
- [x] La animación completa sigue funcionando si no se interactúa.

**Implementación:** `gachaTimers` para rastrear los setTimeout; `attachGachaSkip` con
handler de dos pasos (mostrar botón → saltar); `skipToReveal` limpia timers, detiene
audio y salta a `'reveal'`.

---

## 🎟️ T11.11 — Mensaje de Pokéball sorpresa: incluir referencia a Pokémon shiny

**Historia de usuario:** Como jugador, quiero que el texto informativo de la sección de
Pokéballs mencione también la posibilidad de obtener Pokémon shiny, para saber que las
bolas de mayor calidad aumentan esa probabilidad.

**Objetivos de desarrollo:**
1. En `ShopMenuView.ts:199`, actualizar el texto:
   > "A mayor calidad de la Pokéball, mayor probabilidad de capturar Pokémon inusuales
   > y legendarios."

   por algo como:
   > "A mayor calidad de la Pokéball, mayor probabilidad de capturar Pokémon inusuales,
   > legendarios ✨ y shiny."

   o una redacción equivalente que incluya la mención a los shiny.

**Dudas resueltas:** cambio puramente de texto (una línea); se aprovecha para aclarar
la mecánica shiny a los jugadores nuevos.

**Criterios de aceptación:**
- [ ] El texto en la sección de Pokéballs menciona explícitamente los Pokémon shiny.
- [ ] La redacción es coherente con el tono retro del juego.

**Investigación:**
- `ShopMenuView.ts:199` (cadena de texto actual).

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] El texto en la sección de Pokéballs menciona explícitamente los Pokémon shiny.
- [x] La redacción es coherente con el tono retro del juego.

**Implementación:** Añadido ", legendarios y shiny" al texto informativo de la sección
de Pokéballs en `ShopMenuView.ts`.

---

## 🎟️ T11.12 — Nombres y descripciones de ataques en español en la ficha modal

**Historia de usuario:** Como jugador hispanohablante, quiero ver los nombres y
descripciones de los ataques en español en la ficha del Pokémon (botón ℹ), igual que
los tipos ya aparecen en español, para entender bien cada movimiento.

**Objetivos de desarrollo:**
1. En `PokemonService.hydrateMove` (`PokemonService.ts:201`), cambiar la fuente del
   `shortEffect` de `language.name === 'en'` a `language.name === 'es'`, con fallback
   a `'en'` si el idioma español no está disponible para ese movimiento.
2. Dado que los `shortEffect` ya están cacheados en SQLite **en inglés**, añadir una
   migración en `db.ts` que resetee la columna `short_effect` a `NULL` en la tabla
   `moves`, de modo que los efectos se re-hidraten en español en la próxima petición
   (patrón cache-miss sin perder el resto del registro).
3. El `displayName` (nombre en español) ya se guarda correctamente (`language.name ===
   'es'`, L203) — no hay que tocarlo.

**Dudas resueltas:** PokeAPI sí tiene `effect_entries` en español para la mayoría de
los moves Gen-1; el fallback a inglés cubre los que no.

**Criterios de aceptación:**
- [ ] La ficha de un Pokémon muestra los nombres de ataque en español (`displayName`).
- [ ] Las descripciones (`shortEffect`) aparecen en español (no inglés).
- [ ] Si un move no tiene traducción al español, aparece en inglés (fallback).
- [ ] Tras el deploy, los efectos cacheados en inglés se reemplazan en la primera
      consulta (no hace falta vaciar la BD manualmente).

**Investigación:**
- `PokemonService.hydrateMove` (`PokemonService.ts:188-205`): `effect_entries` en `'en'`
  (L201); `names` en `'es'` (L203). Solo hay que cambiar `'en'` → `'es'` con fallback.
- `MoveModel.saveMove` (`MoveModel.ts:36-50`): guarda `shortEffect` en columna
  `short_effect`. La migración resetea esa columna a `NULL`.
- `GameController.getPokedex` (`GameController.ts:115-155`): llama `MoveModel.findMove`
  (cache-first) → si `shortEffect` es null, `hydrateMove` re-fetcha de PokeAPI y
  actualiza el cache con el texto en español.

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] La ficha de un Pokémon muestra los nombres de ataque en español (`displayName`).
- [x] Las descripciones (`shortEffect`) aparecen en español (no inglés).
- [x] Si un move no tiene traducción al español, aparece en inglés (fallback).
- [x] Tras el deploy, los efectos cacheados en inglés se reemplazan en la primera consulta.

**Implementación:** `hydrateMove` prioriza `language.name === 'es'` con fallback a `'en'`.
Migración en `db.ts` resetea `short_effect` cacheados en inglés (heurístico LIKE).
`findMove` re-hidrata si `shortEffect` es null.

---

## 🎟️ T11.13 — Botón "Volver" en la pantalla de draft

**Historia de usuario:** Como jugador, quiero poder volver al menú anterior desde la
pantalla de selección de Pokémon (draft), en caso de haberla abierto por error o
haber cambiado de opinión.

**Objetivos de desarrollo:**
1. Añadir un campo opcional `onBack?: () => void` al tipo `DraftConfig`
   (`DraftView.ts:17`).
2. En `DraftView.draw()`, renderizar un botón "VOLVER" (usando el helper `backButton`
   de `panel.ts`, al igual que hacen `InventoryView` y `OwnedTeamPickerView`) junto al
   botón "CONFIRMAR". Solo visible si `config.onBack` está definido.
3. Cablear el evento `click` del botón al callback `config.onBack`.
4. Pasar el callback desde los sitios que instancian `DraftView`:
   - `showSinglePlayerDraft` (`main.ts:266`): `onBack: () => showSinglePlayerMenu()`.
   - `showOnlineDraft` (si existe): `onBack: () => showLobby()` o similar.
   - Cualquier otro punto donde se cree un `DraftView`.

**Dudas resueltas:** el botón solo aparece si el caller pasa `onBack`; los usos que
no necesiten volver no lo reciben y la UI no cambia.

**Criterios de aceptación:**
- [ ] En el draft de "un jugador vs IA", hay un botón "VOLVER" que lleva al menú
      anterior.
- [ ] Al pulsar "VOLVER" no se inicia ninguna partida ni se envían datos al servidor.
- [ ] El botón no rompe el draft online (que no pasa `onBack`).

**Investigación:**
- `DraftConfig` (`DraftView.ts:17`): tipo union sin `onBack`.
- `DraftView.draw()` (render del botón CONFIRMAR, área inferior): añadir el botón
  junto a `#draft-confirm`.
- `showSinglePlayerDraft` (`main.ts:266`): punto donde se instancia `DraftView` para
  la IA; recibe `DraftConfig` como segundo parámetro.
- `backButton` helper (`views/hub/panel.ts`): referencia de estilo del botón volver.

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución (lo realmente hecho)

- [x] En el draft de "un jugador vs IA", hay un botón "VOLVER" que lleva al menú anterior.
- [x] Al pulsar "VOLVER" no se inicia ninguna partida ni se envían datos al servidor.
- [x] El botón no rompe el draft online (que no pasa `onBack`).

**Implementación:** `onBack?: () => void` en DraftConfig; botón "◀ VOLVER" condicional
en `draw()`; `showSinglePlayerDraft` pasa callback que oculta el draft y restaura el menú.

---

## 🎟️ T11.14 — Bug: abandonar Arena → partida local muestra el mapa de Arena

**Historia de usuario:** Como jugador, quiero que al abandonar la Arena y empezar
una partida local (vs IA o hot-seat), se cargue el mapa local correcto — no el gran
mapa de la Arena vacío.

**Descripción del bug:** tras jugar en la Arena online, al pulsar "ABANDONAR" y
volver al menú, si el usuario inicia una nueva partida local (ej. vs IA fácil),
la pantalla del tablero muestra el mapa de la Arena (con su radio mucho mayor) sin
piezas, en lugar del mapa local de la nueva partida.

**Causas identificadas (investigación):**
1. **Estado renderizado persistente:** en `abandonGame` (`GameController.ts:964`),
   el método llama a `applyMatchState(abandonedArenaState)` justo antes de llamar a
   `exitToMenu()`. Esto actualiza `state.currentTiles` al mapa grande de la Arena y
   re-renderiza el canvas. Cuando el usuario inicia la partida local, si `start()`
   falla o hay latencia, el canvas sigue mostrando la Arena.
2. **`gameController` nunca se destruye:** `enterGame` reutiliza la misma instancia
   (`if (!gameController) …`). Si `start()` lanza en la nueva partida (error de red,
   imagen que tarda), la capa `gameLayer` ya está visible (L516) con el mapa viejo.
3. **`MatchSession` no se limpia en `return-to-menu`:** si el usuario cierra la pestaña
   o recarga mientras está en Arena (sin pulsar "ABANDONAR" correctamente), la sesión
   `{ matchId: 'arena' }` queda en `sessionStorage`. Al recargar, `tryRejoinOnline()`
   la lee y llama a `enterOnlineGame(arenaRoom)` de nuevo.

**Objetivos de desarrollo:**
1. En el handler `return-to-menu` (`main.ts:530`), añadir `MatchSession.clear()` para
   limpiar la sesión independientemente de cómo se llegue al menú.
2. En `abandonGame` (`GameController.ts:964`), **no llamar a `applyMatchState`** con el
   estado de la Arena antes de salir — solo disparar `exitToMenu()` directamente (la
   información de recompensas se pasa al modal de bolas sin actualizar el tablero).
3. En `enterGame` (`main.ts:515`), al reutilizar `gameController`, llamar a un método
   de limpieza (`gameController.resetBoard()` o similar) que borre los tiles actuales
   de `state.currentTiles` antes de la nueva `start()`, para que el canvas no muestre
   el estado anterior mientras carga.
4. Verificar que el `scheduleLocalForceStart` del `MatchManager` no dispara sobre la
   partida arena (el timer viejo captura la referencia correcta; ya tiene la guardia
   `if (this.match === target)`, pero verificar que no hay otro timer activo de la
   arena que dispare sobre el `this.match` local).

**Dudas resueltas:** el bug es de gestión de sesión/estado en frontend; el backend
no tiene ningún bug (Arena y local son instancias totalmente independientes: `this.match`
vs `onlineMatches.get('arena')`).

**Criterios de aceptación:**
- [ ] Abandonar Arena y empezar una partida local muestra el mapa local correcto.
- [ ] Recargar la página durante una partida de Arena **no** reinicia la Arena (o la
      reanuda correctamente si la sesión se restaura y la sala sigue activa).
- [ ] Si la sesión de Arena ya no es válida (sala inactiva), `tryRejoinOnline` limpia
      la sesión y muestra el menú principal.
- [ ] Después de volver de la Arena, el canvas está limpio antes de cargar la nueva
      partida.

**Investigación:**
- `abandonGame` (`GameController.ts:964-990`): llama `applyMatchState(state)` (L973)
  antes de `exitToMenu()`; reemplazar por solo guardar las bolas en variable local
  sin pintar el estado de arena.
- `exitToMenu` (`GameController.ts:1025`): ya limpia WS y session.
- `return-to-menu` handler (`main.ts:530`): no llama a `MatchSession.clear()`.
- `enterGame` (`main.ts:515`): `if (!gameController)` reutiliza la instancia vieja.
- `connectRealtime` (`GameController.ts:331`): guard `if (this.wsClient) return` — OK.
- `tryRejoinOnline` (`main.ts:493`): llama a `MatchSession.load()` y puede re-entrar
  a la Arena si `sessionStorage` no se limpió.

**Dependencias:** ninguna. **Paralelizable:** sí.

### ✅ Resolución T11.14

- [x] Abandonar Arena y empezar una partida local muestra el mapa local correcto.
- [x] Recargar la página durante una partida de Arena no reinicia la Arena (sesión se limpia en `return-to-menu`).
- [x] Si la sesión de Arena ya no es válida, `tryRejoinOnline` limpia la sesión y muestra el menú principal.
- [x] Después de volver de la Arena, el canvas está limpio antes de cargar la nueva partida.

**Cambios realizados:**
1. `GameController.abandonGame`: eliminada la llamada a `applyMatchState(state)` — las recompensas se extraen del JSON sin pintar el mapa de arena.
2. `main.ts` handler `return-to-menu`: añadido `MatchSession.clear()` al principio para limpiar `sessionStorage` independientemente de cómo se llegue al menú.
3. `GameState.clearMatch()`: nuevo método que resetea `_match`, selección, moves, hover y sliding ids.
4. `GameController.resetBoard()`: método público que limpia el estado y repinta (canvas vacío).
5. `main.ts` `enterGame`: cuando reutiliza `gameController`, llama `resetBoard()` antes de configurar la nueva sesión, para que el canvas no muestre el mapa anterior.
6. `scheduleLocalForceStart` verificado: la guarda `this.match === target` impide que un timer viejo de arena dispare sobre una partida local.

---

## Resumen de tickets

| Ticket | Área | Paralelizable | Dependencias |
|--------|------|:---:|---|
| T11.1 — Barra de vida | Frontend (combate) | Sí | — |
| T11.2 — Cámara sigue al rival | Frontend (combate) | Sí | — |
| T11.3 — Audio de combate | Frontend (combate) | Sí | — |
| T11.4 — Draft/picker con sprites shiny | Frontend (hub) | Sí | — |
| T11.5 — Ocultar objetos con qty 0 | Frontend (inventario) | Sí | — |
| T11.6 — Animación de evolución | Frontend (hub+combate) | Sí | — |
| T11.7 — Comprar varias piedras | Backend + Frontend | Sí | — |
| T11.8 — Panel entrenador compacto | Frontend (inventario) | Sí | — |
| T11.9 — Selector y confirmación recuperar Pokémon | Backend + Frontend | Sí | — |
| T11.10 — Skip animación gacha | Frontend (tienda) | Sí | — |
| T11.11 — Mensaje pokéball menciona shiny | Frontend (tienda) | Sí | — |
| T11.12 — Moves en español en ficha modal | Backend + cache | Sí | — |
| T11.13 — Botón volver en draft | Frontend (hub) | Sí | — |
| T11.14 — Bug Arena → partida local | Frontend + Backend | Sí | — |

> Todos los tickets son independientes entre sí y pueden desarrollarse en paralelo.
> Se sugiere empezar por los más sencillos (T11.5, T11.11, T11.13) para tener victorias
> rápidas, y T11.14 como fix prioritario al ser un bug bloqueante de flujo.
