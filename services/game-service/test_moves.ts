import { MoveModel } from './src/models/MoveModel.js';
import { PokemonService } from './src/services/PokemonService.js';

async function main() {
  const moves = await PokemonService.getCuratedMoves('pikachu', 'ELECTRIC');
  console.log(moves);
}
main();
