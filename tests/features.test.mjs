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

test('bush and rock act as obstacles and block forward and jump', () => {
  const level = {
    id: 'nature-obstacles',
    name: 'Тест природи',
    description: 'Перешкоди кущ і камінь',
    width: 3,
    depth: 3,
    start: { x: 0, z: 0, dir: 1 },
    allowed: ['forward', 'jump', 'right', 'left'],
    limit: 0,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, bush: true }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false, rock: true }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
    ]
  };

  const s = initialState(level);
  // Facing east towards (1, 0) which is a bush
  assert.throws(() => step(level, s, 'forward'), /Кущ перекриває шлях/);
  assert.throws(() => step(level, s, 'jump'), /Кущ перекриває шлях/);

  // Turn south towards (0, 1) which is a rock
  const sSouth = step(level, s, 'right');
  assert.throws(() => step(level, sSouth, 'forward'), /Камінь перекриває шлях/);
  assert.throws(() => step(level, sSouth, 'jump'), /Камінь перекриває шлях/);

  // obstacleAhead sensor detects both bush and rock
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'obstacleAhead' }, level, s), true);
  assert.equal(conditionValue({ kind: 'sensor', sensor: 'obstacleAhead' }, level, sSouth), true);
});

test('box mechanics: pushing forward and jumping on/off box', () => {
  const level = {
    id: 'box-test',
    name: 'Тест ящика',
    description: 'Штовхання та стрибки на ящик',
    width: 4,
    depth: 3,
    start: { x: 0, z: 0, dir: 1 },
    allowed: ['forward', 'jump', 'right', 'left'],
    limit: 0,
    cells: [
      [
        { height: 0, tree: false, lamp: false },
        { height: 0, tree: false, lamp: false, box: true },
        { height: 0, tree: false, lamp: false },
        { height: 1, tree: false, lamp: false }
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
      ]
    ]
  };

  const s0 = initialState(level);
  assert.deepEqual(s0.boxes, ['1,0']);
  assert.equal(s0.onBox, false);

  // 1. Pushing box forward from (1,0) to (2,0)
  // Character steps into (1,0), box moves to (2,0)
  const sPushed = step(level, s0, 'forward');
  assert.equal(sPushed.x, 1);
  assert.equal(sPushed.z, 0);
  assert.equal(sPushed.onBox, false);
  assert.deepEqual(sPushed.boxes, ['2,0']);
  assert.deepEqual(sPushed.pushedBox, { from: { x: 1, z: 0 }, to: { x: 2, z: 0 } });

  // 2. Cannot push box to tile of different height (height 1 at (3,0) vs height 0 at (2,0))
  assert.throws(() => step(level, sPushed, 'forward'), /Коробку можна посунути лише на плитку такої ж висоти/);

  // 3. Jump ONTO box at (2, 0)
  // Character is at height 0, box is at height 0 (top of box is height 1). Diff is 1. Jump succeeds!
  const sOnBox = step(level, sPushed, 'jump');
  assert.equal(sOnBox.x, 2);
  assert.equal(sOnBox.z, 0);
  assert.equal(sOnBox.onBox, true);

  // 4. Character on box walks forward to (3,0) of height 1
  // Effective character height is 0 + 1 = 1. Target (3,0) height is 1. Same height -> forward succeeds!
  const sWalkOff = step(level, sOnBox, 'forward');
  assert.equal(sWalkOff.x, 3);
  assert.equal(sWalkOff.z, 0);
  assert.equal(sWalkOff.onBox, false);

  // 5. Jump back onto box from height 1 to box top (height 1)
  const sFacingWest = step(level, step(level, sWalkOff, 'left'), 'left');
  // At height 1 facing west towards box at (2,0). Box height is 0, top is 1. Diff is 0 <= 1 -> jump lands on box!
  const sBackOnBox = step(level, sFacingWest, 'jump');
  assert.equal(sBackOnBox.x, 2);
  assert.equal(sBackOnBox.z, 0);
  assert.equal(sBackOnBox.onBox, true);

  // 6. Jump off box to height 0 at (1,0)
  const sJumpOff = step(level, sBackOnBox, 'jump');
  assert.equal(sJumpOff.x, 1);
  assert.equal(sJumpOff.z, 0);
  assert.equal(sJumpOff.onBox, false);
});

