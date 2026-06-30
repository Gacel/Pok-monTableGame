const fs = require('fs');

const gridStr = `
I I I I I G G W G G G G S F F F
I I I I G G G W G G G G S F F F
I I I G G G G W S G G S S S F F
I I G G G G G W S S S S S S S S
I G G G G G G W W S S S S S S S
G G G G G G G G W S S S S S S S
G G G G G G G G W G G G S S S S
G G G G G G G W W G G G G S S S
G G G G G G W W G G G G G G G G
G G G G G W W G G G G G G G G G
G G G G G W G G G G G G G G G G
G G G G W W G G G G G G G G G G
G G G W W G G G G G G G G G G G
G G W W G G G G G G G G G G G G
G W W G G G G G G G G G G G G G
W W G G G G G G G G G G G G G G
`.trim().split('\n').map(r => r.trim().split(' '));

const charToBiome = {
  'F': 1, // FIRE
  'W': 2, // WATER
  'G': 3, // GRASS
  'S': 4, // SAND
  'I': 5  // ICE
};

const data = [];
for (const row of gridStr) {
  for (const char of row) {
    data.push(charToBiome[char] || 3);
  }
}

// Ensure spawns are on Grass (3)
// p1 = y:0, x:0
data[0] = 3;
// p2 = y:1, x:1
data[16 + 1] = 3;
// p3 = y:2, x:3
data[32 + 3] = 3;

const map = {
  compressionlevel: -1,
  height: 16,
  hexsidelength: 32,
  infinite: false,
  layers: [{
    data: data,
    height: 16,
    id: 1,
    name: 'Tile Layer 1',
    opacity: 1,
    type: 'tilelayer',
    visible: true,
    width: 16,
    x: 0,
    y: 0
  }],
  nextlayerid: 2,
  nextobjectid: 1,
  orientation: 'hexagonal',
  renderorder: 'right-down',
  staggeraxis: 'y',
  staggerindex: 'odd',
  tiledversion: '1.10.1',
  tileheight: 64,
  tilesets: [{ firstgid: 1, name: 'biomes', tilewidth: 64 }],
  tilewidth: 64,
  type: 'map',
  version: '1.10',
  width: 16
};

fs.writeFileSync('/app/data/sample_map.json', JSON.stringify(map, null, 2));
console.log("Map generated successfully.");
