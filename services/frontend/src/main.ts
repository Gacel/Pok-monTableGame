import './style.css';
import { GameController } from './controllers/GameController';
import { authState } from './auth/AuthState';
import { LoginView } from './views/hub/LoginView';
import { AvatarCreationView } from './views/hub/AvatarCreationView';
import { MainMenuView } from './views/hub/MainMenuView';

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

function showLogin() {
  hubLayer.innerHTML = '';
  const loginView = new LoginView(hubLayer);
  loginView.render();
}

function showAvatarCreation() {
  hubLayer.innerHTML = '';
  const avatarView = new AvatarCreationView(hubLayer);
  avatarView.render();
}

function showMainMenu() {
  hubLayer.innerHTML = '';
  const menuView = new MainMenuView(hubLayer);
  menuView.render();
}

function resizeGameArea() {
  const wrapper = document.getElementById('game-wrapper');
  if (!wrapper) return;
  // Margen del 5% para que no quede pegado a los bordes
  // Volvemos a escalar al tamaño original de la pantalla del juego (1200x950)
  const scale = Math.min(window.innerWidth / 1200, window.innerHeight / 950) * 0.95;
  wrapper.style.transform = `scale(${scale})`;
}

export function startGame() {
  hubLayer.classList.add('opacity-0');
  setTimeout(() => {
    hubLayer.style.display = 'none';
    gameLayer.classList.remove('hidden');
    
    if (!gameController) {
      gameController = new GameController(canvas);
      gameController.start();
    }
  }, 500);
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
