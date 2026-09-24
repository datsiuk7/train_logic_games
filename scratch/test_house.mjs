import assert from 'node:assert/strict';
import {
  validateLevel,
  initialState,
  lampCount,
  dayLampsToUnscrew,
  won,
  step,
  conditionValue,
  key
} from '../logic.mjs';

// Level with a house at (1, 1), lit initially, robot starts at (0, 1) facing East (dir 1)
const level = {
  id: 'house-test',
  name: 'Тест будинку',
  description: 'Зайди в будинок, вимкни світло і вийди',
  descriptionNight: 'Ніч',
  descriptionDay: 'День: зайди, вимкни світло і вийди',
  width: 3,
  depth: 3,
  start: { x: 0, z: 1, dir: 1 }, // Facing East towards (1, 1)
  allowed: ['forward', 'left', 'right', 'light'],
  limit: 0,
  cells: [
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, house: true, dir: 3, lit: true }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
  ]
};

// 1. Validation
console.log('1. Testing validation...');
assert.deepEqual(validateLevel(level), []);

// Incompatible: house and tree
const treeHouse = structuredClone(level);
treeHouse.cells[1][1].tree = true;
assert.ok(validateLevel(treeHouse).length > 0, 'House and tree must be incompatible');

// Incompatible: house and lamp
const lampHouse = structuredClone(level);
lampHouse.cells[1][1].lamp = true;
assert.ok(validateLevel(lampHouse).length > 0, 'House and lamp must be incompatible');

// 2. Counts
console.log('2. Testing counts...');
assert.equal(lampCount(level), 1);
assert.equal(dayLampsToUnscrew(level), 1);

// 3. User scenario in light mode:
// "щоб наприклад там світилося світло, ми зайшли виключили і вийшли"
console.log('3. Testing day scenario: enter house, turn off light, exit...');
let s = initialState(level, 'light');
assert.deepEqual(s.lit, ['1,1']);
assert.equal(won(level, s), false);

// Robot steps forward into the house through West door
s = step(level, s, 'forward');
assert.equal(s.x, 1);
assert.equal(s.z, 1);
assert.equal(conditionValue({ kind: 'sensor', sensor: 'onLamp' }, level, s), true);
assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, level, s), true);

// Robot executes light to turn it off
s = step(level, s, 'light');
assert.deepEqual(s.unscrewed, ['1,1']);
assert.deepEqual(s.lit, []);
assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, level, s), false);
assert.equal(won(level, s), true, 'Won because light in house is extinguished!');

// Robot turns around to face West (door) and exits the house
s = step(level, s, 'left');
s = step(level, s, 'left');
assert.equal(s.dir, 3);
s = step(level, s, 'forward');
assert.equal(s.x, 0);
assert.equal(s.z, 1);
assert.equal(conditionValue({ kind: 'sensor', sensor: 'onLamp' }, level, s), false);

// 4. Night scenario: unlit house, robot enters, turns on light, exits
console.log('4. Testing night scenario: enter house, turn on light, exit...');
const nightLevel = structuredClone(level);
nightLevel.cells[1][1].lit = false;
let sn = initialState(nightLevel, 'dark');
assert.deepEqual(sn.lit, []);
assert.equal(won(nightLevel, sn), false);

sn = step(nightLevel, sn, 'forward'); // enter house through West door
assert.equal(conditionValue({ kind: 'sensor', sensor: 'onLamp' }, nightLevel, sn), true);
assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, nightLevel, sn), false);

sn = step(nightLevel, sn, 'light'); // turn on light
assert.deepEqual(sn.lit, ['1,1']);
assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, nightLevel, sn), true);
assert.equal(won(nightLevel, sn), true);

// Turn around and exit house through door
sn = step(nightLevel, sn, 'left');
sn = step(nightLevel, sn, 'left');
sn = step(nightLevel, sn, 'forward');
assert.equal(sn.x, 0);
assert.equal(sn.z, 1);

console.log('All house tests passed successfully!');
