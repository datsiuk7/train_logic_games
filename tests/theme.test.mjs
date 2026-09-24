import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, step, won, conditionValue, lampCount, getCommandInfo} from '../logic.mjs';

const testLevel = {
  id: 'test-lamp',
  name: 'Тест ліхтаря',
  width: 3,
  depth: 3,
  start: { x: 0, z: 1, dir: 1 },
  allowed: ['forward', 'light'],
  limit: 0,
  cells: [
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true }, { height: 0, tree: false, lamp: false }],
    [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
  ]
};

test('light theme initializes all lamps as lit and unscrewed as empty', () => {
  const l = testLevel;
  const s = initialState(l, 'light');
  assert.equal(s.theme, 'light');
  assert.equal(s.lit.length, lampCount(l));
  assert.equal(s.unscrewed.length, 0);
  assert.equal(won(l, s), false);
});

test('light theme step toggles lamp off and on', () => {
  const l = testLevel;
  let s = initialState(l, 'light');
  s = step(l, s, 'forward'); // on lamp (1, 1)

  // 1st light: turns OFF
  s = step(l, s, 'light');
  assert.equal(s.unscrewed.length, 1);
  assert.equal(s.lit.length, 0);
  assert.ok(won(l, s));

  // 2nd light: toggles back ON
  s = step(l, s, 'light');
  assert.equal(s.lit.length, 1);
  assert.equal(s.unscrewed.length, 0);
  assert.equal(won(l, s), false);

  // 3rd light: toggles back OFF
  s = step(l, s, 'light');
  assert.equal(s.lit.length, 0);
  assert.equal(s.unscrewed.length, 1);
  assert.ok(won(l, s));
});

test('dark vs light command labels and sensors', () => {
  assert.deepEqual(getCommandInfo('light', 'dark'), ['✦', 'Запалити ліхтар']);
  assert.deepEqual(getCommandInfo('light', 'light'), ['💡', 'Вимкнути світло']);

  const l = testLevel;
  let s = initialState(l, 'light');
  s = step(l, s, 'forward'); // on lamp tile (1, 1)
  // Sensor lampLit: true because lamp is still burning
  assert.equal(conditionValue({kind: 'sensor', sensor: 'lampLit', not: false}, l, s, {}), true);
  s = step(l, s, 'light'); // unscrewed/extinguished
  assert.equal(conditionValue({kind: 'sensor', sensor: 'lampLit', not: false}, l, s, {}), false);
  assert.equal(conditionValue({kind: 'sensor', sensor: 'onLamp', not: false}, l, s, {}), true);
});