test('validation supports bush, rock, box and enforces mutual exclusivity', () => {
  const validLevel = {
    id: 'valid-objects',
    name: 'Обʼєкти',
    description: 'Валідні обʼєкти',
    width: 3,
    depth: 3,
    start: { x: 0, z: 0, dir: 0 },
    allowed: ['forward', 'jump', 'light'],
    limit: 0,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false, bush: true }, { height: 0, tree: false, lamp: false, rock: true }],
      [{ height: 0, tree: false, lamp: false, box: true }, { height: 0, tree: false, lamp: true }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
    ]
  };
  assert.deepEqual(validateLevel(validLevel), []);

  // Reject conflict: box and bush on same cell
  const conflict = {
    ...validLevel,
    cells: [
      [{ height: 0, tree: false, lamp: false, box: true, bush: true }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
    ]
  };
  assert.ok(validateLevel(conflict).length > 0);
});

test('validation and level configuration for allowedSensors, allowElif, allowElse', () => {
  const baseLevel = {
    id: 'test-sensors',
    name: 'Тест умов',
    description: '',
    width: 3,
    depth: 3,
    start: { x: 0, z: 0, dir: 0 },
    allowed: ['forward', 'light', 'if'],
    limit: 0,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
    ]
  };

  // Valid configurations
  assert.deepEqual(validateLevel({ ...baseLevel, allowedSensors: ['lampLit'], allowElif: false, allowElse: false }), []);
  assert.deepEqual(validateLevel({ ...baseLevel, allowedSensors: ['lampLit', 'obstacleAhead'], allowElif: true, allowElse: true }), []);

  // Reject invalid sensor key
  assert.ok(validateLevel({ ...baseLevel, allowedSensors: ['invalidSensor'] }).length > 0);

  // Reject duplicates
  assert.ok(validateLevel({ ...baseLevel, allowedSensors: ['lampLit', 'lampLit'] }).length > 0);

  // Reject empty sensors when if is allowed
  assert.ok(validateLevel({ ...baseLevel, allowedSensors: [] }).length > 0);

  // Reject non-boolean allowElif/allowElse
  assert.ok(validateLevel({ ...baseLevel, allowElif: 'no' }).length > 0);
  assert.ok(validateLevel({ ...baseLevel, allowElse: 123 }).length > 0);
});

test('site zoom control is located in header next to theme in index.html, handled in app.js and home.css', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const appJs = fs.readFileSync(path.resolve('app.js'), 'utf8');
  const homeCss = fs.readFileSync(path.resolve('home.css'), 'utf8');
  const runnerJs = fs.readFileSync(path.resolve('runner.js'), 'utf8');

  // Verify site-zoom-control in index.html header next to #theme
  assert.ok(indexHtml.includes('id="site-zoom-control"'), 'index.html must contain #site-zoom-control');
  const themePos = indexHtml.indexOf('id="theme"');
  const zoomPos = indexHtml.indexOf('id="site-zoom-control"');
  assert.ok(themePos !== -1 && zoomPos !== -1 && zoomPos > themePos, '#site-zoom-control must be placed right after #theme in header');

  // Verify buttons and elements inside header zoom
  assert.ok(indexHtml.includes('id="site-zoom-out"'), 'index.html must contain #site-zoom-out');
  assert.ok(indexHtml.includes('id="site-zoom-in"'), 'index.html must contain #site-zoom-in');
  assert.ok(indexHtml.includes('id="site-zoom-val"'), 'index.html must contain #site-zoom-val');
  assert.ok(indexHtml.includes('id="site-zoom-reset"'), 'index.html must contain #site-zoom-reset');

  // Verify app.js wires setupSiteZoom
  assert.match(appJs, /setupSiteZoom/);
  assert.match(appJs, /document\.body\.style\.zoom/);
  assert.match(appJs, /lamplighter-site-zoom/);

  // Verify runner.js does NOT duplicate the site-zoom-control
  assert.ok(!runnerJs.includes('class="site-zoom-control"'), 'runner.js must not duplicate site-zoom-control');

  // Verify CSS styles
  assert.ok(homeCss.includes('.header-zoom-control'), 'home.css must style .header-zoom-control');
  assert.ok(homeCss.includes('.site-zoom-btn'), 'home.css must style .site-zoom-btn');
  assert.ok(homeCss.includes('.site-zoom-val'), 'home.css must style .site-zoom-val');
});

