import './style.css';
import { GameController } from './controllers/GameController';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const controller = new GameController(canvas);
controller.start();
