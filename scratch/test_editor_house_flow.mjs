import assert from 'node:assert/strict';
import { validateLevel, initialState, step } from '../logic.mjs';

let level = {
  id: 'house-flow-test',
  name: 'Тест потоку хатки',
  description: 'Опис',
  descriptionNight: 'Ніч',
  descriptionDay: 'День',
  category: 'basics',
  width: 4,
  depth: 4,
  start: { x: 0, z: 0, dir: 0 },
  allowed: ['forward', 'left', 'right', 'light'],
  limit: 0,
  cells: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ height: 0, tree: false, lamp: false, house: false, lit: false })))
};

let houseDir = 2; // default South
let lampLitState = false;

function paint(x, z, tool) {
  let c = level.cells[z][x];
  let next = c ? { ...c } : null;
  if (tool === 'house') {
    if (c.house) {
      let nextDir = houseDir;
      const currentDir = Number.isInteger(c.dir) ? c.dir : 2;
      if (currentDir === houseDir) {
        nextDir = (houseDir + 1) % 4;
        houseDir = nextDir;
      }
      next = { ...c, house: true, lamp: false, dir: nextDir, lit: lampLitState };
    } else {
      next = { ...c, house: true, lamp: false, dir: houseDir, lit: lampLitState };
    }
  }
  level.cells[z][x] = next;
}

// 1. Place a house at (1, 1) with default South door
paint(1, 1, 'house');
assert.equal(level.cells[1][1].house, true);
assert.equal(level.cells[1][1].dir, 2, 'Default direction should be 2 (South)');
assert.equal(level.cells[1][1].lit, false);

// 2. Click the same house to rotate it
paint(1, 1, 'house');
assert.equal(level.cells[1][1].dir, 3, 'Rotates to 3 (West)');
assert.equal(houseDir, 3);

// 3. Click again
paint(1, 1, 'house');
assert.equal(level.cells[1][1].dir, 0, 'Rotates to 0 (North)');
assert.equal(houseDir, 0);

// 4. Click again
paint(1, 1, 'house');
assert.equal(level.cells[1][1].dir, 1, 'Rotates to 1 (East)');
assert.equal(houseDir, 1);

// 5. Select South explicitly in toolbar and paint at (2, 2)
houseDir = 2;
paint(2, 2, 'house');
assert.equal(level.cells[2][2].dir, 2);

// 6. Validation passes
assert.deepEqual(validateLevel(level), []);

console.log('Editor house flow simulation passed!');
