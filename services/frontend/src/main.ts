import './style.css';
import type { RoomInfo, GameMode } from '@transcendence/shared';
import { GameController } from './controllers/GameController';
import { authState } from './auth/AuthState';
import { apiFetch } from './net/api';
import { MatchSession } from './state/MatchSession';
import type { OnlineSession } from './state/MatchSession';
import { LoginView } from './views/hub/LoginView';
import { AvatarCreationView } from './views/hub/AvatarCreationView';
import { MainMenuView } from './views/hub/MainMenuView';
import { PlayMenuView } from './views/hub/PlayMenuView';
import { SinglePlayerMenuView } from './views/hub/SinglePlayerMenuView';
import { MultiplayerMenuView } from './views/hub/MultiplayerMenuView';
import { CommunityMenuView } from './views/hub/CommunityMenuView';
import { ShopMenuView } from './views/hub/ShopMenuView';
import { AuctionHouseView } from './views/hub/AuctionHouseView';
import { LocalSetupView } from './views/hub/LocalSetupView';
import type { LocalGameConfig } from './views/hub/LocalSetupView';
import { SettingsView } from './views/hub/SettingsView';
import { LobbyView } from './views/hub/LobbyView';
import { DraftView } from './views/hub/DraftView';
import { WelcomeView } from './views/hub/WelcomeView';

const hubLayer = document.getElementById('hub-layer') as HTMLElement;
const gameLayer = document.getElementById('game-layer') as HTMLElement;
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

let gameController: GameController | null = null;
let currentLobby: LobbyView | null = null;

async function bootstrap() {
  // Catch token from OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    localStorage.setItem('token', tokenFromUrl);
    window.history.replaceState({}, document.title, window.location.pathname);
    authState.sessionToken = tokenFromUrl;
  }

  const hasSession = await authState.checkSession();

  if (!hasSession) {
    showWelcome();
  } else {
    if (!authState.user || !authState.user.username) {
      showAvatarCreation();
    } else {
      // Si hay una partida online en curso (F5), reconecta directamente.
      if (await tryRejoinOnline()) return;
      showMainMenu();
    }
  }
}

function hideSidebar() {
  const sidebar = document.getElementById('right-sidebar');
  if (sidebar) sidebar.classList.add('hidden');
  resizeGameArea();
}

/** Deja el hub visible y limpio (cierra el lobby si estaba abierto). */
function resetHubLayer() {
  hideSidebar();
  currentLobby?.destroy();
  currentLobby = null;
  hubLayer.style.display = '';
  hubLayer.classList.remove('opacity-0');
  hubLayer.innerHTML = '';
}

function showWelcome() {
  resetHubLayer();
  const welcomeLayer = document.getElementById('welcome-layer');
  if (welcomeLayer) {
    welcomeLayer.classList.remove('pointer-events-none');
    const welcomeView = new WelcomeView(welcomeLayer, () => {
      welcomeLayer.innerHTML = '';
      welcomeLayer.classList.add('pointer-events-none');
      showLogin();
    });
    welcomeView.render();
  } else {
    // Fallback if index.html is not updated
    const welcomeView = new WelcomeView(hubLayer, () => {
      showLogin();
    });
    welcomeView.render();
  }
}

function showLogin() {
  resetHubLayer();
  const loginView = new LoginView(hubLayer);
  loginView.render();
}

function showAvatarCreation() {
  resetHubLayer();
  const avatarView = new AvatarCreationView(hubLayer);
  avatarView.render();
}

export function showMainMenu() {
  resetHubLayer();
  const menuView = new MainMenuView(hubLayer);
  menuView.render();
}

export function showPlayMenu() {
  resetHubLayer();
  new PlayMenuView(hubLayer).render();
}

export function showSinglePlayerMenu() {
  resetHubLayer();
  new SinglePlayerMenuView(hubLayer).render();
}

export function showMultiplayerMenu() {
  resetHubLayer();
  new MultiplayerMenuView(hubLayer).render();
}

