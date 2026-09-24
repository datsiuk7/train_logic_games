import { commands, validateLevel, initialState, categories, getCategory } from '../logic.mjs';
import { World } from '../scene.js';
import { icon, tools, refreshCell } from './map-editor.js';
import { createFreshLevel, loadDraft, saveDraft, LevelHistory } from './level-state.js';
import {
  getExistingIds,
  makeUniqueId,
  fetchCategories,
  saveLevelToServer,
  deleteLevelOnServer,
  fetchStructureLevels,
  reorderLevelsOnServer,
  slugify
} from './level-storage.js';
import { resizeLevel, setupSizeMatrix } from './map-resize.js';
import { MapGridController } from './map-paint.js';
import { renderHintEditor } from './hint-editor.js';
import { enableLevelTreeDnd, isLevelTreeDragging } from './level-tree-dnd.js';

const $ = (s) => document.querySelector(s);

let level;
let dirty = false;
let local = false;
let tool = 'terrain';
let world = null;
let view = 'grid';
let savedId = null;
let dynamicCategories = [...categories];

const history = new LevelHistory(40);
let height = 0;
let zoom = 1;
let lampState = 'off';
let houseDir = 2;

function status(text, error = false) {
  $('#status').textContent = text;
  $('#status').className = 'status' + (error ? ' error' : '');
}

function updateHistoryButtons() {
  const undoBtn = $('#undo');
  const redoBtn = $('#redo');
  if (undoBtn) undoBtn.disabled = !history.canUndo;
  if (redoBtn) redoBtn.disabled = !history.canRedo;
}

function storeDraft() {
  saveDraft(level, dirty, savedId);
}

function change() {
  dirty = true;
  $('#dirty').textContent = 'Є незбережені зміни';
  updateHistoryButtons();
  storeDraft();
}

function checkpoint() {
  history.checkpoint(level);
  updateHistoryButtons();
}

function updateLampStateButtons() {
  $('#lamp-state-off')?.classList.toggle('selected', lampState === 'off');
  $('#lamp-state-off')?.setAttribute('aria-pressed', String(lampState === 'off'));
  $('#lamp-state-on')?.classList.toggle('selected', lampState === 'on');
  $('#lamp-state-on')?.setAttribute('aria-pressed', String(lampState === 'on'));
  $('#lamp-state-spark')?.classList.toggle('selected', lampState === 'spark');
  $('#lamp-state-spark')?.setAttribute('aria-pressed', String(lampState === 'spark'));
  $('#lamp-state-no-bulb')?.classList.toggle('selected', lampState === 'no-bulb');
  $('#lamp-state-no-bulb')?.setAttribute('aria-pressed', String(lampState === 'no-bulb'));
  const sparkBtn = $('#lamp-state-spark');
  if (sparkBtn) sparkBtn.hidden = tool === 'house';
  const noBulbBtn = $('#lamp-state-no-bulb');
  if (noBulbBtn) noBulbBtn.hidden = tool === 'house';
}

function updateHouseDirButtons() {
  $('#house-direction-buttons')?.querySelectorAll('.dir-btn').forEach((b) => {
    const selected = +b.dataset.dir === houseDir;
    b.classList.toggle('selected', selected);
    b.setAttribute('aria-pressed', String(selected));
  });
}

function brush() {
  $('#tools').querySelectorAll('button').forEach((b) => {
    const active = b.dataset.tool === tool;
    b.classList.toggle('selected', active);
    b.setAttribute('aria-pressed', String(active));
  });

  const isLightTool = tool === 'lamp' || tool === 'house';
  $('#lamp-tools').hidden = !isLightTool;
  $('#house-tools').hidden = tool !== 'house';

  if (isLightTool) {
    const label = $('#lamp-tools')?.querySelector('#light-tools-label') || $('#lamp-tools')?.querySelector('.field-label');
    if (label) label.textContent = tool === 'house' ? 'Світло в будинку (для ночі)' : 'Стан ліхтаря (для ночі)';
    if (tool === 'house' && (lampState === 'spark' || lampState === 'no-bulb')) {
      lampState = 'off';
    }
    updateLampStateButtons();
  }
  if (tool === 'house') {
    updateHouseDirButtons();
  }

  $('#brush-hint').textContent = tools[tool][1];
  $('#grid').dataset.brush = tool;
  $('#heights').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('selected', +b.dataset.height === height);
    b.setAttribute('aria-pressed', String(+b.dataset.height === height));
  });
}

