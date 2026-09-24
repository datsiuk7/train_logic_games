import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  step,
  won,
  conditionValue,
  sensors,
  commands,
  categories,
  validateLevel,
  ElectricShockError
} from '../logic.mjs';
import { setupEffects } from '../music.js';

test('strict 5 sensors definition', () => {
  const sensorKeys = Object.keys(sensors);
  assert.deepEqual(sensorKeys, [
    'lampShorts',
    'onLamp',
    'obstacleAhead',
    'lampLit',
    'canJump'
  ]);
  assert.equal(sensors.lampShorts, 'Ліхтар коротить');
  assert.equal(sensors.onLamp, 'Тут є ліхтар чи будинок');
  assert.equal(sensors.obstacleAhead, 'Попереду перешкода');
  assert.equal(sensors.lampLit, 'Світло тут світить');
  assert.equal(sensors.canJump, 'Можна стрибнути');
});

test('lists and foreach are completely removed from commands and categories', () => {
  assert.equal(commands.list, undefined);
  assert.equal(commands.foreach, undefined);
  assert.ok(commands.take);
  assert.ok(commands.fix);
  for (const cat of categories) {
    assert.ok(!cat.allowedCommands?.includes('list'));
    assert.ok(!cat.allowedCommands?.includes('foreach'));
  }
});

test('collectible lightbulbs: pickup with take command and carry count', () => {
  const level = {
    id: 'bulb-test',
    name: 'Тест лампочок',
    description: 'Знайди лампочку',
    width: 3,
    depth: 3,
    start: { x: 0, z: 0, dir: 1 },
    allowed: ['forward', 'take'],
    limit: 0,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, bulb: true }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
    ]
  };

  let s = initialState(level);
  assert.deepEqual(s.bulbs, ['1,0']);
  assert.equal(s.carriedBulbs, 0);

  // Take when nothing is on tile (0,0) throws error
  assert.throws(() => step(level, s, 'take'), /Тут немає предмета/);

  // Move onto tile with bulb (1,0)
  s = step(level, s, 'forward');
  assert.equal(s.x, 1);
  assert.equal(s.z, 0);

  // Take bulb
  s = step(level, s, 'take');
  assert.equal(s.carriedBulbs, 1);
  assert.deepEqual(s.bulbs, []);

  // Cannot take again
  assert.throws(() => step(level, s, 'take'), /Тут немає предмета/);
});

test('sparking lantern requires repair kit and fix command before lighting', () => {
  const level = {
    id: 'spark-test',
    name: 'Тест іскріння',
    description: 'Полагоди ліхтар',
    width: 3,
    depth: 3,
    start: { x: 0, z: 1, dir: 1 },
    allowed: ['forward', 'left', 'right', 'jump', 'light', 'fix', 'take'],
    limit: 0,
    repairKits: 1,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true, spark: true, lit: false }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
    ]
  };

  let s = initialState(level);
  assert.equal(s.repairKits, 1);
  assert.deepEqual(s.sparks, ['1,1']);
  assert.equal(won(level, s), false);

  // Step onto sparking lamp
  s = step(level, s, 'forward');

  // Sensor checks on sparking lamp
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampShorts', not: false }, level, s, {}), true);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'onLamp', not: false }, level, s, {}), true);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit', not: false }, level, s, {}), false);

  // Only switching the sparking lamp shocks the character.
  assert.throws(() => step(level, s, 'light'), ElectricShockError);
  assert.equal(step(level, s, 'left').dir, 0);
  assert.equal(step(level, s, 'right').dir, 2);
  assert.equal(step(level, s, 'forward').x, 2);
  assert.equal(step(level, s, 'jump').x, 2);
  assert.doesNotThrow(() => step(level, { ...s, kits: ['1,1'] }, 'take'));
  assert.throws(() => step(level, { ...s, theme: 'light' }, 'light'), ElectricShockError);

  // Fix the lantern using repair kit
  s = step(level, s, 'fix');
  assert.equal(s.repairKits, 0);
  assert.deepEqual(s.sparks, []);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampShorts', not: false }, level, s, {}), false);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit', not: false }, level, s, {}), false);

  // Now lamp can be safely lit
  s = step(level, s, 'light');
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'lampLit', not: false }, level, s, {}), true);
  assert.ok(won(level, s));
});

test('collectible repair kit can be picked up with take and used with fix', () => {
  const level = {
    id: 'kit-test',
    name: 'Тест набору ремонту',
    description: 'Знайди ремкомплект і полагоди ліхтар',
    width: 3,
    depth: 3,
    start: { x: 0, z: 0, dir: 1 },
    allowed: ['forward', 'right', 'light', 'fix', 'take'],
    limit: 0,
    repairKits: 0,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, kit: true }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true, spark: true, lit: false }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
    ]
  };

  let s = initialState(level);
  assert.equal(s.repairKits, 0);
  assert.deepEqual(s.kits, ['1,0']);

  // Move to kit
  s = step(level, s, 'forward');
  s = step(level, s, 'take');
  assert.equal(s.repairKits, 1);
  assert.deepEqual(s.kits, []);

  // Turn and move to sparking lamp at (1,1)
  s = step(level, s, 'right');
  s = step(level, s, 'forward');

  // Fix and light
  s = step(level, s, 'fix');
  assert.equal(s.repairKits, 0);
  s = step(level, s, 'light');
  assert.ok(won(level, s));
});