export function showCommunityMenu() {
  resetHubLayer();
  new CommunityMenuView(hubLayer).render();
}

export function showShopMenu() {
  resetHubLayer();
  new ShopMenuView(hubLayer).render();
}

export function showAuctionHouse() {
  resetHubLayer();
  new AuctionHouseView(hubLayer).render();
}

export function showLocalSetup() {
  resetHubLayer();
  new LocalSetupView(hubLayer).render();
}

export function showSettings() {
  resetHubLayer();
  new SettingsView(hubLayer).render();
}

// Resolución interna del área de juego
const GAME_W = 1600;
const GAME_H = 1000;

function resizeGameArea() {
  const container = document.getElementById('game-container');
  if (!container) return;
  const sidebar = document.getElementById('right-sidebar');
  const isSidebarVisible = sidebar && !sidebar.classList.contains('hidden');
  const targetW = isSidebarVisible ? 1984 : GAME_W;
  // Escala el container para aprovechar la pantalla dejando margen
  const scale = Math.min(window.innerWidth / targetW, window.innerHeight / GAME_H) * 0.95;
  container.style.transform = `scale(${scale})`;
}

// ------------------------------------------------------------ PARTIDA LOCAL
// Setup (2-4 jugadores, FFA/2v2) → Draft secuencial → POST /start → Tablero

export function startLocalGame(config: LocalGameConfig) {
  hubLayer.classList.add('opacity-0');
  setTimeout(() => {
    hubLayer.style.display = 'none';
    showLocalDraft(config);
  }, 500);
}

function showLocalDraft(config: LocalGameConfig) {
  hideSidebar();
  const draftLayer = document.getElementById('draft-layer') as HTMLElement;
  draftLayer.classList.remove('hidden');
  const view = new DraftView(
    draftLayer,
    { mode: 'local', players: config.players, gameMode: config.gameMode },
    (teams) => void onLocalDraftConfirmed(draftLayer, config, teams)
  );
  void view.render();
}

async function onLocalDraftConfirmed(
  draftLayer: HTMLElement,
  config: LocalGameConfig,
  teams: string[][]
) {
  const payload: Record<string, unknown> = { gameMode: config.gameMode };
  teams.forEach((team, i) => (payload[`player${i + 1}`] = team));
  try {
    const res = await apiFetch('/api/game/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'No se pudo iniciar la partida');
      return;
    }
  } catch {
    alert('Error de red al iniciar la partida');
    return;
  }
  draftLayer.classList.add('hidden');
  enterGame(null);
}

// ----------------------------------------------------------- PARTIDA ONLINE
// Lobby (crear/buscar) → sala de espera → draft de tu equipo → Tablero

export function showLobby(preset?: { capacity: number; gameMode: GameMode }) {
  resetHubLayer();
  currentLobby = new LobbyView(
    hubLayer,
    {
      onBack: showMultiplayerMenu,
      onDraft: (room) => showOnlineDraft(room),
      onGameStart: (room) => enterOnlineGame(room),
    },
    preset
  );
  void currentLobby.render();
}

// ------------------------------------------------------------------- ARENA
// Mundo vivo persistente: eliges equipo y entras directo (aunque estés solo).

export function startArena() {
  hideSidebar();
  const draftLayer = document.getElementById('draft-layer') as HTMLElement;
  draftLayer.classList.remove('hidden');
  const label = authState.user?.username ?? 'TU EQUIPO';
  void (async () => {
    let reserved: string[] = [];
    try {
      const res = await apiFetch('/api/arena');
      const data = await res.json();
      reserved = (data.room?.reserved ?? []) as string[];
    } catch {
      /* sin datos: el servidor validará colisiones */
    }
    const view = new DraftView(
      draftLayer,
      { mode: 'online', playerLabel: label, reserved },
      (teams) => {
        void (async () => {
          try {
            const res = await apiFetch('/api/arena/join', {
              method: 'POST',
              body: JSON.stringify({ team: teams[0] }),
            });
            const data = await res.json();
            draftLayer.classList.add('hidden');
            if (res.ok && data.room) {
              enterOnlineGame(data.room as RoomInfo);
            } else {
              alert(data.error ?? 'No se pudo entrar en la ARENA');
              showMainMenu();
            }
          } catch {
            draftLayer.classList.add('hidden');
            alert('Error de red al entrar en la ARENA');
            showMainMenu();
          }
        })();
      }
    );
    void view.render();
  })();
}