function gridSize() {
  const grid = $('#grid');
  grid.style.setProperty('--cell-size', Math.round(64 * zoom) + 'px');
  grid.style.gridTemplateColumns = `repeat(${level.width},var(--cell-size))`;
  $('#zoom-value').textContent = Math.round(zoom * 100) + '%';
  $('#zoom-out').disabled = zoom <= 0.6;
  $('#zoom-in').disabled = zoom >= 1.6;
}

const gridController = new MapGridController({
  gridEl: $('#grid'),
  infoEl: $('#cell-info'),
  getLevel: () => level,
  getTool: () => tool,
  getHeight: () => height,
  getLampState: () => lampState,
  setLampState: (v) => {
    lampState = v;
    updateLampStateButtons();
  },
  getHouseDir: () => houseDir,
  setHouseDir: (v) => {
    houseDir = v;
    updateHouseDirButtons();
  },
  onStatus: status,
  onCheckpoint: checkpoint,
  onDirty: change,
  onStoreDraft: storeDraft
});

function draw() {
  world?.dispose();
  world = null;
  $('#map-workspace').hidden = view !== 'grid';
  $('#preview').hidden = view !== '3d';
  $('#view-grid').classList.toggle('selected', view === 'grid');
  $('#view-3d').classList.toggle('selected', view === '3d');
  updateHistoryButtons();

  if (view === '3d') {
    try {
      world = new World($('#preview'), level, initialState(level));
    } catch {
      status('Не вдалося показати 3D. Перевір старт і підтримку WebGL.', true);
    }
    return;
  }

  const grid = $('#grid');
  grid.replaceChildren();
  gridSize();

  for (let z = 0; z < level.depth; z++) {
    for (let x = 0; x < level.width; x++) {
      const b = document.createElement('button');
      b.dataset.x = x;
      b.dataset.z = z;
      refreshCell(level, b, x, z);
      b.onclick = (e) => {
        if (e.detail === 0) {
          gridController.paint(x, z);
          gridController.endStroke();
        }
      };
      grid.append(b);
    }
  }
  brush();
}

for (const [id, [label]] of Object.entries(tools)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = `${label}: ${tools[id][1]}`;
  b.innerHTML = icon(id) + `<span>${label}</span>`;
  b.dataset.tool = id;
  b.onclick = () => {
    tool = id;
    brush();
    if (view === '3d') {
      view = 'grid';
      draw();
    }
  };
  $('#tools').append(b);
}

for (let h = 0; h <= 5; h++) {
  const b = document.createElement('button');
  b.textContent = h;
  b.ariaLabel = 'Висота ' + h;
  b.dataset.height = h;
  b.style.setProperty('--swatch', `hsl(${205 - h * 5} 25% ${30 + h * 6}%)`);
  b.onclick = () => {
    height = h;
    brush();
  };
  $('#heights').append(b);
}

$('#lamp-state-off').onclick = () => {
  lampState = 'off';
  updateLampStateButtons();
};
$('#lamp-state-on').onclick = () => {
  lampState = 'on';
  updateLampStateButtons();
};
$('#lamp-state-spark').onclick = () => {
  lampState = 'spark';
  updateLampStateButtons();
};
$('#lamp-state-no-bulb').onclick = () => {
  lampState = 'no-bulb';
  updateLampStateButtons();
};

$('#zoom-out').onclick = () => {
  zoom = Math.max(0.6, Math.round((zoom - 0.2) * 10) / 10);
  gridSize();
};
$('#zoom-in').onclick = () => {
  zoom = Math.min(1.6, Math.round((zoom + 0.2) * 10) / 10);
  gridSize();
};

for (const id of ['name', 'limit', 'repairKits']) {
  if ($('#' + id)) {
    $('#' + id).oninput = () => {
      level[id] = id === 'name' ? $('#' + id).value : Math.max(0, parseInt($('#' + id).value, 10) || 0);
      if (id === 'name') {
        const slug = slugify(level.name);
        level.id = slug;
        $('#id').value = slug;
      }
      change();
    };
  }
}

