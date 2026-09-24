import assert from 'node:assert/strict';
import {
  validateLevel,
  initialState,
  lampCount,
  dayLampsToUnscrew,
  won,
  step,
  conditionValue
} from '../logic.mjs';

const testLevel = {
  id: 'test-lamp-state',
  name: 'Тест ліхтарів',
  description: 'Тестовий опис',
  descriptionNight: 'Ніч',
  descriptionDay: 'День',
  width: 4,
  depth: 4,
  start: { x: 0, z: 3, dir: 0 },
  allowed: ['forward', 'light'],
  limit: 0,
  cells: [
    [
      { height: 0, tree: false, lamp: true, lit: false }, // unlit lamp at (0, 0)
      { height: 0, tree: false, lamp: true, lit: true },  // lit lamp at (1, 0)
      { height: 0, tree: false, lamp: false },
      { height: 0, tree: false, lamp: false }
    ],
    [
      { height: 0, tree: false, lamp: false },
      { height: 0, tree: false, lamp: false },
      { height: 0, tree: false, lamp: false },
      { height: 0, tree: false, lamp: false }
    ],
    [
      { height: 0, tree: false, lamp: false },
      { height: 0, tree: false, lamp: false },
      { height: 0, tree: false, lamp: false },
      { height: 0, tree: false, lamp: false }
    ],
    [
      { height: 0, tree: false, lamp: false }, // start at (0, 3)
      { height: 0, tree: false, lamp: false },
      { height: 0, tree: false, lamp: false },
      { height: 0, tree: false, lamp: false }
    ]
  ]
};

// 1. validateLevel
console.log('1. Testing validateLevel...');
assert.deepEqual(validateLevel(testLevel), []);

const invalidLevel = structuredClone(testLevel);
invalidLevel.cells[0][0].lit = 'not-a-bool';
assert.ok(validateLevel(invalidLevel).length > 0, 'Should reject non-boolean lit');

// 2. lamp counts
console.log('2. Testing counts...');
assert.equal(lampCount(testLevel), 2);
assert.equal(dayLampsToUnscrew(testLevel), 1); // Only cell (1, 0) has lit: true

// 3. Dark theme initial state and winning
console.log('3. Testing dark theme...');
const darkState = initialState(testLevel, 'dark');
assert.deepEqual(darkState.lit, ['1,0'], 'In dark mode, initially only lit:true lamp is in lit');
assert.equal(won(testLevel, darkState), false, 'Not won yet because 1 lamp remains unlit');

// Step onto (0, 0) and light it:
let s = { ...darkState, x: 0, z: 0 };
assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, testLevel, s), false);
s = step(testLevel, s, 'light');
assert.ok(s.lit.includes('0,0'));
assert.ok(s.lit.includes('1,0'));
assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, testLevel, s), true);
assert.equal(won(testLevel, s), true, 'All lamps are lit, so dark mode won!');

// 4. Light theme initial state and winning
console.log('4. Testing light theme...');
const lightState = initialState(testLevel, 'light');
assert.deepEqual(lightState.lit, ['0,0'], 'In light mode, initially the night-unlit lamp (0, 0) is burning');
assert.equal(won(testLevel, lightState), false, 'Not won yet because burning lamp not unscrewed');

// At (1, 0) - lamp is already off by day
let sLightUnlit = { ...lightState, x: 1, z: 0 };
assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, testLevel, sLightUnlit), false);

// At (0, 0) - lamp is burning in daytime, turning it off wins
let sLightLit = { ...lightState, x: 0, z: 0 };
assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, testLevel, sLightLit), true);
sLightLit = step(testLevel, sLightLit, 'light');
assert.deepEqual(sLightLit.unscrewed, ['0,0']);
assert.deepEqual(sLightLit.lit, []);
assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, testLevel, sLightLit), false);
assert.equal(won(testLevel, sLightLit), true, 'All burning lamps unscrewed, so light mode won!');

console.log('All tests passed successfully!');