function showOnlineDraft(room: RoomInfo) {
  hideSidebar();
  const draftLayer = document.getElementById('draft-layer') as HTMLElement;
  draftLayer.classList.remove('hidden');
  const label = authState.user?.username ?? 'TU EQUIPO';
  const view = new DraftView(
    draftLayer,
    { mode: 'online', playerLabel: label, reserved: room.reserved ?? [] },
    (teams) => {
    void (async () => {
      try {
        const res = await apiFetch(`/api/lobby/matches/${room.id}/team`, {
          method: 'POST',
          body: JSON.stringify({ team: teams[0] }),
        });
        const data = await res.json();
        draftLayer.classList.add('hidden');
        if (res.ok && data.success) {
          currentLobby?.setRoom(data.room as RoomInfo);
        } else {
          alert(data.error ?? 'No se pudo guardar el equipo');
        }
      } catch {
        draftLayer.classList.add('hidden');
        alert('Error de red al guardar el equipo');
      }
    })();
  });
  void view.render();
}

function enterOnlineGame(room: RoomInfo) {
  if (!room.youAre) return;
  const playerNames: Record<string, string> = {};
  for (const p of room.players) playerNames[p.slot] = p.username;
  const session: OnlineSession = { matchId: room.id, mySlot: room.youAre, playerNames };
  MatchSession.save(session);

  const draftLayer = document.getElementById('draft-layer') as HTMLElement;
  draftLayer.classList.add('hidden');
  currentLobby?.destroy();
  currentLobby = null;
  hubLayer.classList.add('opacity-0');
  hubLayer.style.display = 'none';
  enterGame(session);
}

/** Reanuda una partida online tras un F5 (sesión en sessionStorage). */
async function tryRejoinOnline(): Promise<boolean> {
  const session = MatchSession.load();
  if (!session) return false;
  try {
    const res = await apiFetch(`/api/lobby/matches/${session.matchId}`);
    if (res.ok) {
      const data = await res.json();
      const room = data.room as RoomInfo;
      if (room.youAre && (room.status === 'active' || room.status === 'combat')) {
        enterOnlineGame(room);
        return true;
      }
    }
  } catch {
    /* sin red: seguimos al menú */
  }
  MatchSession.clear();
  return false;
}

// ------------------------------------------------------------------- TABLERO

function enterGame(session: OnlineSession | null) {
  gameLayer.classList.remove('hidden');
  const sidebar = document.getElementById('right-sidebar');
  if (sidebar) sidebar.classList.remove('hidden');
  resizeGameArea();
  if (!gameController) {
    gameController = new GameController(canvas);
  }
  gameController.setSession(session);
  gameController.start();
}

// Salir de la partida al menú principal (p. ej. tras pulsar ABANDONAR).
document.addEventListener('return-to-menu', () => {
  gameLayer.classList.add('hidden');
  const sidebar = document.getElementById('right-sidebar');
  if (sidebar) sidebar.classList.add('hidden');
  showMainMenu();
});

// Inicializar y reescalar al cargar la página
if ((window as any)._resizeGameArea) {
  window.removeEventListener('resize', (window as any)._resizeGameArea);
}
(window as any)._resizeGameArea = resizeGameArea;
window.addEventListener('resize', resizeGameArea);
resizeGameArea();

// Suscripción al estado de autenticación
authState.subscribe(() => {
  if (!authState.sessionToken) {
    showWelcome();
  } else if (!authState.user || !authState.user.username) {
    showAvatarCreation();
  } else {
    showMainMenu();
  }
});

bootstrap();