const handleDescInput = () => {
  const night = $('#descriptionNight')?.value ?? '';
  const day = $('#descriptionDay')?.value ?? '';
  level.descriptionNight = night;
  level.descriptionDay = day;
  level.description = night || day;
  if ($('#description')) $('#description').value = level.description;
  change();
};
if ($('#descriptionNight')) $('#descriptionNight').oninput = handleDescInput;
if ($('#descriptionDay')) $('#descriptionDay').oninput = handleDescInput;
if ($('#description')) {
  $('#description').oninput = () => {
    level.description = $('#description').value;
    if ($('#descriptionNight')) $('#descriptionNight').value = level.description;
    if ($('#descriptionDay')) $('#descriptionDay').value = level.description;
    level.descriptionNight = level.description;
    level.descriptionDay = level.description;
    change();
  };
}

$('#direction-buttons')?.querySelectorAll('.dir-btn').forEach((b) => {
  b.onclick = () => {
    const d = +b.dataset.dir;
    if (level.start.dir === d) return;
    checkpoint();
    level.start.dir = d;
    fill();
    change();
  };
});

$('#house-direction-buttons')?.querySelectorAll('.dir-btn').forEach((b) => {
  b.onclick = () => {
    houseDir = +b.dataset.dir;
    updateHouseDirButtons();
  };
});

function updateStepButtonsState() {
  const w = level.width || 4;
  const d = level.depth || 4;
  if ($('#btn-width-dec')) $('#btn-width-dec').disabled = w <= 2;
  if ($('#btn-width-inc')) $('#btn-width-inc').disabled = w >= 10;
  if ($('#btn-depth-dec')) $('#btn-depth-dec').disabled = d <= 2;
  if ($('#btn-depth-inc')) $('#btn-depth-inc').disabled = d >= 10;
}

function applyDimensions(w, d) {
  checkpoint();
  const res = resizeLevel(level, w, d, status);
  if (!res || !res.changed) {
    if ($('#width')) $('#width').value = level.width;
    if ($('#depth')) $('#depth').value = level.depth;
    updateStepButtonsState();
    sizeMatrix.render();
    return !!res;
  }

  if ($('#width')) $('#width').value = w;
  if ($('#depth')) $('#depth').value = d;
  updateStepButtonsState();
  change();
  draw();
  fill();

  if (res.startRelocated) {
    status(`Розмір поля змінено на ${w}×${d}. Старт автоматично перенесено в нові межі на (${res.newStartX + 1}, ${res.newStartZ + 1}).`);
  } else if (res.shiftX > 0 || res.shiftZ > 0) {
    status(`Розмір поля змінено на ${w}×${d}. Вміст автоматично посунуто на сітці.`);
  } else {
    status(`Розмір поля змінено на ${w}×${d}.`);
  }
  return true;
}

const sizeMatrix = setupSizeMatrix({
  matrixEl: $('#size-matrix'),
  previewBadgeEl: $('#size-preview-badge'),
  infoEl: $('#size-picker-info'),
  getLevel: () => level,
  onResize: (w, d) => applyDimensions(w, d)
});

function updateSizeFromInputs() {
  const rawW = parseInt($('#width')?.value, 10);
  const rawD = parseInt($('#depth')?.value, 10);
  const targetW = Number.isNaN(rawW) ? level.width : Math.max(2, Math.min(10, rawW));
  const targetD = Number.isNaN(rawD) ? level.depth : Math.max(2, Math.min(10, rawD));
  if (targetW !== level.width || targetD !== level.depth) {
    applyDimensions(targetW, targetD);
  } else {
    if ($('#width')) $('#width').value = targetW;
    if ($('#depth')) $('#depth').value = targetD;
    updateStepButtonsState();
    sizeMatrix.render();
  }
}

$('#width')?.addEventListener('change', updateSizeFromInputs);
$('#depth')?.addEventListener('change', updateSizeFromInputs);
$('#width')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    updateSizeFromInputs();
  }
});
$('#depth')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    updateSizeFromInputs();
  }
});