test('validation supports spark, bulb, kit, and repairKits', () => {
  const validLevel = {
    id: 'val-test',
    name: 'Рівень перевірки',
    description: 'Опис рівня для перевірки валідації',
    width: 2,
    depth: 2,
    start: { x: 0, z: 0, dir: 0 },
    allowed: ['forward', 'light', 'take', 'fix'],
    limit: 0,
    repairKits: 2,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, bulb: true }],
      [{ height: 0, tree: false, lamp: false, kit: true }, { height: 0, tree: false, lamp: true, spark: true }]
    ]
  };
  const errors = validateLevel(validLevel);
  assert.deepEqual(errors, []);
});

test('lantern without bulb requires finding a bulb, inserting it and lighting', () => {
  const level = {
    id: 'needs-bulb-test',
    name: 'Ліхтар без лампочки',
    description: 'Встав лампочку',
    width: 3,
    depth: 3,
    start: { x: 0, z: 0, dir: 1 },
    allowed: ['forward', 'left', 'take', 'light'],
    limit: 0,
    cells: [
      [
        { height: 0, tree: false, lamp: false, bulb: true },
        { height: 0, tree: false, lamp: true, needsBulb: true, lit: false, spark: false },
        { height: 0, tree: false, lamp: false }
      ],
      [
        { height: 0, tree: false, lamp: false },
        { height: 0, tree: false, lamp: false },
        { height: 0, tree: false, lamp: false }
      ],
      [
        { height: 0, tree: false, lamp: false },
        { height: 0, tree: false, lamp: false },
        { height: 0, tree: false, lamp: false }
      ]
    ]
  };

  let s = initialState(level);
  assert.equal(won(level, s), false);
  assert.deepEqual(s.lit, []);
  assert.deepEqual(s.fittedLamps, []);

  // Moving directly to the lamp without taking bulb first
  s = step(level, s, 'forward');
  assert.equal(s.x, 1);
  assert.equal(s.z, 0);

  // Trying to light lamp without bulb throws error
  assert.throws(
    () => step(level, s, 'light'),
    /У цьому ліхтарі немає лампочки! Спочатку знайди та візьми лампочку\./
  );

  // Turn around, go back to (0,0), take bulb
  s = step(level, s, 'left');
  s = step(level, s, 'left');
  s = step(level, s, 'forward');
  s = step(level, s, 'take');
  assert.equal(s.carriedBulbs, 1);

  // Go to lamp (1,0)
  s = step(level, s, 'left');
  s = step(level, s, 'left');
  s = step(level, s, 'forward');

  // Now light the lamp with carried bulb
  s = step(level, s, 'light');
  assert.equal(s.carriedBulbs, 0);
  assert.deepEqual(s.fittedLamps, ['1,0']);
  assert.deepEqual(s.lit, ['1,0']);
  assert.equal(won(level, s), true);

  // Toggling light off and on again doesn't require another bulb
  s = step(level, s, 'light');
  assert.deepEqual(s.lit, []);
  s = step(level, s, 'light');
  assert.deepEqual(s.lit, ['1,0']);
});

test('validation supports needsBulb on lamps and rejects conflicts', () => {
  const base = {
    id: 'val-bulb-lamp',
    name: 'Тест',
    description: 'Опис',
    width: 2,
    depth: 2,
    start: { x: 0, z: 0, dir: 0 },
    allowed: ['forward', 'light', 'take'],
    limit: 0
  };

  // Valid level with needsBulb
  const valid = {
    ...base,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, bulb: true }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true, needsBulb: true, lit: false, spark: false }]
    ]
  };
  assert.deepEqual(validateLevel(valid), []);

  // Invalid: needsBulb on cell without lamp
  const invalidNoLamp = {
    ...base,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, bulb: true }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, needsBulb: true }]
    ]
  };
  assert.ok(validateLevel(invalidNoLamp).length > 0);

  // Invalid: needsBulb and lit
  const invalidLit = {
    ...base,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, bulb: true }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true, needsBulb: true, lit: true }]
    ]
  };
  assert.ok(validateLevel(invalidLit).length > 0);

  // Invalid: needsBulb and spark
  const invalidSpark = {
    ...base,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, bulb: true }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true, needsBulb: true, spark: true }]
    ]
  };
  assert.ok(validateLevel(invalidSpark).length > 0);
});

test('setupEffects provides procedural sound methods for every command', () => {
  const fx = setupEffects(null);
  const requiredSounds = [
    'step',
    'turn',
    'jump',
    'pickup',
    'repair',
    'call',
    'light',
    'unscrew',
    'spark',
    'shock',
    'fall',
    'win',
    'angry'
  ];
  for (const name of requiredSounds) {
    assert.equal(typeof fx[name], 'function', `Expected fx.${name} to be a function`);
  }
});

test('electric shock plays a distinct sequence of sound pulses', () => {
  const previousAudioContext = globalThis.AudioContext;
  let pulses = 0;
  globalThis.AudioContext = class {
    currentTime = 0;
    state = 'running';
    destination = {};
    createOscillator() {
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() { pulses++; },
        stop() {}
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}
      };
    }
  };
  try {
    setupEffects(null).shock();
    assert.ok(pulses >= 6);
  } finally {
    if (previousAudioContext === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = previousAudioContext;
  }
});
