import { MatchManager } from './src/services/MatchManager.js';
import { getDb } from './src/models/db.js';

async function main() {
  await getDb(); // Ensure db is init
  const manager = new MatchManager();
  const game = await manager.createGame('test', { player1: ['pikachu'], player2: ['charmander'] }, 'ffa');
  console.log(JSON.stringify(game.getStateDTO().reserve, null, 2));
}
main();