test('trash button uses custom in-game confirmation instead of native alert/confirm', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const runnerJs = fs.readFileSync(path.resolve('runner.js'), 'utf8');
  const gameCss = fs.readFileSync(path.resolve('game.css'), 'utf8');

  // Must not use window.confirm or alert for trash
  assert.ok(!runnerJs.includes('confirm('), 'runner.js must not use window.confirm');
  assert.ok(!runnerJs.includes('alert('), 'runner.js must not use window.alert');

  // Must contain custom in-game confirmation markup
  assert.ok(runnerJs.includes('id="trash-confirm"'), 'runner.js must contain #trash-confirm');
  assert.ok(runnerJs.includes('id="trash-confirm-yes"'), 'runner.js must contain #trash-confirm-yes');
  assert.ok(runnerJs.includes('id="trash-confirm-no"'), 'runner.js must contain #trash-confirm-no');

  // Verify styles in game.css
  assert.ok(gameCss.includes('.trash-confirm'), 'game.css must style .trash-confirm');
  assert.ok(gameCss.includes('.btn-trash-yes'), 'game.css must style .btn-trash-yes');
  assert.ok(gameCss.includes('.btn-trash-no'), 'game.css must style .btn-trash-no');
  assert.ok(gameCss.includes('.trash-confirm[hidden]'), 'game.css must support hidden trash-confirm');
});

test('palette command buttons have centered icons without rightward offset', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const blocksCss = fs.readFileSync(path.resolve('blocks.css'), 'utf8');
  const gameCss = fs.readFileSync(path.resolve('game.css'), 'utf8');

  // Verify command icon styling in blocks.css and game.css
  assert.match(blocksCss, /\.program-panel\s+\.command\s+\.icon\s*\{[^}]*width:\s*26px/);
  assert.match(blocksCss, /\.program-panel\s+\.command\s+\.icon\s*\{[^}]*display:\s*flex/);
  assert.match(blocksCss, /\.program-panel\s+\.command\s+\.icon\s*\{[^}]*justify-content:\s*center/);

  assert.match(gameCss, /\.program-panel\s+\.command\s+\.icon\s*\{[^}]*width:\s*26px/);
  assert.match(gameCss, /\.program-panel\s+\.command\s+\.icon\s*\{[^}]*display:\s*flex/);
  assert.match(gameCss, /\.program-panel\s+\.command\s+\.icon\s*\{[^}]*justify-content:\s*center/);
});

test('scripts and stylesheets in index.html and admin pages have version query parameter (?v0.1)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const files = [
    'index.html',
    'admin/index.html',
    'admin/categories.html',
    'admin/levels.html',
    'admin/settings.html'
  ];

  for (const rel of files) {
    const html = fs.readFileSync(path.resolve(rel), 'utf8');

    // Extract all href and src from stylesheet link tags and script tags
    const linkMatches = [...html.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)];
    for (const match of linkMatches) {
      const href = match[1];
      assert.ok(href.includes('?v0.1'), `${rel} stylesheet "${href}" must include version query ?v0.1`);
    }

    const scriptMatches = [...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi)];
    for (const match of scriptMatches) {
      const src = match[1];
      assert.ok(src.includes('?v0.1'), `${rel} script "${src}" must include version query ?v0.1`);
    }
  }
});