$('#btn-width-dec')?.addEventListener('click', () => {
  applyDimensions(Math.max(2, level.width - 1), level.depth);
});
$('#btn-width-inc')?.addEventListener('click', () => {
  applyDimensions(Math.min(10, level.width + 1), level.depth);
});
$('#btn-depth-dec')?.addEventListener('click', () => {
  applyDimensions(level.width, Math.max(2, level.depth - 1));
});
$('#btn-depth-inc')?.addEventListener('click', () => {
  applyDimensions(level.width, Math.min(10, level.depth + 1));
});

$('#undo').onclick = () => {
  const previous = history.undo(level);
  if (previous) {
    level = previous;
    change();
    fill();
    status('Попередню зміну скасовано.');
  }
};

$('#redo').onclick = () => {
  const next = history.redo(level);
  if (next) {
    level = next;
    change();
    fill();
    status('Зміну повернено.');
  }
};

$('#view-grid').onclick = () => {
  view = 'grid';
  draw();
};
$('#view-3d').onclick = () => {
  view = '3d';
  draw();
};

function discard() {
  return !dirty || confirm('Є незбережені зміни. Відкрити інший рівень без їх збереження?');
}

async function openLevel(id) {
  if (!id) return;
  if (savedId === id && !dirty) return;
  if (!discard()) return;
  try {
    const r = await fetch(`../levels/${id}.json`, { cache: 'no-store' });
    if (!r.ok) throw new Error('Не вдалося відкрити рівень.');
    const l = await r.json();
    const errors = validateLevel(l);
    if (errors.length) throw new Error(errors.join(' '));
    level = l;
    savedId = id;
    dirty = false;
    history.clear();
    fill();
    storeDraft();
    highlightActiveLevel();
    status(`Рівень «${l.name}» відкрито.`);
  } catch (e) {
    status(e.message, true);
  }
}

function createNewLevel(catId = '') {
  if (!discard()) return;
  level = createFreshLevel();
  level.category = catId;
  const cat = dynamicCategories.find((c) => c.id === catId);
  if (cat && Array.isArray(cat.allowedCommands) && cat.allowedCommands.length) {
    level.allowed = [...cat.allowedCommands];
  }
  savedId = null;
  history.clear();
  dirty = false;
  fill();
  storeDraft();
  highlightActiveLevel();
  if (catId) {
    const acc = document.querySelector(`.cat-accordion[data-cat="${catId}"]`);
    if (acc) acc.open = true;
    status(`Створено новий рівень у темі «${cat?.title || catId}». Вкажи назву та розстав ліхтарі або будинки.`);
  } else {
    status('Новий рівень 4×4. Вкажи назву та розстав ліхтарі або будинки.');
  }
  $('#name')?.focus();
}

function highlightActiveLevel() {
  const tree = $('#level-tree');
  if (!tree) return;
  let activeCat = null;
  tree.querySelectorAll('.cat-level-item').forEach((li) => {
    const isAct = savedId && li.dataset.id === savedId;
    li.classList.toggle('active', !!isAct);
    if (isAct) activeCat = li.closest('.cat-accordion');
  });
  if (activeCat) {
    tree.querySelectorAll('.cat-accordion[open]').forEach((acc) => {
      if (acc !== activeCat) acc.open = false;
    });
    activeCat.open = true;
  }
}

$('#new').onclick = () => createNewLevel('');

let allLoadedLevels = [];

