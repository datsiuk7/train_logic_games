import assert from 'node:assert';
import { ProgramEditor } from '../program.js';

// Setup mock DOM environment for ProgramEditor
globalThis.document = {
  createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      classList: {
        add(c) { el.classList._set.add(c); },
        remove(c) { el.classList._set.delete(c); },
        toggle(c, v) { if (v ?? !el.classList._set.has(c)) el.classList._set.add(c); else el.classList._set.delete(c); },
        contains(c) { return el.classList._set.has(c); },
        _set: new Set()
      },
      style: {},
      children: [],
      append(...items) {
        for (const it of items) {
          if (it) {
            el.children.push(it);
            it.parentElement = el;
          }
        }
      },
      after(sibling) {
        if (el.parentElement) {
          const idx = el.parentElement.children.indexOf(el);
          el.parentElement.children.splice(idx + 1, 0, sibling);
          sibling.parentElement = el.parentElement;
        }
      },
      replaceChildren(...items) {
        el.children = items.filter(Boolean);
        items.forEach(it => { if (it) it.parentElement = el; });
      },
      querySelector() { return null; },
      remove() {
        if (el.parentElement) {
          const idx = el.parentElement.children.indexOf(el);
          if (idx >= 0) el.parentElement.children.splice(idx, 1);
        }
      },
      querySelectorAll() { return []; },
      setAttribute(k, v) { el[k] = v; },
      getAttribute(k) { return el[k]; },
      removeAttribute(k) { delete el[k]; },
      getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; },
      addEventListener() {},
      removeEventListener() {},
      dataset: {}
    };
    if (tag === 'select') {
      el.options = [];
      el.add = (opt) => el.options.push(opt);
    }
    return el;
  },
  body: {
    append() {}
  }
};

globalThis.Option = class Option {
  constructor(text, value) {
    this.text = text;
    this.value = value;
  }
};

globalThis.window = {
  matchMedia: () => ({ matches: false })
};

const mockLevel = {
  id: 'test-street',
  name: 'Тестова вулиця',
  width: 4,
  depth: 4,
  allowed: ['forward', 'left', 'right', 'jump', 'light', 'loop', 'call', 'list']
};

const container = document.createElement('div');
const host = document.createElement('div');
const palette = document.createElement('div');
const count = document.createElement('div');
const trash = document.createElement('button');
container.append(host, palette, count, trash);

console.log('--- 1. Testing ProgramEditor initialization and adding blocks ---');
const editor1 = new ProgramEditor(palette, host, count, mockLevel, trash, 'dark');
editor1.insert('forward');
editor1.insert('light');
editor1.insert('loop');
editor1.insert('jump');

const prog1 = editor1.getProgram();
assert.equal(prog1.blocks.length, 4);
assert.equal(prog1.blocks[0].type, 'forward');
assert.equal(prog1.blocks[1].type, 'light');
assert.equal(prog1.blocks[2].type, 'loop');
assert.equal(prog1.blocks[3].type, 'jump');
console.log('Program composed: 4 blocks');

console.log('--- 2. Simulating day/night toggle: re-creating editor in light theme with initialProgram ---');
// In app.js:
// const saved = loadSavedProgram(l.id, preview);
// const editor = new ProgramEditor(..., 'light', saved);
const editor2 = new ProgramEditor(palette, host, count, mockLevel, trash, 'light', prog1);
const prog2 = editor2.getProgram();

assert.equal(prog2.blocks.length, 4, 'All 4 blocks must be preserved in light theme!');
assert.equal(prog2.blocks[0].type, 'forward');
assert.equal(prog2.blocks[1].type, 'light');
assert.equal(prog2.blocks[2].type, 'loop');
assert.equal(prog2.blocks[3].type, 'jump');
console.log('Blocks successfully preserved across theme toggle!');

console.log('--- 3. Testing onChange notification and updates ---');
let notifiedData = null;
editor2.onChange = (data) => {
  notifiedData = data;
};

editor2.insert('right');
assert.ok(notifiedData, 'onChange must be called when a new block is inserted');
assert.equal(notifiedData.blocks.length, 5);
assert.equal(notifiedData.blocks[4].type, 'right');

console.log('--- 4. Testing clear ---');
editor2.clear();
assert.equal(editor2.blocks.length, 0);
assert.equal(notifiedData.blocks.length, 0);

console.log('--- 5. Testing toggle back to dark theme with new program ---');
editor2.insert('jump');
editor2.insert('light');
const savedBeforeToggle = editor2.getProgram();

const editor3 = new ProgramEditor(palette, host, count, mockLevel, trash, 'dark', savedBeforeToggle);
assert.equal(editor3.blocks.length, 2);
assert.equal(editor3.blocks[0].type, 'jump');
assert.equal(editor3.blocks[1].type, 'light');

console.log('All program persistence tests passed successfully!');
