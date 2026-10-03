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
test('if block header contains condition editor and icon without text label', () => {
  globalThis.Option = class Option {
    constructor(text, value) {
      this.text = text;
      this.value = value;
    }
  };

  const elements = [];
  const mkEl = () => {
    const children = [];
    const el = {
      children,
      dataset: {},
      append: (...items) => children.push(...items),
      add: (item) => children.push(item),
      after: () => {},
      replaceChildren: () => { children.length = 0; },
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
    elements.push(el);
    return el;
  };

  globalThis.document = { createElement: mkEl, createTextNode: (t) => t };

  const host = mkEl();
  const palette = mkEl();
  const count = mkEl();
  const trash = mkEl();

  const level = { limit: 0, allowed: ['if'], allowedSensors: ['lampLit'] };
  const editor = new ProgramEditor(palette, host, count, level, trash);
  editor.insert('if');

  const labelFound = elements.some((e) => e.className === 'command-label' && e.textContent?.includes('Якщо'));
  assert.equal(labelFound, false, 'No command-label for if block');

  const condEditor = elements.some((e) => e.className === 'condition-editor');
  assert.equal(condEditor, true, 'Condition editor is created');
});