async function list() {
  const tree = $('#level-tree');
  if (!tree) return;
  const openCats = new Set(
    Array.from(tree.querySelectorAll('.cat-accordion[open]')).map((el) => el.dataset.cat)
  );

  const { categories: fetchedCats, levels: loaded } = await fetchStructureLevels();
  if (fetchedCats.length) dynamicCategories = fetchedCats;
  allLoadedLevels = loaded;

  tree.replaceChildren();

  const handleReorder = async (catId, newIdsInCat) => {
    if (!local) {
      status('Зміна порядку рівнів доступна лише через локальний node server.cjs.', true);
      return;
    }
    try {
      const isOther = catId === '_other';
      const catLevels = allLoadedLevels.filter((l) =>
        isOther ? !dynamicCategories.some((c) => c.id === (l.category || getCategory(l))) : (l.category || getCategory(l)) === catId
      );
      const map = new Map(catLevels.map((l) => [l.id, l]));
      const reordered = newIdsInCat.map((id) => map.get(id)).filter(Boolean);

      let idx = 0;
      for (let i = 0; i < allLoadedLevels.length; i++) {
        const match = isOther
          ? !dynamicCategories.some((c) => c.id === (allLoadedLevels[i].category || getCategory(allLoadedLevels[i])))
          : (allLoadedLevels[i].category || getCategory(allLoadedLevels[i])) === catId;
        if (match) {
          allLoadedLevels[i] = reordered[idx++];
        }
      }

      const allIds = allLoadedLevels.map((l) => l.id);
      await reorderLevelsOnServer(allIds);
      const catObj = dynamicCategories.find((c) => c.id === catId);
      status(`Порядок рівнів у темі «${catObj?.title || 'Без категорії'}» оновлено.`);
    } catch (err) {
      status('Помилка збереження порядку: ' + err.message, true);
      await list();
    }
  };

  for (const cat of dynamicCategories) {
    const group = loaded.filter((l) => (l.category || getCategory(l)) === cat.id);
    const details = document.createElement('details');
    details.className = 'cat-accordion';
    details.name = 'cat-tree-group';
    details.dataset.cat = cat.id;
    if (openCats.has(cat.id) || (savedId && group.some((l) => l.id === savedId))) {
      details.open = true;
    }
    details.ontoggle = () => {
      if (details.open) {
        tree.querySelectorAll('.cat-accordion[open]').forEach((other) => {
          if (other !== details) other.open = false;
        });
      }
    };

    const summary = document.createElement('summary');
    summary.className = 'cat-summary';
    summary.innerHTML = `
      <span class="cat-summary-left">
        <span class="cat-caret">▸</span>
        <span class="cat-icon">${cat.icon || '📁'}</span>
        <span class="cat-title">${cat.title}</span>
      </span>
      <span class="cat-count">${group.length}</span>
    `;
    details.append(summary);

    const body = document.createElement('div');
    body.className = 'cat-body';

    const ul = document.createElement('ul');
    ul.className = 'cat-level-list';
    if (group.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'cat-level-empty';
      empty.textContent = 'У цій темі ще немає рівнів';
      ul.append(empty);
    } else {
      for (const l of group) {
        const li = document.createElement('li');
        li.className = 'cat-level-item' + (l.id === savedId ? ' active' : '');
        li.dataset.id = l.id;
        li.dataset.cat = cat.id;

        const row = document.createElement('div');
        row.className = 'cat-level-row';

        const handle = document.createElement('span');
        handle.className = 'level-drag-handle';
        handle.title = 'Перетягни, щоб змінити порядок';
        handle.setAttribute('aria-label', 'Перетягнути для зміни порядку');
        handle.textContent = '⠿';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-level';
        btn.draggable = false;
        btn.title = `${l.name} (${l.id})`;
        btn.innerHTML = `
          <span class="level-bullet">●</span>
          <span class="level-name">${l.name || l.id}</span>
          ${l.hidden ? '<span class="level-badge-hidden">прихов.</span>' : ''}
        `;
        btn.onclick = () => {
          if (isLevelTreeDragging()) return;
          openLevel(l.id);
        };

        row.append(handle, btn);
        li.append(row);
        ul.append(li);
      }
      enableLevelTreeDnd({ ul, categoryId: cat.id, onReorder: handleReorder });
    }
    body.append(ul);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-add-level-cat';
    addBtn.textContent = '＋ Новий рівень у цій темі';
    addBtn.onclick = () => createNewLevel(cat.id);
    body.append(addBtn);

    details.append(body);
    tree.append(details);
  }

  const other = loaded.filter(
    (l) => !dynamicCategories.some((c) => c.id === (l.category || getCategory(l)))
  );
  if (other.length) {
    const details = document.createElement('details');
    details.className = 'cat-accordion';
    details.name = 'cat-tree-group';
    details.dataset.cat = '_other';
    if (openCats.has('_other') || (savedId && other.some((l) => l.id === savedId))) {
      details.open = true;
    }
    details.ontoggle = () => {
      if (details.open) {
        tree.querySelectorAll('.cat-accordion[open]').forEach((other) => {
          if (other !== details) other.open = false;
        });
      }
    };
    const summary = document.createElement('summary');
    summary.className = 'cat-summary';
    summary.innerHTML = `
      <span class="cat-summary-left">
        <span class="cat-caret">▸</span>
        <span class="cat-icon">📂</span>
        <span class="cat-title">Без категорії</span>
      </span>
      <span class="cat-count">${other.length}</span>
    `;
    details.append(summary);

    const body = document.createElement('div');
    body.className = 'cat-body';
    const ul = document.createElement('ul');
    ul.className = 'cat-level-list';
    for (const l of other) {
      const li = document.createElement('li');
      li.className = 'cat-level-item' + (l.id === savedId ? ' active' : '');
      li.dataset.id = l.id;
      li.dataset.cat = '_other';

      const row = document.createElement('div');
      row.className = 'cat-level-row';

      const handle = document.createElement('span');
      handle.className = 'level-drag-handle';
      handle.title = 'Перетягни, щоб змінити порядок';
      handle.setAttribute('aria-label', 'Перетягнути для зміни порядку');
      handle.textContent = '⠿';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-level';
      btn.draggable = false;
      btn.title = `${l.name} (${l.id})`;
      btn.innerHTML = `
        <span class="level-bullet">●</span>
        <span class="level-name">${l.name || l.id}</span>
        ${l.hidden ? '<span class="level-badge-hidden">прихов.</span>' : ''}
      `;
      btn.onclick = () => {
        if (isLevelTreeDragging()) return;
        openLevel(l.id);
      };

      row.append(handle, btn);
      li.append(row);
      ul.append(li);
    }
    enableLevelTreeDnd({ ul, categoryId: '_other', onReorder: handleReorder });
    body.append(ul);
    details.append(body);
    tree.append(details);
  }
}

