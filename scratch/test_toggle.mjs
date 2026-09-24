import assert from 'node:assert/strict';
import {
  initialState,
  step,
  won,
  lampCount,
  conditionValue,
  valueOf,
  key
} from '../logic.mjs';

// Level with a lamp at (1, 1) and robot at (1, 1)
const levelLamp = {
  id: 'toggle-lamp-test',
  name: 'Тест ліхтаря',
  width: 3,
  depth: 3,
  start: { x: 1, z: 1, dir: 0 },
  allowed: ['forward', 'light'],
  limit: 0,
  cells: [
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
  ]
};

// Level with a house at (1, 1) and robot at (1, 1)
const levelHouse = {
  id: 'toggle-house-test',
  name: 'Тест будинку',
  width: 3,
  depth: 3,
  start: { x: 1, z: 1, dir: 0 },
  allowed: ['forward', 'light'],
  limit: 0,
  cells: [
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, house: true }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
  ]
};

console.log('--- 1. Dark theme lamp toggle ---');
{
  let s = initialState(levelLamp, 'dark');
  assert.equal(s.lit.includes('1,1'), false, 'Initially off');
  assert.equal(won(levelLamp, s), false);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, levelLamp, s), false);
  assert.equal(valueOf({ kind: 'remaining' }, levelLamp, s, {}), 1);

  // 1st light -> ON
  s = step(levelLamp, s, 'light');
  assert.equal(s.lit.includes('1,1'), true, 'Turned ON');
  assert.equal(won(levelLamp, s), true, 'Level won because lamp is lit');
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, levelLamp, s), true);
  assert.equal(valueOf({ kind: 'remaining' }, levelLamp, s, {}), 0);

  // 2nd light -> OFF ("ще раз включає то це означає що виключає")
  s = step(levelLamp, s, 'light');
  assert.equal(s.lit.includes('1,1'), false, 'Turned OFF');
  assert.equal(won(levelLamp, s), false, 'Level NOT won because lamp was turned off');
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, levelLamp, s), false);
  assert.equal(valueOf({ kind: 'remaining' }, levelLamp, s, {}), 1);

  // 3rd light -> ON again
  s = step(levelLamp, s, 'light');
  assert.equal(s.lit.includes('1,1'), true, 'Turned ON again');
  assert.equal(won(levelLamp, s), true, 'Level won again');
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, levelLamp, s), true);
  assert.equal(valueOf({ kind: 'remaining' }, levelLamp, s, {}), 0);
}

console.log('--- 2. Dark theme house toggle ---');
{
  let s = initialState(levelHouse, 'dark');
  assert.equal(s.lit.includes('1,1'), false);
  assert.equal(won(levelHouse, s), false);

  // 1st light -> ON
  s = step(levelHouse, s, 'light');
  assert.equal(s.lit.includes('1,1'), true);
  assert.equal(won(levelHouse, s), true);

  // 2nd light -> OFF
  s = step(levelHouse, s, 'light');
  assert.equal(s.lit.includes('1,1'), false);
  assert.equal(won(levelHouse, s), false);

  // 3rd light -> ON
  s = step(levelHouse, s, 'light');
  assert.equal(s.lit.includes('1,1'), true);
  assert.equal(won(levelHouse, s), true);
}

console.log('--- 3. Light theme (day) lamp toggle ---');
{
  let s = initialState(levelLamp, 'light');
  assert.equal(s.lit.includes('1,1'), true, 'Initially lit in day mode');
  assert.equal(won(levelLamp, s), false);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, levelLamp, s), true);
  assert.equal(valueOf({ kind: 'remaining' }, levelLamp, s, {}), 1);

  // 1st light -> OFF (extinguished)
  s = step(levelLamp, s, 'light');
  assert.equal(s.lit.includes('1,1'), false, 'Turned OFF');
  assert.equal(won(levelLamp, s), true, 'Level won because daylight lamp extinguished');
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, levelLamp, s), false);
  assert.equal(valueOf({ kind: 'remaining' }, levelLamp, s, {}), 0);

  // 2nd light -> ON (lit back up)
  s = step(levelLamp, s, 'light');
  assert.equal(s.lit.includes('1,1'), true, 'Turned back ON');
  assert.equal(won(levelLamp, s), false, 'Level NOT won because lamp was turned back on');
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, levelLamp, s), true);
  assert.equal(valueOf({ kind: 'remaining' }, levelLamp, s, {}), 1);

  // 3rd light -> OFF again
  s = step(levelLamp, s, 'light');
  assert.equal(s.lit.includes('1,1'), false, 'Turned OFF again');
  assert.equal(won(levelLamp, s), true, 'Level won again');
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit' }, levelLamp, s), false);
  assert.equal(valueOf({ kind: 'remaining' }, levelLamp, s, {}), 0);
}

console.log('--- 4. Light theme (day) house toggle ---');
{
  let s = initialState(levelHouse, 'light');
  assert.equal(s.lit.includes('1,1'), true, 'Initially lit');
  assert.equal(won(levelHouse, s), false);

  // 1st light -> OFF
  s = step(levelHouse, s, 'light');
  assert.equal(s.lit.includes('1,1'), false);
  assert.equal(won(levelHouse, s), true);

  // 2nd light -> ON
  s = step(levelHouse, s, 'light');
  assert.equal(s.lit.includes('1,1'), true);
  assert.equal(won(levelHouse, s), false);

  // 3rd light -> OFF
  s = step(levelHouse, s, 'light');
  assert.equal(s.lit.includes('1,1'), false);
  assert.equal(won(levelHouse, s), true);
}

console.log('--- 5. Non-lamp cell throws error ---');
{
  const nonLampLevel = {
    ...levelLamp,
    start: { x: 0, z: 0, dir: 0 }
  };
  let s = initialState(nonLampLevel, 'dark');
  assert.throws(() => step(nonLampLevel, s, 'light'), /Тут немає ліхтаря/);
}

console.log('--- 6. executeProgram end-to-end toggle ---');
{
  import('../logic.mjs').then(({executeProgram, createMemory}) => {
    let state = initialState(levelLamp, 'dark');
    const program = [
      { id: '1', type: 'light' },
      { id: '2', type: 'light' },
      { id: '3', type: 'light' }
    ];
    const memory = createMemory([]);
    const execution = executeProgram(levelLamp, program, [], () => state, memory);
    
    // Step 1: light ON
    let b = execution.next().value;
    state = step(levelLamp, state, b.type);
    assert.equal(state.lit.includes('1,1'), true);

    // Step 2: light OFF
    b = execution.next().value;
    state = step(levelLamp, state, b.type);
    assert.equal(state.lit.includes('1,1'), false);

    // Step 3: light ON
    b = execution.next().value;
    state = step(levelLamp, state, b.type);
    assert.equal(state.lit.includes('1,1'), true);

    console.log('Program execution toggle passed!');
  });
}

console.log('All toggle tests passed successfully!');

