import test from 'node:test';
import assert from 'node:assert/strict';
import { LevelHistory, createFreshLevel } from '../admin/level-state.js';
import { resizeLevel, setupSizeMatrix } from '../admin/map-resize.js';
import { paintCell, formatCellInfo } from '../admin/map-paint.js';
import { enableLevelTreeDnd, isLevelTreeDragging } from '../admin/level-tree-dnd.js';
import { reorderLevelsOnServer } from '../admin/level-storage.js';

test('LevelHistory provides true Undo and Redo with checkpoints', () => {
  const history = new LevelHistory(10);
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);

  const state1 = { name: 'Initial', width: 4, depth: 4, cells: [] };
  const state2 = { name: 'Edited 1', width: 4, depth: 4, cells: [] };
  const state3 = { name: 'Edited 2', width: 4, depth: 4, cells: [] };

  history.checkpoint(state1);
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, false);

  history.checkpoint(state2);
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, false);

  // Undo from state3 to state2
  const undoneTo2 = history.undo(state3);
  assert.deepEqual(undoneTo2, state2);
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, true);

  // Undo from state2 to state1
  const undoneTo1 = history.undo(undoneTo2);
  assert.deepEqual(undoneTo1, state1);
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, true);

  // Redo from state1 back to state2
  const redoneTo2 = history.redo(undoneTo1);
  assert.deepEqual(redoneTo2, state2);
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, true);

  // Redo from state2 back to state3
  const redoneTo3 = history.redo(redoneTo2);
  assert.deepEqual(redoneTo3, state3);
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, false);

  // Checkpoint clears future (redo stack)
  history.undo(state3);
  assert.equal(history.canRedo, true);
  history.checkpoint({ name: 'Branched' });
  assert.equal(history.canRedo, false);
});

test('resizeLevel expands, shrinks, and relocates start safely', () => {
  const level = createFreshLevel();
  let statusMsg = '';
  const onStatus = (msg) => { statusMsg = msg; };

  // Expand to 6x6
  const resExpand = resizeLevel(level, 6, 6, onStatus);
  assert.equal(resExpand.success, true);
  assert.equal(resExpand.changed, true);
  assert.equal(level.width, 6);
  assert.equal(level.depth, 6);
  assert.equal(level.cells.length, 6);
  assert.equal(level.cells[0].length, 6);

  // Place a lamp at (5, 5)
  level.cells[5][5].lamp = true;
  // Shrinking to 4x4 when object is at (5,5) should fail or shift
  // In our smart resize, object bounding box is (5,5), span is 1x1, which fits 4x4, so it shifts by 2!
  const resShrink = resizeLevel(level, 4, 4, onStatus);
  assert.equal(resShrink.success, true);
  assert.equal(resShrink.changed, true);
  assert.equal(level.width, 4);
  assert.equal(level.depth, 4);
  assert.equal(level.cells[3][3].lamp, true); // shifted from (5,5) to (3,3)
});