function fill() {
  const nightDesc = level.descriptionNight !== undefined ? level.descriptionNight : level.description || '';
  const dayDesc = level.descriptionDay !== undefined ? level.descriptionDay : level.description || '';
  level.descriptionNight = nightDesc;
  level.descriptionDay = dayDesc;
  level.description = nightDesc || dayDesc || '';

  for (const id of ['id', 'name', 'description', 'width', 'depth', 'limit', 'repairKits']) {
    if ($('#' + id)) $('#' + id).value = level[id] ?? (id === 'limit' || id === 'repairKits' ? 0 : '');
  }
  if ($('#descriptionNight')) $('#descriptionNight').value = nightDesc;
  if ($('#descriptionDay')) $('#descriptionDay').value = dayDesc;
  $('#category').replaceChildren();
  if (!level.category) $('#category').add(new Option('Обери категорію…', ''));
  for (const cat of dynamicCategories) $('#category').add(new Option(cat.title, cat.id));
  $('#category').value = level.category || '';
  $('#category').onchange = () => {
    checkpoint();
    level.category = $('#category').value;
    const cat = dynamicCategories.find((c) => c.id === level.category);
    if (cat && Array.isArray(cat.allowedCommands) && cat.allowedCommands.length) {
      level.allowed = [...cat.allowedCommands];
      fill();
      status(`Категорію змінено на «${cat.title}». Доступні команди оновлено за темою.`);
    }
    change();
  };

  $('#btn-all-cmds').onclick = () => {
    checkpoint();
    level.allowed = Object.keys(commands);
    fill();
    change();
  };
  $('#btn-basic-cmds').onclick = () => {
    checkpoint();
    level.allowed = ['forward', 'left', 'right', 'jump', 'light'];
    fill();
    change();
  };
  $('#btn-clear-cmds').onclick = () => {
    checkpoint();
    level.allowed = ['light'];
    fill();
    change();
  };

  const curDir = level.start.dir ?? 0;
  $('#direction-buttons')?.querySelectorAll('.dir-btn').forEach((b) => {
    const isSel = +b.dataset.dir === curDir;
    b.classList.toggle('selected', isSel);
    b.setAttribute('aria-pressed', String(isSel));
  });

  $('#allowed').replaceChildren();
  for (const [id, [cmdIcon, name]] of Object.entries(commands)) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = level.allowed.includes(id);
    box.onchange = () => {
      checkpoint();
      level.allowed = Object.keys(commands).filter((k) =>
        k === id ? box.checked : level.allowed.includes(k)
      );
      drawLevelHints();
      change();
    };
    label.append(box, document.createTextNode(cmdIcon + ' ' + name));
    $('#allowed').append(label);
  }

  drawLevelHints();

  $('#dirty').textContent = dirty ? 'Є незбережені зміни' : 'Збережено';
  updateStepButtonsState();
  sizeMatrix.render();
  draw();
}

