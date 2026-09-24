import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findNextLevel, getLevelSections } from '../home.js';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('next level follows the order shown on the home page and respects locks', async () => {
  const [ids, categories] = await Promise.all([
    readJson('../levels/index.json'), readJson('../levels/categories.json')
  ]);
  const levels = await Promise.all(ids.map((id) => readJson(`../levels/${id}.json`)));
  const sections = getLevelSections(levels, categories);
  const shown = sections.flatMap((section) => section.levels);
  const done = shown.map((level) => level.id);

  const lastInFirst = sections[0].levels.at(-1).id;
  assert.equal(findNextLevel(levels, categories, [], lastInFirst), null);
  assert.equal(findNextLevel(levels, categories, done, lastInFirst)?.id, sections[1]?.levels[0]?.id);

  for (let i = 0; i < shown.length; i++) {
    assert.equal(findNextLevel(levels, categories, done, shown[i].id)?.id, shown[i + 1]?.id);
  }

  const hidden = levels.find((level) => level.id === 'vpered-i-vpered');
  hidden.hidden = true;
  assert.equal(findNextLevel(levels, categories, done, 'poyikhaly')?.id, 'kutyk');
});