test('size matrix highlights the same number of tiles as the level dimensions', () => {
  const previousDocument = globalThis.document;
  const level = { width: 4, depth: 4 };
  const cells = [];
  const handlers = {};
  let hit = null;
  const matrix = {
    replaceChildren() { cells.length = 0; },
    append(cell) { cells.push(cell); },
    querySelectorAll() { return cells; },
    addEventListener(name, handler) { handlers[name] = handler; },
    contains(cell) { return cells.includes(cell); }
  };
  globalThis.document = {
    createElement() {
      const classes = new Set();
      return {
        dataset: {},
        classList: {
          add: (name) => classes.add(name),
          toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
          contains: (name) => classes.has(name)
        },
        setAttribute() {},
        closest() { return this; }
      };
    },
    elementFromPoint() { return hit; }
  };

  try {
    const badge = { textContent: '' };
    let selected = null;
    setupSizeMatrix({
      matrixEl: matrix,
      previewBadgeEl: badge,
      getLevel: () => level,
      onResize: (w, d) => { selected = [w, d]; }
    }).render();
    assert.equal(cells.length, 100);
    assert.equal(badge.textContent, '4 × 4');
    assert.equal(cells.filter((cell) => cell.classList.contains('selected')).length, 16);

    hit = cells.find((cell) => cell.dataset.w === 5 && cell.dataset.d === 5);
    handlers.click({ clientX: 0, clientY: 0 });
    assert.deepEqual(selected, [5, 5]);

    selected = null;
    hit = cells.find((cell) => cell.dataset.w === 1 && cell.dataset.d === 1);
    handlers.click({ clientX: 0, clientY: 0 });
    assert.equal(selected, null);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('paintCell handles terrain, lamp, house, and start placement', () => {
  const level = createFreshLevel();
  let checkpoints = 0;
  let dirties = 0;
  let strokeActive = false;

  const ctx = {
    level,
    tool: 'terrain',
    height: 2,
    lampLitState: false,
    houseDir: 2,
    onStatus: () => {},
    onCheckpoint: () => { checkpoints++; },
    onDirty: () => { dirties++; },
    onRefreshCell: () => {},
    isStrokeActive: () => strokeActive,
    markStrokeActive: () => { strokeActive = true; }
  };

  // 1. Paint terrain height 2 at (1, 1)
  paintCell({ ...ctx, x: 1, z: 1 });
  assert.equal(level.cells[1][1].height, 2);
  assert.equal(checkpoints, 1);
  assert.equal(dirties, 1);

  // 2. Place lamp (lampLitState = false)
  paintCell({
    ...ctx,
    x: 1,
    z: 1,
    tool: 'lamp',
    isStrokeActive: () => false,
    markStrokeActive: () => {}
  });
  assert.equal(level.cells[1][1].lamp, true);
  assert.equal(level.cells[1][1].lit, false);

  // 3. Toggle lamp by painting over existing lamp
  let toggledLampLit = null;
  paintCell({
    ...ctx,
    x: 1,
    z: 1,
    tool: 'lamp',
    setLampLitState: (v) => { toggledLampLit = v; },
    isStrokeActive: () => false,
    markStrokeActive: () => {}
  });
  assert.equal(toggledLampLit, true);
  assert.equal(level.cells[1][1].lit, true);

  // 4. Place house with direction
  paintCell({
    ...ctx,
    x: 2,
    z: 2,
    tool: 'house',
    houseDir: 1,
    isStrokeActive: () => false,
    markStrokeActive: () => {}
  });
  assert.equal(level.cells[2][2].house, true);
  assert.equal(level.cells[2][2].dir, 1);

  // 5. Test formatCellInfo
  const infoLamp = formatCellInfo(level, 1, 1);
  assert.match(infoLamp, /ліхтар/);
  const infoHouse = formatCellInfo(level, 2, 2);
  assert.match(infoHouse, /будиночок/);
});

test('paintCell supports placing lantern without bulb (no-bulb state) and cycling states', () => {
  const level = createFreshLevel();
  let currentState = 'no-bulb';

  const ctx = {
    level,
    tool: 'lamp',
    height: 0,
    lampState: 'no-bulb',
    setLampState: (v) => { currentState = v; },
    onStatus: () => {},
    onCheckpoint: () => {},
    onDirty: () => {},
    onRefreshCell: () => {},
    isStrokeActive: () => false,
    markStrokeActive: () => {}
  };

  // 1. Paint lamp with lampState: 'no-bulb' at (1, 1)
  paintCell({ ...ctx, x: 1, z: 1 });
  assert.equal(level.cells[1][1].lamp, true);
  assert.equal(level.cells[1][1].needsBulb, true);
  assert.equal(level.cells[1][1].lit, false);
  assert.equal(level.cells[1][1].spark, false);

  // 2. formatCellInfo indicates lantern is missing a bulb
  const info = formatCellInfo(level, 1, 1);
  assert.match(info, /без лампочки/);

  // 3. Cycling state on existing lamp: current is 'no-bulb', target is 'no-bulb' -> next in order is 'off'
  paintCell({ ...ctx, x: 1, z: 1, lampState: 'no-bulb' });
  assert.equal(currentState, 'off');
  assert.equal(level.cells[1][1].needsBulb, false);
  assert.equal(level.cells[1][1].lit, false);
  assert.equal(level.cells[1][1].spark, false);

  // 4. Click again -> next in order is 'on'
  paintCell({ ...ctx, x: 1, z: 1, lampState: 'off' });
  assert.equal(currentState, 'on');
  assert.equal(level.cells[1][1].lit, true);

  // 5. Click again -> next in order is 'spark'
  paintCell({ ...ctx, x: 1, z: 1, lampState: 'on' });
  assert.equal(currentState, 'spark');
  assert.equal(level.cells[1][1].spark, true);

  // 6. Click again -> next in order is 'no-bulb'
  paintCell({ ...ctx, x: 1, z: 1, lampState: 'spark' });
  assert.equal(currentState, 'no-bulb');
  assert.equal(level.cells[1][1].needsBulb, true);
});

test('enableLevelTreeDnd enables dragging and handles reordering DOM nodes', async () => {
  const makeItem = (id) => {
    const classes = new Set(['cat-level-item']);
    const attrs = {};
    const item = {
      dataset: { id },
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        toggle: (c, val) => (val ? classes.add(c) : classes.delete(c))
      },
      setAttribute: (k, v) => { attrs[k] = v; },
      getAttribute: (k) => attrs[k],
      getBoundingClientRect: () => ({ top: 100, height: 40 }),
      contains: () => false,
      nextSibling: null
    };
    return item;
  };

  const item1 = makeItem('level-1');
  const item2 = makeItem('level-2');
  const item3 = makeItem('level-3');
  const children = [item1, item2, item3];
  item1.nextSibling = item2;
  item2.nextSibling = item3;
  item3.nextSibling = null;

  const ul = {
    querySelectorAll: (sel) => {
      if (sel === '.cat-level-item') return [...children];
      return [];
    },
    querySelector: (sel) => {
      const match = sel.match(/data-id="([^"]+)"/);
      if (match) return children.find((c) => c.dataset.id === match[1]);
      return null;
    },
    insertBefore: (node, refNode) => {
      const curIdx = children.indexOf(node);
      if (curIdx !== -1) children.splice(curIdx, 1);
      if (!refNode) {
        children.push(node);
      } else {
        const refIdx = children.indexOf(refNode);
        children.splice(refIdx, 0, node);
      }
      for (let i = 0; i < children.length; i++) {
        children[i].nextSibling = children[i + 1] || null;
      }
    }
  };

  let reorderedCat = null;
  let reorderedIds = null;
  enableLevelTreeDnd({
    ul,
    categoryId: 'cat_move',
    onReorder: async (catId, newIds) => {
      reorderedCat = catId;
      reorderedIds = newIds;
    }
  });

  assert.equal(item1.getAttribute('draggable'), 'true');
  assert.equal(item2.getAttribute('draggable'), 'true');
  assert.equal(item3.getAttribute('draggable'), 'true');

  // Start dragging item1
  item1.ondragstart({ dataTransfer: { effectAllowed: '', setData() {} } });
  assert.equal(isLevelTreeDragging(), true);
  assert.equal(item1.classList.contains('is-dragging'), true);

  // Drag over item3 bottom half (clientY = 130 > top 100 + height 40/2 = 120)
  item3.ondragover({ clientY: 130, preventDefault() {}, dataTransfer: {} });
  assert.equal(item3.classList.contains('drag-over-bottom'), true);

  // Drop on item3
  await item3.ondrop({ preventDefault() {} });
  assert.equal(reorderedCat, 'cat_move');
  assert.deepEqual(reorderedIds, ['level-2', 'level-3', 'level-1']);

  // End drag
  item1.ondragend();
  assert.equal(item1.classList.contains('is-dragging'), false);
});

test('reorderLevelsOnServer sends reordered ids payload with X-Local-Editor header', async () => {
  const origFetch = globalThis.fetch;
  let fetchUrl = null;
  let fetchOptions = null;
  globalThis.fetch = async (url, opts) => {
    fetchUrl = url;
    fetchOptions = opts;
    return {
      ok: true,
      json: async () => ({ success: true })
    };
  };

  try {
    const res = await reorderLevelsOnServer(['lvl-a', 'lvl-b']);
    assert.deepEqual(res, { success: true });
    assert.equal(fetchUrl, '../api/levels/reorder');
    assert.equal(fetchOptions.method, 'POST');
    assert.equal(fetchOptions.headers['X-Local-Editor'], '1');
    assert.deepEqual(JSON.parse(fetchOptions.body), { ids: ['lvl-a', 'lvl-b'] });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('paintCell handles bush, rock, box placement and erase tool', () => {
  const level = createFreshLevel();
  let checkpoints = 0;
  let dirties = 0;

  const ctx = {
    level,
    height: 1,
    lampLitState: false,
    houseDir: 2,
    onStatus: () => {},
    onCheckpoint: () => { checkpoints++; },
    onDirty: () => { dirties++; },
    onRefreshCell: () => {},
    isStrokeActive: () => false,
    markStrokeActive: () => {}
  };

  // 1. Paint bush at (1, 1)
  paintCell({ ...ctx, x: 1, z: 1, tool: 'bush' });
  assert.equal(level.cells[1][1].bush, true);
  assert.equal(level.cells[1][1].tree, false);
  assert.match(formatCellInfo(level, 1, 1), /кущ/);

  // 2. Paint rock at (1, 1) (replaces bush)
  paintCell({ ...ctx, x: 1, z: 1, tool: 'rock' });
  assert.equal(level.cells[1][1].rock, true);
  assert.equal(level.cells[1][1].bush, false);
  assert.match(formatCellInfo(level, 1, 1), /камінь/);

  // 3. Paint box at (1, 1) (replaces rock)
  paintCell({ ...ctx, x: 1, z: 1, tool: 'box' });
  assert.equal(level.cells[1][1].box, true);
  assert.equal(level.cells[1][1].rock, false);
  assert.match(formatCellInfo(level, 1, 1), /коробка/);

  // 4. Erase at (1, 1) clears box
  paintCell({ ...ctx, x: 1, z: 1, tool: 'erase' });
  assert.equal(level.cells[1][1].box, false);
  assert.equal(level.cells[1][1].bush, false);
  assert.equal(level.cells[1][1].rock, false);
});

