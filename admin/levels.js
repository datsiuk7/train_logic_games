const $ = s => document.querySelector(s);
let categories = [];
let levels = [];
let isLocal = false;
let searchQuery = '';

const ICON_VISIBLE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICON_HIDDEN = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function showToast(text, isError = false) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = text;
  t.className = 'toast-msg ' + (isError ? 'error' : 'success');
  t.style.display = 'block';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => { t.style.display = 'none'; }, 300);
  }, 2800);
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function checkServer() {
  try {
    const res = await fetch('../api/status');
    isLocal = res.ok && (await res.json()).local === true;
  } catch {
    isLocal = false;
  }
  const conn = $('#connection');
  if (conn) {
    conn.textContent = isLocal
      ? '● Локальний сервер підключено. Зміни зберігаються автоматично.'
      : 'Режим перегляду: для збереження файлів запустіть локальний node server.cjs.';
  }
}

async function loadData() {
  try {
    const res = await fetch('../api/structure');
    if (res.ok) {
      const data = await res.json();
      categories = data.categories || [];
      levels = data.levels || [];
    } else {
      const catRes = await fetch('../levels/categories.json');
      categories = catRes.ok ? await catRes.json() : [];
      const idxRes = await fetch('../levels/index.json');
      const ids = idxRes.ok ? await idxRes.json() : [];
      levels = ids.map(id => ({ id, name: id }));
    }
  } catch (err) {
    showToast('Помилка завантаження даних: ' + err.message, true);
  }

  const countEl = $('#total-levels-count');
  if (countEl) countEl.textContent = levels.length;

  renderTree();
}

function renderTree() {
  const container = $('#levels-tree');
  if (!container) return;

  const countEl = $('#total-levels-count');
  if (countEl) countEl.textContent = levels.length;

  if (!categories.length && !levels.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#6b8292">Немає категорій та рівнів.</div>';
    return;
  }

  const normQuery = searchQuery.trim().toLowerCase();

  // Known categories
  const catHtml = categories.map((cat, catIdx) => {
    let catLevels = levels.filter(l => l.category === cat.id);
    if (normQuery) {
      catLevels = catLevels.filter(l =>
        (l.name && l.name.toLowerCase().includes(normQuery)) ||
        (l.id && l.id.toLowerCase().includes(normQuery))
      );
    }

    const rows = catLevels.length
      ? catLevels.map((lvl, lvlIdx) => renderLevelRow(lvl, cat, catLevels, lvlIdx, catIdx)).join('')
      : `<div class="empty-cat-placeholder">${normQuery ? 'У цій темі немає рівнів, що відповідають пошуку' : 'У цій темі поки немає рівнів'}</div>`;

    return `
      <section class="cat-group" data-cat-id="${esc(cat.id)}">
        <header class="cat-group-header">
          <div class="cat-group-title">
            <span class="cat-group-icon">${esc(cat.icon || '✦')}</span>
            <span class="cat-group-name">${esc(cat.title)}</span>
            ${cat.badge ? `<span style="font-size:11px;color:#a4bece;background:#101c26;padding:2px 8px;border-radius:6px;border:1px solid #293d4e">${esc(cat.badge)}</span>` : ''}
          </div>
          <span class="cat-group-count">${catLevels.length} ${catLevels.length === 1 ? 'рівень' : catLevels.length < 5 ? 'рівні' : 'рівнів'}</span>
        </header>
        <div class="levels-list-in-cat">
          ${rows}
        </div>
      </section>
    `;
  }).join('');

  // Unassigned or unknown category levels
  const knownCatIds = new Set(categories.map(c => c.id));
  let orphanLevels = levels.filter(l => !l.category || !knownCatIds.has(l.category));
  if (normQuery) {
    orphanLevels = orphanLevels.filter(l =>
      (l.name && l.name.toLowerCase().includes(normQuery)) ||
      (l.id && l.id.toLowerCase().includes(normQuery))
    );
  }

  let orphanHtml = '';
  if (orphanLevels.length > 0) {
    const orphanRows = orphanLevels.map((lvl, lvlIdx) => renderLevelRow(lvl, null, orphanLevels, lvlIdx, -1)).join('');
    orphanHtml = `
      <section class="cat-group" style="border-color:#b45309" data-cat-id="">
        <header class="cat-group-header" style="background:#261b12">
          <div class="cat-group-title">
            <span class="cat-group-icon" style="color:#f59e0b">⚠</span>
            <span class="cat-group-name" style="color:#fbbf24">Нерозподілені рівні</span>
          </div>
          <span class="cat-group-count">${orphanLevels.length}</span>
        </header>
        <div class="levels-list-in-cat">
          ${orphanRows}
        </div>
      </section>
    `;
  }

  container.innerHTML = catHtml + orphanHtml;
  attachTreeEvents(container);
}

