import './style.css';
import { GameController } from './controllers/GameController';
import { authState } from './auth/AuthState';
import { LoginView } from './views/hub/LoginView';
import { AvatarCreationView } from './views/hub/AvatarCreationView';
import { MainMenuView } from './views/hub/MainMenuView';
import { DraftView } from './views/hub/DraftView';
import type { DraftTeams } from './views/hub/DraftView';

const hubLayer = document.getElementById('hub-layer') as HTMLElement;
const gameLayer = document.getElementById('game-layer') as HTMLElement;
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

let gameController: GameController | null = null;

async function bootstrap() {
  const hasSession = await authState.checkSession();
  
  if (!hasSession) {
    showLogin();
  } else {
    if (!authState.user || !authState.user.username) {
      showAvatarCreation();
    } else {
      showMainMenu();
    }
  }
}

function hideSidebar() {
  const sidebar = document.getElementById('right-sidebar');
  if (sidebar) sidebar.classList.add('hidden');
  resizeGameArea();
}

function showLogin() {
  hideSidebar();
  hubLayer.innerHTML = '';
  const loginView = new LoginView(hubLayer);
  loginView.render();
}

function showAvatarCreation() {
  hideSidebar();
  hubLayer.innerHTML = '';
  const avatarView = new AvatarCreationView(hubLayer);
  avatarView.render();
}

function showMainMenu() {
  hideSidebar();
  hubLayer.innerHTML = '';
  const menuView = new MainMenuView(hubLayer);
  menuView.render();
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

// Menú → Draft → (POST /start) → Tablero
export function startGame() {
  hubLayer.classList.add('opacity-0');
  setTimeout(() => {
    hubLayer.style.display = 'none';
    showDraft();
  }, 500);
}

function showDraft() {
  hideSidebar();
  const draftLayer = document.getElementById('draft-layer') as HTMLElement;
  draftLayer.classList.remove('hidden');
  const view = new DraftView(draftLayer, (teams) => onDraftConfirmed(draftLayer, teams));
  view.render();
}

async function onDraftConfirmed(draftLayer: HTMLElement, teams: DraftTeams) {
  try {
    const res = await fetch('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teams),
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
  enterGame();
}

function enterGame() {
  gameLayer.classList.remove('hidden');
  const sidebar = document.getElementById('right-sidebar');
  if (sidebar) sidebar.classList.remove('hidden');
  resizeGameArea();
  if (!gameController) {
    gameController = new GameController(canvas);
  }
  gameController.start();
}

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
    showLogin();
  } else if (!authState.user || !authState.user.username) {
    showAvatarCreation();
  } else {
    showMainMenu();
  }
});

bootstrap();
