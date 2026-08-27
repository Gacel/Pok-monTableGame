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

> Todos los tickets son independientes entre sí y pueden desarrollarse en paralelo.
> Se sugiere empezar por los más sencillos (T11.5, T11.11) para tener victorias rápidas,
> y T11.1/T11.2/T11.3 para el impacto mayor en la sensación de combate.