function renderLevelRow(lvl, cat, listInCat, lvlIdx, catIdx) {
  const numBadge = catIdx >= 0 ? `${catIdx + 1}.${lvlIdx + 1}` : `•`;
  const isHidden = !!lvl.hidden;

  const catOptions = categories.map(c => {
    const selected = c.id === lvl.category ? 'selected' : '';
    return `<option value="${esc(c.id)}" ${selected}>${esc(c.title)}</option>`;
  }).join('');

  return `
    <article class="level-row ${isHidden ? 'is-hidden' : ''}" data-level-id="${esc(lvl.id)}" draggable="true">
      <div class="drag-handle" title="Перетягни мишкою для зміни порядку або теми" aria-hidden="true">⠿</div>
      <div class="level-order-badge">${numBadge}</div>
      <div class="level-info-cell">
        <div class="level-title-line">
          <a href="index.html?open=${encodeURIComponent(lvl.id)}" class="level-name-link" title="Відкрити у редакторі карти">${esc(lvl.name || lvl.id)}</a>
          <span class="level-id-tag">(${esc(lvl.id)})</span>
          <span class="vis-badge ${isHidden ? 'hidden' : 'visible'}">${isHidden ? '👁 Приховано' : '✓ Видимий'}</span>
        </div>
        <div class="level-meta-line">
          <span>Розмір: ${lvl.boardSize || '?'}</span>
          <span>•</span>
          <span>Команди: ${(lvl.commands || []).join(', ') || 'за замовчуванням'}</span>
        </div>
      </div>
      <div class="level-actions">
        <button type="button" class="btn-icon-tiny btn-lvl-up" ${lvlIdx === 0 ? 'disabled' : ''} title="Підняти вище у розділі">↑</button>
        <button type="button" class="btn-icon-tiny btn-lvl-down" ${lvlIdx === listInCat.length - 1 ? 'disabled' : ''} title="Опустити нижче у розділі">↓</button>
        <select class="select-move-cat" title="Змінити тему/розділ">
          ${catOptions}
        </select>
        <button type="button" class="btn-vis-toggle ${isHidden ? 'is-hidden' : 'is-visible'}" title="${isHidden ? 'Прихований (не активний). Клікни, щоб зробити видимим' : 'Видимий (активний). Клікни, щоб приховати'}" aria-label="${isHidden ? 'Зробити рівень видимим' : 'Приховати рівень'}">
          ${isHidden ? ICON_HIDDEN : ICON_VISIBLE}
        </button>
        <button type="button" class="btn-delete-level" title="Видалити рівень">✕</button>
      </div>
    </article>
  `;
}

let draggedLevelId = null;

