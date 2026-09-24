import { commands } from '../logic.mjs';

const $ = s => document.querySelector(s);
let categories = [];
let levels = [];
let isLocal = false;

const commandOrder = ['forward', 'left', 'right', 'jump', 'light', 'take', 'fix', 'loop', 'if', 'while', 'call'];
const commandKeys = Array.from(new Set([...commandOrder, ...Object.keys(commands)]));

function showToast(text, isError = false) {
  const t = $('#toast');
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
  $('#connection').textContent = isLocal
    ? '● Локальний сервер підключено. Зміни категорій зберігаються у папку levels.'
    : 'Режим перегляду: для збереження файлів запустіть локальний node server.cjs.';
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
      levels = ids.map(id => ({ id }));
    }
  } catch (err) {
    showToast('Помилка завантаження даних: ' + err.message, true);
  }
  renderCategories();
}

function renderCategories() {
  const container = $('#categories-list');
  if (!categories.length) {
    container.innerHTML = '<div style="padding:30px;text-align:center;color:#6b8292">Немає категорій. Натисніть "+ Додати тему" щоб створити.</div>';
    return;
  }

  container.innerHTML = categories.map((cat, idx) => {
    const assignedCount = levels.filter(l => l.category === cat.id).length;
    const catAllowed = Array.isArray(cat.allowedCommands) && cat.allowedCommands.length
      ? cat.allowedCommands
      : ['forward', 'left', 'right', 'jump', 'light'];
    cat.allowedCommands = catAllowed;

    return `
      <div class="cat-edit-item" data-id="${esc(cat.id)}">
        <div class="cat-item-top">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="cat-badge-id">ID: ${esc(cat.id)}</span>
            <span style="font-size:11.5px;color:#7c94a5">${assignedCount} ${assignedCount === 1 ? 'рівень' : assignedCount < 5 ? 'рівні' : 'рівнів'}</span>
          </div>
          <div class="cat-reorder-actions">
            <button type="button" class="btn-icon-tiny btn-cat-up" ${idx === 0 ? 'disabled' : ''} title="Вгору">↑</button>
            <button type="button" class="btn-icon-tiny btn-cat-down" ${idx === categories.length - 1 ? 'disabled' : ''} title="Вниз">↓</button>
            <button type="button" class="btn-icon-tiny btn-cat-del" title="Видалити категорію" style="color:#f87171">✕</button>
          </div>
        </div>
        <div class="cat-fields">
          <div style="display:grid;grid-template-columns:1fr 180px 70px;gap:12px">
            <label>
              Назва теми
              <input type="text" class="field-cat-title" value="${esc(cat.title)}" placeholder="Наприклад: 1. Основи руху" maxlength="80">
            </label>
            <label>
              Бейдж (підпис)
              <input type="text" class="field-cat-badge" value="${esc(cat.badge || '')}" placeholder="Базові команди" maxlength="40">
            </label>
            <label>
              Іконка
              <input type="text" class="field-cat-icon" value="${esc(cat.icon || '✦')}" placeholder="✦" maxlength="4" style="text-align:center">
            </label>
          </div>
          <label>
            Опис теми
            <textarea class="field-cat-desc" placeholder="Опишіть завдання теми">${esc(cat.description || '')}</textarea>
          </label>
          <div class="cat-commands-section">
            <div class="cat-commands-head">
              <span class="cat-commands-label">Доступні команди для рівнів теми:</span>
              <div class="cat-commands-shortcuts">
                <button type="button" class="btn-cmd-shortcut btn-cmds-all">Всі</button>
                <button type="button" class="btn-cmd-shortcut btn-cmds-basic">Базові</button>
                <button type="button" class="btn-cmd-shortcut btn-cmds-clear">Очистити</button>
              </div>
            </div>
            <div class="cat-commands-grid">
              ${commandKeys.map(cmdId => {
                const cmdInfo = commands[cmdId] || [cmdId, cmdId];
                const isChecked = catAllowed.includes(cmdId);
                return `
                  <label class="cat-cmd-label ${isChecked ? 'active' : ''}">
                    <input type="checkbox" class="field-cmd-check" data-cmd="${esc(cmdId)}" ${isChecked ? 'checked' : ''}>
                    <span class="cat-cmd-icon">${esc(cmdInfo[0])}</span>
                    <span class="cat-cmd-name">${esc(cmdInfo[1])}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach event handlers
  container.querySelectorAll('.cat-edit-item').forEach((el, idx) => {
    const cat = categories[idx];

    el.querySelector('.field-cat-title').oninput = e => { cat.title = e.target.value; };
    el.querySelector('.field-cat-badge').oninput = e => { cat.badge = e.target.value; };
    el.querySelector('.field-cat-icon').oninput = e => { cat.icon = e.target.value; };
    el.querySelector('.field-cat-desc').oninput = e => { cat.description = e.target.value; };

    // Commands handling
    const cmdCheckboxes = el.querySelectorAll('.field-cmd-check');
    const syncAllowed = () => {
      cat.allowedCommands = Array.from(cmdCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.cmd);
      cmdCheckboxes.forEach(cb => {
        cb.closest('.cat-cmd-label')?.classList.toggle('active', cb.checked);
      });
    };

    cmdCheckboxes.forEach(cb => {
      cb.onchange = () => syncAllowed();
    });

    const btnAll = el.querySelector('.btn-cmds-all');
    if (btnAll) {
      btnAll.onclick = () => {
        cmdCheckboxes.forEach(cb => { cb.checked = true; });
        syncAllowed();
      };
    }

    const btnBasic = el.querySelector('.btn-cmds-basic');
    if (btnBasic) {
      btnBasic.onclick = () => {
        const basic = ['forward', 'left', 'right', 'jump', 'light'];
        cmdCheckboxes.forEach(cb => { cb.checked = basic.includes(cb.dataset.cmd); });
        syncAllowed();
      };
    }

    const btnClear = el.querySelector('.btn-cmds-clear');
    if (btnClear) {
      btnClear.onclick = () => {
        cmdCheckboxes.forEach(cb => { cb.checked = cb.dataset.cmd === 'light'; });
        syncAllowed();
      };
    }

    el.querySelector('.btn-cat-up').onclick = () => {
      if (idx > 0) {
        const temp = categories[idx];
        categories[idx] = categories[idx - 1];
        categories[idx - 1] = temp;
        renderCategories();
      }
    };

    el.querySelector('.btn-cat-down').onclick = () => {
      if (idx < categories.length - 1) {
        const temp = categories[idx];
        categories[idx] = categories[idx + 1];
        categories[idx + 1] = temp;
        renderCategories();
      }
    };

    el.querySelector('.btn-cat-del').onclick = () => {
      const assigned = levels.filter(l => l.category === cat.id);
      if (assigned.length > 0) {
        alert(`Не можна видалити тему "${cat.title}", оскільки до неї прив'язано ${assigned.length} рівнів. Спершу перемістіть ці рівні в іншу тему на сторінці «Рівні за розділами».`);
        return;
      }
      if (confirm(`Видалити тему "${cat.title}"?`)) {
        categories.splice(idx, 1);
        renderCategories();
      }
    };
  });
}

async function saveCategories() {
  const btns = [$('#btn-save-cats'), $('#btn-save-cats-bottom')].filter(Boolean);
  btns.forEach(b => b.disabled = true);
  try {
    const res = await fetch('../api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
      body: JSON.stringify({ categories })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Помилка збереження');
    showToast('Всі категорії успішно збережено!');
  } catch (err) {
    showToast('Не вдалося зберегти: ' + err.message, true);
  } finally {
    btns.forEach(b => b.disabled = false);
  }
}

$('#btn-add-cat').onclick = () => {
  const newId = 'cat-' + Date.now().toString(36);
  categories.push({
    id: newId,
    title: `${categories.length + 1}. Нова тема`,
    badge: 'Нові команди',
    icon: '✦',
    description: 'Опишіть цілі цієї теми.',
    allowedCommands: ['forward', 'left', 'right', 'jump', 'light']
  });
  renderCategories();
  showToast('Створено нову тему. Не забудьте зберегти зміни!');
};

$('#btn-save-cats').onclick = saveCategories;
const btnBottom = $('#btn-save-cats-bottom');
if (btnBottom) btnBottom.onclick = saveCategories;

await checkServer();
await loadData();
