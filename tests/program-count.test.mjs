import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgramEditor } from '../program.js';

test('block count format displays Залишилося X/Y for levels with limit, and Блоків: X without limit', () => {
  const mkEl = () => {
    const el = {
      dataset: {},
      append: () => {},
      after: () => {},
      replaceChildren: () => {},
      setAttribute: () => {},
      addEventListener: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      classList: { toggle: () => {}, add: () => {}, remove: () => {} },
      parentElement: null
    };
    el.parentElement = {
      classList: { toggle: () => {} },
      querySelectorAll: () => []
    };
    return el;
  };

  const host = mkEl();
  const palette = mkEl();
  const count = mkEl();
  const trash = mkEl();

  globalThis.document = { createElement: mkEl };

  const levelWithLimit = { limit: 4, allowed: ['forward'] };
  const editor = new ProgramEditor(palette, host, count, levelWithLimit, trash);
  assert.equal(count.textContent, 'Залишилося 4/4');

  editor.insert('forward');
  assert.equal(count.textContent, 'Залишилося 3/4');

  editor.insert('forward');
  editor.insert('forward');
  editor.insert('forward');
  assert.equal(count.textContent, 'Залишилося 0/4');

  const levelNoLimit = { limit: 0, allowed: ['forward'] };
  const editor2 = new ProgramEditor(palette, host, count, levelNoLimit, trash);
  assert.equal(count.textContent, 'Блоків: 0');

  editor2.insert('forward');
  assert.equal(count.textContent, 'Блоків: 1');
});
