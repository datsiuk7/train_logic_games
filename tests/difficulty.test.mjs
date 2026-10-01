import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DIFFICULTY_LEVELS,
  getDifficultyInfo,
  renderDifficultyStars,
  validateLevel
} from '../logic.mjs';

test('DIFFICULTY_LEVELS defines 5 tiers with escalating colors and Ukrainian labels', () => {
  assert.equal(DIFFICULTY_LEVELS.length, 5);
  assert.deepEqual(DIFFICULTY_LEVELS.map(d => d.level), [1, 2, 3, 4, 5]);

  // Tier 1 is green, tier 5 is red
  assert.equal(DIFFICULTY_LEVELS[0].color, '#22c55e');
  assert.equal(DIFFICULTY_LEVELS[0].label, 'Дуже легко');
  assert.equal(DIFFICULTY_LEVELS[4].color, '#ef4444');
  assert.equal(DIFFICULTY_LEVELS[4].label, 'Дуже складно');
});

test('getDifficultyInfo returns correct tier metadata and defaults properly', () => {
  assert.equal(getDifficultyInfo(undefined).level, 1);
  assert.equal(getDifficultyInfo(null).level, 1);
  assert.equal(getDifficultyInfo(0).level, 1);
  assert.equal(getDifficultyInfo(1).level, 1);
  assert.equal(getDifficultyInfo(3).level, 3);
  assert.equal(getDifficultyInfo(3).label, 'Середня');
  assert.equal(getDifficultyInfo(5).level, 5);
  assert.equal(getDifficultyInfo(6).level, 5); // Clamped
});

test('renderDifficultyStars produces 5 stars with correct tier colors and tooltip', () => {
  // Tier 1: 1 filled green star, 4 empty
  const html1 = renderDifficultyStars(1);
  assert.match(html1, /class="difficulty-stars diff-tier-1"/);
  assert.match(html1, /title="Складність: Дуже легко \(1\/5\)"/);
  assert.match(html1, /aria-label="Складність: Дуже легко \(1\/5\)"/);
  const filled1 = (html1.match(/class="diff-star filled"/g) || []).length;
  const empty1 = (html1.match(/class="diff-star empty"/g) || []).length;
  assert.equal(filled1, 1);
  assert.equal(empty1, 4);
  assert.match(html1, /style="color:#22c55e"/);

  // Tier 5: 5 filled red stars, 0 empty
  const html5 = renderDifficultyStars(5);
  assert.match(html5, /class="difficulty-stars diff-tier-5"/);
  assert.match(html5, /title="Складність: Дуже складно \(5\/5\)"/);
  const filled5 = (html5.match(/class="diff-star filled"/g) || []).length;
  const empty5 = (html5.match(/class="diff-star empty"/g) || []).length;
  assert.equal(filled5, 5);
  assert.equal(empty5, 0);
  assert.match(html5, /style="color:#ef4444"/);
});

test('validateLevel validates difficulty range (optional 1..5)', () => {
  const baseLevel = {
    id: 'test-diff',
    name: 'Тестовий рівень',
    description: '',
    width: 2,
    depth: 2,
    cells: [
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: true }],
      [{ height: 0, tree: false, lamp: false }, { height: 0, tree: false, lamp: false }]
    ],
    start: { x: 0, z: 0, dir: 0 },
    allowed: ['forward', 'light'],
    limit: 0
  };

  // Valid difficulties 1..5
  for (let d = 1; d <= 5; d++) {
    const errors = validateLevel({ ...baseLevel, difficulty: d });
    assert.deepEqual(errors, []);
  }

  // Undefined difficulty is also valid (defaults to 1)
  assert.deepEqual(validateLevel(baseLevel), []);

  // Invalid difficulty out of bounds
  assert.ok(validateLevel({ ...baseLevel, difficulty: 0 }).includes('Складність: число від 1 до 5.'));
  assert.ok(validateLevel({ ...baseLevel, difficulty: 6 }).includes('Складність: число від 1 до 5.'));
  assert.ok(validateLevel({ ...baseLevel, difficulty: 'easy' }).includes('Складність: число від 1 до 5.'));
});

test('admin editor index.html has 5-star clickable difficulty picker placed above limit and commands', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="difficulty-picker" class="difficulty-picker"/);
  assert.match(html, /<button type="button" class="diff-star-btn" data-value="1"/);
  assert.match(html, /<button type="button" class="diff-star-btn" data-value="5"/);
  assert.match(html, /<input type="hidden" id="difficulty" value="1">/);

  const diffPos = html.indexOf('id="difficulty-picker"');
  const limitPos = html.indexOf('id="limit"');
  const commandsPos = html.indexOf('id="allowed"');

  assert.ok(diffPos > 0 && limitPos > 0 && commandsPos > 0);
  assert.ok(diffPos < limitPos, 'Difficulty picker must be above limit input');
  assert.ok(diffPos < commandsPos, 'Difficulty picker must be above allowed commands');
});

test('admin.js implements renderDifficultyPicker and binds clickable star buttons', async () => {
  const code = await readFile(new URL('../admin/admin.js', import.meta.url), 'utf8');
  assert.match(code, /renderDifficultyStars/);
  assert.match(code, /getDifficultyInfo/);
  assert.match(code, /function renderDifficultyPicker/);
  assert.match(code, /diffPicker\.querySelectorAll\('\.diff-star-btn'\)/);
  assert.match(code, /renderLevelTree/);
});

test('runner.js and home.js render difficulty stars with hover tooltips', async () => {
  const runnerCode = await readFile(new URL('../runner.js', import.meta.url), 'utf8');
  assert.match(runnerCode, /renderDifficultyStars/);
  assert.match(runnerCode, /class="game-level-name"/);

  const homeCode = await readFile(new URL('../home.js', import.meta.url), 'utf8');
  assert.match(homeCode, /renderDifficultyStars/);
});