function drawLevelHints() {
  renderHintEditor($('#level-hints'), level.hints, {
    allowedCommands: level.allowed,
    onChange: (next) => {
      checkpoint();
      level.hints = next;
      change();
    }
  });
}

function valid() {
  const errors = validateLevel(level);
  if (errors.length) {
    status(errors.join(' '), true);
    return false;
  }
  return true;
}

async function save(copy = false) {
  $('#save').disabled = $('#copy').disabled = true;
  try {
    if (!local) {
      status('Збереження файлів працює лише через локальний node server.cjs. Можна завантажити JSON.', true);
      return;
    }
    const candidate = structuredClone(level);
    candidate.category = $('#category').value || level.category || getCategory(level);
    candidate.descriptionNight = $('#descriptionNight')?.value ?? level.descriptionNight ?? '';
    candidate.descriptionDay = $('#descriptionDay')?.value ?? level.descriptionDay ?? '';
    candidate.description = candidate.descriptionNight || candidate.descriptionDay || level.description || '';
    if (level.hidden) candidate.hidden = true;
    if (copy) {
      candidate.name = (level.name + ' — копія').slice(0, 80);
    }

    const existingIds = await getExistingIds();
    const baseSource = copy ? candidate.name : candidate.name || candidate.id || 'level';
    const uniqueId = makeUniqueId(baseSource, existingIds, copy ? null : savedId);
    candidate.id = uniqueId;
    level.id = uniqueId;
    $('#id').value = uniqueId;

    const errors = validateLevel(candidate);
    if (errors.length) {
      status(errors.join(' '), true);
      return;
    }

    const idChanged = savedId !== null && savedId !== candidate.id;
    const overwrite = !copy && savedId !== null && !idChanged;

    const result = await saveLevelToServer(candidate, overwrite);
    const finalId = result.saved || candidate.id;
    candidate.id = finalId;

    if (!copy && idChanged) {
      try {
        await deleteLevelOnServer(savedId);
      } catch {}
    }

    level = candidate;
    savedId = level.id;
    dirty = false;
    fill();
    storeDraft();
    await list();
    highlightActiveLevel();
    status(`Збережено: «${level.name}» (файл levels/${level.id}.json)`);
  } catch (e) {
    status(e.message, true);
  } finally {
    $('#save').disabled = $('#copy').disabled = false;
  }
}

$('#save').onclick = () => save();
$('#copy').onclick = () => save(true);
$('#test').onclick = () => {
  if (!valid()) return;
  storeDraft();
  sessionStorage.setItem('lamplighter-preview', JSON.stringify(level));
  location.href = '../#level=preview';
};
$('#export').onclick = () => {
  if (!valid()) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(level, null, 2) + '\n'], { type: 'application/json' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = level.id + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

window.addEventListener('beforeunload', () => {
  if (dirty && !location.hash) {
    storeDraft();
  }
});

dynamicCategories = await fetchCategories();
const initialDraft = loadDraft(createFreshLevel());
level = initialDraft.level;
dirty = initialDraft.dirty;
savedId = initialDraft.savedId;
fill();

try {
  const response = await fetch('../api/status');
  local = response.ok && (await response.json()).local === true;
} catch {}

$('#connection').textContent = local
  ? '● Локальний сервер підключено. Рівні зберігаються у папку levels.'
  : 'Режим перегляду: для запису файлів відкрий адмінку через локальний сервер. Експорт JSON і тестування доступні.';

list()
  .then(async () => {
    const urlOpen = new URLSearchParams(location.search).get('open');
    if (urlOpen) {
      await openLevel(urlOpen);
    } else if (savedId) {
      highlightActiveLevel();
    }
  })
  .catch((e) => status(e.message, true));
