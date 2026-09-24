import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshLevel } from '../admin/level-state.js';
import { validateLevel } from '../logic.mjs';
import { chooseHints, validateHints } from '../hint-data.mjs';
import { setupGameHints } from '../game-hints.js';
import { renderHintEditor } from '../admin/hint-editor.js';

test('only level hints are shown; invalid command targets are rejected', () => {
  const level = createFreshLevel();
  assert.deepEqual(chooseHints(level), []);

  level.hints = [{ text: 'Візьми команду «Вперед»', target: 'command:forward' }];
  assert.deepEqual(chooseHints(level), level.hints);
  assert.equal(validateHints(level.hints, level.allowed), null);
  level.allowed = ['light'];
  assert.match(validateHints(level.hints, level.allowed), /недоступну/);
  assert.match(validateLevel(level).join(' '), /недоступну команду/);
});

test('game help shows each step, highlights its target and can be reopened', () => {
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector)) {
      const classes = new Set();
      nodes.set(selector, {
        hidden: true,
        classList: {
          add: (name) => classes.add(name),
          remove: (name) => classes.delete(name),
          contains: (name) => classes.has(name)
        },
        scrollIntoView() {}
      });
    }
    return nodes.get(selector);
  };
  const container = { querySelector: node };
  const level = { id: 'help-test', allowed: ['forward'], hints: [
    { text: 'Обери команду', target: 'command:forward' },
    { text: 'Поклади її в програму', target: 'program' }
  ] };
  const previous = globalThis.sessionStorage;
  const values = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  try {
    const help = setupGameHints(container, level);
    assert.equal(node('#help-card').hidden, false);
    assert.equal(node('#help-text').textContent, 'Обери команду');
    assert.equal(node('#palette .command-forward').classList.contains('help-focus'), true);
    node('#help-next').onclick();
    assert.equal(node('#program').classList.contains('help-focus'), true);
    node('#help-next').onclick();
    assert.equal(node('#help-card').hidden, true);
    node('#help-open').onclick();
    assert.equal(node('#help-text').textContent, 'Обери команду');
    help.close();
    assert.equal(node('#palette .command-forward').classList.contains('help-focus'), false);
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous;
  }
});

test('a level without hints keeps help hidden even if old settings contain global hints', () => {
  const level = createFreshLevel();
  assert.deepEqual(chooseHints(level, {
    tutorialHints: [{ text: 'Стара загальна підказка', target: 'palette' }]
  }), []);
  const nodes = new Map();
  const container = { querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, { hidden: true });
    return nodes.get(selector);
  } };
  setupGameHints(container, level);
  assert.equal(nodes.get('#help-open').hidden, true);
  assert.equal(nodes.get('#help-card').hidden, true);
});

test('editing a hint then adding another keeps the edited text', () => {
  const previousDocument = globalThis.document;
  const previousOption = globalThis.Option;
  const element = () => ({
    children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren() { this.children = []; },
    add(option) { this.children.push(option); }
  });
  globalThis.document = { createElement: element };
  globalThis.Option = function Option(name, value) { return { name, value }; };
  try {
    const host = element();
    let saved = null;
    renderHintEditor(host, [{ text: 'Спочатку', target: 'palette' }], {
      onChange: (next) => { saved = next; }
    });
    const text = host.children[0].children[1];
    text.value = 'Оновлено';
    text.onchange();
    host.children.at(-1).onclick();
    assert.equal(saved.length, 2);
    assert.equal(saved[0].text, 'Оновлено');
    assert.equal(saved[1].text, '');
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousOption === undefined) delete globalThis.Option;
    else globalThis.Option = previousOption;
  }
});
