const $ = s => document.querySelector(s);
let isLocal = false;
let previewMode = 'night';

const defaults = {
  footerDayText: 'Місто чекає на твою програму.',
  footerNightText: 'Ніч чекає на твою програму.',
  developerText: ''
};

let currentSettings = { ...defaults };

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

async function checkServer() {
  try {
    const res = await fetch('../api/status');
    isLocal = res.ok && (await res.json()).local === true;
  } catch {
    isLocal = false;
  }
  $('#connection').textContent = isLocal
    ? '● Локальний сервер підключено. Налаштування зберігаються у файл levels/settings.json.'
    : 'Режим перегляду: для запису налаштувань запустіть локальний сервер node server.cjs.';
}

function updatePreview() {
  const quoteEl = $('#preview-quote');
  const devEl = $('#preview-dev');
  const surfaceEl = $('#footer-live-preview');

  const dayVal = $('#field-day-text').value.trim();
  const nightVal = $('#field-night-text').value.trim();
  const devVal = $('#field-dev-text').value.trim();

  if (surfaceEl) {
    surfaceEl.className = `footer-preview-surface ${previewMode === 'day' ? 'day-mode' : 'night-mode'}`;
  }

  if (quoteEl) {
    const quote = previewMode === 'day'
      ? (dayVal || defaults.footerDayText)
      : (nightVal || defaults.footerNightText);
    quoteEl.textContent = quote;
  }

  if (devEl) {
    devEl.textContent = devVal;
    devEl.style.display = devVal ? 'block' : 'none';
  }
}

async function loadSettings() {
  try {
    let loaded = null;
    try {
      const res = await fetch('../api/settings', { cache: 'no-store' });
      if (res.ok) loaded = await res.json();
    } catch {}

    if (!loaded) {
      try {
        const fileRes = await fetch('../levels/settings.json', { cache: 'no-store' });
        if (fileRes.ok) loaded = await fileRes.json();
      } catch {}
    }

    if (loaded) {
      currentSettings = { ...defaults, ...loaded };
    }
  } catch (err) {
    showToast('Помилка завантаження: ' + err.message, true);
  }

  $('#field-day-text').value = currentSettings.footerDayText || '';
  $('#field-night-text').value = currentSettings.footerNightText || '';
  $('#field-dev-text').value = currentSettings.developerText || '';
  updatePreview();
}

async function saveSettings() {
  const btns = [$('#btn-save-settings'), $('#btn-save-settings-bottom')].filter(Boolean);
  btns.forEach(b => b.disabled = true);

  const newSettings = {
    footerDayText: $('#field-day-text').value.trim() || defaults.footerDayText,
    footerNightText: $('#field-night-text').value.trim() || defaults.footerNightText,
    developerText: $('#field-dev-text').value.trim()
  };

  try {
    const res = await fetch('../api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
      body: JSON.stringify(newSettings)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Помилка збереження');
    currentSettings = newSettings;
    showToast('Налаштування успішно збережено!');
    updatePreview();
  } catch (err) {
    showToast('Не вдалося зберегти: ' + err.message, true);
  } finally {
    btns.forEach(b => b.disabled = false);
  }
}

['#field-day-text', '#field-night-text', '#field-dev-text'].forEach(sel => {
  const el = $(sel);
  if (el) el.oninput = updatePreview;
});

$('#preview-toggle-night').onclick = () => {
  previewMode = 'night';
  $('#preview-toggle-night').classList.add('active');
  $('#preview-toggle-day').classList.remove('active');
  updatePreview();
};

$('#preview-toggle-day').onclick = () => {
  previewMode = 'day';
  $('#preview-toggle-day').classList.add('active');
  $('#preview-toggle-night').classList.remove('active');
  updatePreview();
};

$('#btn-reset-defaults').onclick = () => {
  if (confirm('Скинути всі тексти підвалу до стандартних значень?')) {
    $('#field-day-text').value = defaults.footerDayText;
    $('#field-night-text').value = defaults.footerNightText;
    $('#field-dev-text').value = defaults.developerText;
    updatePreview();
  }
};

$('#btn-save-settings').onclick = saveSettings;
const btnBottom = $('#btn-save-settings-bottom');
if (btnBottom) btnBottom.onclick = saveSettings;

await checkServer();
await loadSettings();
