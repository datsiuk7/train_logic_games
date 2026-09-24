import assert from 'node:assert/strict';
import { validateLevel, initialState, won, step } from '../logic.mjs';

// Simulate admin editor paint operations
let level = {
  id: 'test-flow',
  name: 'Тестовий потік',
  description: 'Опис',
  descriptionNight: 'Ніч',
  descriptionDay: 'День',
  category: 'basic',
  width: 3,
  depth: 3,
  start: { x: 0, z: 2, dir: 0 },
  allowed: ['forward', 'light'],
  limit: 0,
  cells: [
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
  ]
};

let lampLitState = false;

function paint(x, z, tool) {
  let c = level.cells[z][x];
  let next = c ? { ...c } : null;
  if (tool === 'lamp') {
    if (c.lamp) {
      const targetLit = (c.lit === true) === lampLitState ? !lampLitState : lampLitState;
      next = { ...c, lamp: true, lit: targetLit };
      lampLitState = targetLit;
    } else {
      next = { ...c, lamp: true, lit: lampLitState };
    }
  }
  level.cells[z][x] = next;
}

// 1. Place unlit lamp at (1, 1)
paint(1, 1, 'lamp');
assert.equal(level.cells[1][1].lamp, true);
assert.equal(level.cells[1][1].lit, false);

// 2. Click existing lamp at (1, 1) to toggle it to lit
paint(1, 1, 'lamp');
assert.equal(level.cells[1][1].lit, true, 'Clicking unlit lamp toggles it to lit');
assert.equal(lampLitState, true, 'Active tool state updates to lit');

// 3. Click again to toggle back to unlit
paint(1, 1, 'lamp');
assert.equal(level.cells[1][1].lit, false, 'Clicking lit lamp toggles it back to unlit');
assert.equal(lampLitState, false, 'Active tool state updates to unlit');

// 4. Switch tool state to 'lit' explicitly and paint at (2, 0)
lampLitState = true;
paint(2, 0, 'lamp');
assert.equal(level.cells[0][2].lamp, true);
assert.equal(level.cells[0][2].lit, true);

// 5. Check validation of the constructed level
const errors = validateLevel(level);
assert.deepEqual(errors, []);

// 6. Test game execution
const darkState = initialState(level, 'dark');
assert.deepEqual(darkState.lit, ['2,0']); // (2, 0) was placed lit!
assert.equal(won(level, darkState), false);

// Robot lights (1, 1)
const afterLightState = step(level, { ...darkState, x: 1, z: 1 }, 'light');
assert.ok(afterLightState.lit.includes('1,1'));
assert.ok(afterLightState.lit.includes('2,0'));
assert.equal(won(level, afterLightState), true);

console.log('Editor lamp flow simulation passed!');