async function handleLevelDrop(draggedId, targetId, isAfter, targetCatId) {
  const draggedLvl = levels.find(l => l.id === draggedId);
  const targetLvl = levels.find(l => l.id === targetId);
  if (!draggedLvl || !targetLvl) return;

  const oldCat = draggedLvl.category || '';
  const newCat = targetCatId !== undefined ? targetCatId : (targetLvl.category || '');
  const catChanged = oldCat !== newCat;

  if (catChanged) {
    try {
      const res = await fetch('../api/levels/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
        body: JSON.stringify({ id: draggedId, category: newCat })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося змінити категорію');
      draggedLvl.category = newCat;
    } catch (err) {
      showToast('Помилка: ' + err.message, true);
      renderTree();
      return;
    }
  }

  const fromIndex = levels.findIndex(l => l.id === draggedId);
  if (fromIndex !== -1) levels.splice(fromIndex, 1);

  let toIndex = levels.findIndex(l => l.id === targetId);
  if (toIndex !== -1) {
    if (isAfter) toIndex++;
    levels.splice(toIndex, 0, draggedLvl);
  } else {
    levels.push(draggedLvl);
  }

  await saveReorder(true);

  if (catChanged) {
    const catObj = categories.find(c => c.id === newCat);
    showToast(`Рівень «${draggedLvl.name || draggedLvl.id}» перенесено у тему «${catObj?.title || 'Без категорії'}»!`);
  } else {
    showToast('Порядок рівнів оновлено!');
  }
}

async function handleCatDrop(draggedId, targetCatId) {
  const draggedLvl = levels.find(l => l.id === draggedId);
  if (!draggedLvl) return;

  const oldCat = draggedLvl.category || '';
  const newCat = targetCatId || '';
  const catChanged = oldCat !== newCat;

  if (catChanged) {
    try {
      const res = await fetch('../api/levels/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
        body: JSON.stringify({ id: draggedId, category: newCat })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося змінити категорію');
      draggedLvl.category = newCat;
    } catch (err) {
      showToast('Помилка: ' + err.message, true);
      renderTree();
      return;
    }
  }

  const fromIndex = levels.findIndex(l => l.id === draggedId);
  if (fromIndex !== -1) levels.splice(fromIndex, 1);

  const catLevels = levels.filter(l => (l.category || '') === newCat);
  if (catLevels.length > 0) {
    const lastLvl = catLevels[catLevels.length - 1];
    const lastIdx = levels.findIndex(l => l.id === lastLvl.id);
    levels.splice(lastIdx + 1, 0, draggedLvl);
  } else {
    levels.push(draggedLvl);
  }

  await saveReorder(true);

  if (catChanged) {
    const catObj = categories.find(c => c.id === newCat);
    showToast(`Рівень «${draggedLvl.name || draggedLvl.id}» перенесено у тему «${catObj?.title || 'Без категорії'}»!`);
  } else {
    showToast('Порядок рівнів оновлено!');
  }
}

function attachTreeEvents(container) {
  // Drag & drop handlers on rows
  container.querySelectorAll('.level-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      if (e.target.closest('button, select, a, input')) {
        e.preventDefault();
        return;
      }
      draggedLevelId = row.dataset.levelId;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedLevelId);
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('is-dragging');
      draggedLevelId = null;
      container.querySelectorAll('.level-row').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
      container.querySelectorAll('.levels-list-in-cat').forEach(c => c.classList.remove('drag-over'));
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedLevelId || row.dataset.levelId === draggedLevelId) return;

      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const isAfter = e.clientY > (rect.top + rect.height / 2);

      row.classList.toggle('drag-over-top', !isAfter);
      row.classList.toggle('drag-over-bottom', isAfter);
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    row.addEventListener('drop', async e => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove('drag-over-top', 'drag-over-bottom');
      if (!draggedLevelId || row.dataset.levelId === draggedLevelId) return;

      const targetLevelId = row.dataset.levelId;
      const rect = row.getBoundingClientRect();
      const isAfter = e.clientY > (rect.top + rect.height / 2);
      const targetCatId = row.closest('.cat-group')?.dataset.catId;

      await handleLevelDrop(draggedLevelId, targetLevelId, isAfter, targetCatId);
    });
  });

  // Drag over category container for dropping into empty category or at the end
  container.querySelectorAll('.cat-group').forEach(group => {
    const listEl = group.querySelector('.levels-list-in-cat');
    if (!listEl) return;

    listEl.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedLevelId) return;
      if (e.target === listEl || e.target.classList.contains('empty-cat-placeholder')) {
        e.dataTransfer.dropEffect = 'move';
        listEl.classList.add('drag-over');
      }
    });

    listEl.addEventListener('dragleave', e => {
      if (!listEl.contains(e.relatedTarget)) {
        listEl.classList.remove('drag-over');
      }
    });

    listEl.addEventListener('drop', async e => {
      if (e.target.closest('.level-row')) return;
      e.preventDefault();
      listEl.classList.remove('drag-over');
      if (!draggedLevelId) return;
      const targetCatId = group.dataset.catId;
      await handleCatDrop(draggedLevelId, targetCatId);
    });
  });

  container.querySelectorAll('.level-row').forEach(row => {
    const levelId = row.dataset.levelId;
    const lvl = levels.find(l => l.id === levelId);
    if (!lvl) return;

    // Move up/down within category in global index
    const btnUp = row.querySelector('.btn-lvl-up');
    if (btnUp) {
      btnUp.onclick = async () => {
        const catLevels = levels.filter(l => l.category === lvl.category);
        const curIdxInCat = catLevels.findIndex(l => l.id === lvl.id);
        if (curIdxInCat <= 0) return;

        const prevLvl = catLevels[curIdxInCat - 1];
        const globalA = levels.findIndex(l => l.id === lvl.id);
        const globalB = levels.findIndex(l => l.id === prevLvl.id);
        if (globalA === -1 || globalB === -1) return;

        const tmp = levels[globalA];
        levels[globalA] = levels[globalB];
        levels[globalB] = tmp;

        await saveReorder();
      };
    }

    const btnDown = row.querySelector('.btn-lvl-down');
    if (btnDown) {
      btnDown.onclick = async () => {
        const catLevels = levels.filter(l => l.category === lvl.category);
        const curIdxInCat = catLevels.findIndex(l => l.id === lvl.id);
        if (curIdxInCat === -1 || curIdxInCat >= catLevels.length - 1) return;

        const nextLvl = catLevels[curIdxInCat + 1];
        const globalA = levels.findIndex(l => l.id === lvl.id);
        const globalB = levels.findIndex(l => l.id === nextLvl.id);
        if (globalA === -1 || globalB === -1) return;

        const tmp = levels[globalA];
        levels[globalA] = levels[globalB];
        levels[globalB] = tmp;

        await saveReorder();
      };
    }

    // Move category dropdown
    const selectCat = row.querySelector('.select-move-cat');
    if (selectCat) {
      selectCat.onchange = async () => {
        const newCat = selectCat.value;
        if (newCat === lvl.category) return;
        try {
          const res = await fetch('../api/levels/meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
            body: JSON.stringify({ id: lvl.id, category: newCat })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Не вдалося змінити категорію');
          lvl.category = newCat;
          renderTree();
          showToast(`Рівень "${lvl.name || lvl.id}" переміщено до іншої теми!`);
        } catch (err) {
          showToast('Помилка: ' + err.message, true);
          selectCat.value = lvl.category;
        }
      };
    }

    // Toggle visibility
    const btnVis = row.querySelector('.btn-vis-toggle');
    if (btnVis) {
      btnVis.onclick = async () => {
        const nextHidden = !lvl.hidden;
        try {
          const res = await fetch('../api/levels/meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
            body: JSON.stringify({ id: lvl.id, hidden: nextHidden })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Не вдалося змінити видимість');
          lvl.hidden = nextHidden;
          renderTree();
          showToast(nextHidden ? `Рівень "${lvl.name || lvl.id}" тепер приховано` : `Рівень "${lvl.name || lvl.id}" тепер видимий у грі`);
        } catch (err) {
          showToast('Помилка: ' + err.message, true);
        }
      };
    }

    // Delete level
    const btnDel = row.querySelector('.btn-delete-level');
    if (btnDel) {
      btnDel.onclick = async () => {
        if (!confirm(`Ви дійсно бажаєте видалити рівень "${lvl.name || lvl.id}" (${lvl.id})?\nЦю дію не можна буде скасувати.`)) {
          return;
        }
        try {
          const res = await fetch('../api/levels/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
            body: JSON.stringify({ id: lvl.id })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Не вдалося видалити рівень');
          levels = levels.filter(l => l.id !== lvl.id);
          renderTree();
          showToast(`Рівень "${lvl.name || lvl.id}" успішно видалено`);
        } catch (err) {
          showToast('Помилка: ' + err.message, true);
        }
      };
    }
  });
}

async function saveReorder(silent = false) {
  try {
    const ids = levels.map(l => l.id);
    const res = await fetch('../api/levels/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Помилка зміни порядку');
    renderTree();
    if (!silent) showToast('Порядок рівнів оновлено!');
  } catch (err) {
    showToast('Помилка: ' + err.message, true);
  }
}

await checkServer();
await loadData();
