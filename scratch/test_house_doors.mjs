import assert from 'node:assert/strict';
import {
  validateLevel,
  initialState,
  step,
  won,
  conditionValue,
  lampCount,
  dayLampsToUnscrew
} from '../logic.mjs';

// Level with house at (1, 1), door facing South (dir: 2)
const makeLevel = (doorDir = 2, lit = true) => ({
  id: 'house-door-test',
  name: 'Тест дверей хатки',
  description: 'Тест дверей',
  width: 3,
  depth: 3,
  start: { x: 1, z: 2, dir: 0 }, // South of house, facing North
  allowed: ['forward', 'left', 'right', 'jump', 'light'],
  limit: 0,
  cells: [
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, house: true, dir: doorDir, lit }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
  ]
});

console.log('--- 1. Validation with house.dir ---');
const l1 = makeLevel(2);
assert.deepEqual(validateLevel(l1), []);

const lBadDir = structuredClone(l1);
lBadDir.cells[1][1].dir = 5;
assert.ok(validateLevel(lBadDir).length > 0, 'Should reject invalid dir');

console.log('--- 2. Entering through the door (South door) ---');
{
  const l = makeLevel(2); // door faces South
  let s = initialState(l, 'dark');

  // Robot is at (1, 2) facing North (0) -> Door is on South side of (1, 1), so robot is right in front of door!
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), true);
  s = step(l, s, 'forward'); // Steps INTO house
  assert.equal(s.x, 1);
  assert.equal(s.z, 1);

  // Now inside house facing North (0). But door faces South (2)!
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), false, 'Cannot walk into North wall');
  assert.throws(() => step(l, s, 'forward'), /Вийти можна лише через двері/);

  // Turn right to face East (1)
  s = step(l, s, 'right');
  assert.equal(s.dir, 1);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), false, 'Cannot walk into East wall');
  assert.throws(() => step(l, s, 'forward'), /Вийти можна лише через двері/);

  // Turn right to face South (2) - towards the door!
  s = step(l, s, 'right');
  assert.equal(s.dir, 2);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), true, 'Can exit through South door');

  // Exit through door back to (1, 2)
  s = step(l, s, 'forward');
  assert.equal(s.x, 1);
  assert.equal(s.z, 2);
}

console.log('--- 3. Entering through solid wall is blocked ---');
{
  const l = makeLevel(2); // door faces South
  // Put robot at (0, 1) facing East (1) towards the West wall of house
  let s = { ...initialState(l, 'dark'), x: 0, z: 1, dir: 1 };
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), false, 'West wall blocks entry');
  assert.throws(() => step(l, s, 'forward'), /Зайти можна лише через двері/);

  // Put robot at (1, 0) facing South (2) towards the North (back) wall of house
  s = { ...initialState(l, 'dark'), x: 1, z: 0, dir: 2 };
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), false, 'North wall blocks entry');
  assert.throws(() => step(l, s, 'forward'), /Зайти можна лише через двері/);

  // Put robot at (2, 1) facing West (3) towards the East wall of house
  s = { ...initialState(l, 'dark'), x: 2, z: 1, dir: 3 };
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), false, 'East wall blocks entry');
  assert.throws(() => step(l, s, 'forward'), /Зайти можна лише через двері/);
}

console.log('--- 4. House door in other directions (e.g. East door, dir: 1) ---');
{
  const l = makeLevel(1); // door faces East
  // Approach from East (2, 1) facing West (3)
  let s = { ...initialState(l, 'dark'), x: 2, z: 1, dir: 3 };
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), true, 'Can enter East door');
  s = step(l, s, 'forward'); // inside house
  assert.equal(s.x, 1);
  assert.equal(s.z, 1);

  // Try walking West into back wall
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), false);
  assert.throws(() => step(l, s, 'forward'), /Вийти можна лише через двері/);

  // Turn around to face East (1)
  s = step(l, s, 'left');
  s = step(l, s, 'left');
  assert.equal(s.dir, 1);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'canForward' }, l, s), true);
  s = step(l, s, 'forward'); // Exits East door
  assert.equal(s.x, 2);
  assert.equal(s.z, 1);
}

console.log('--- 5. Flashlight in house ("в хатці є ліхтарик") ---');
{
  const l = makeLevel(2, true); // house is lit initially
  let s = initialState(l, 'light'); // day theme
  assert.equal(won(l, s), false);

  // Outside house, light command is rejected with clear message
  assert.throws(() => step(l, s, 'light'), /Стань на клітинку з ліхтарем або зайди в будиночок/);

  // Enter house through door
  s = step(l, s, 'forward');
  assert.equal(s.x, 1);
  assert.equal(s.z, 1);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'onLamp' }, l, s), true);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, l, s), true);

  // Turn off light inside house
  s = step(l, s, 'light');
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, l, s), false);
  assert.equal(won(l, s), true, 'Level won because house light was extinguished!');

  // Toggle light back on inside house
  s = step(l, s, 'light');
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, l, s), true);
  assert.equal(won(l, s), false);

  // Toggle off again
  s = step(l, s, 'light');
  assert.equal(won(l, s), true);

  // Turn around and exit house
  s = step(l, s, 'right');
  s = step(l, s, 'right');
  s = step(l, s, 'forward');
  assert.equal(s.x, 1);
  assert.equal(s.z, 2);
  assert.equal(won(l, s), true);
}

console.log('All house door and flashlight tests passed successfully!');
