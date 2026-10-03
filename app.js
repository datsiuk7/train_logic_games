import {
  validateLevel,
  categories
} from './logic.mjs';
import { setupMusic, setupEffects } from './music.js';
import { renderHome, isCatUnlocked, getLevelSections, findNextLevel } from './home.js';
import { startGame } from './runner.js';

const app = document.querySelector('#app');
setupMusic(document.querySelector('#music'));
const effects = setupEffects(document.querySelector('#sound'));
setupFullscreen(document.querySelector('#fullscreen'));
setupSiteZoom(document.querySelector('#site-zoom-control'));

function setupFullscreen(button) {
  if (!button) return;

  function isFullscreen() {
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function update() {
    const fs = isFullscreen();
    button.setAttribute('aria-pressed', fs ? 'true' : 'false');
    button.textContent = fs ? '🗗 Згорнути' : '⛶ Повний екран';
    button.title = fs ? 'Вийти з повного екрана' : 'Увімкнути повний екран';
  }

  button.onclick = async () => {
    try {
      if (!isFullscreen()) {
        const root = document.documentElement || document.body;
        if (root?.requestFullscreen) await root.requestFullscreen();
        else if (root?.webkitRequestFullscreen) await root.webkitRequestFullscreen();
        else if (root?.msRequestFullscreen) await root.msRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        else if (document.msExitFullscreen) await document.msExitFullscreen();
      }
    } catch {}
    update();
  };

  const addDocListener = (event, fn) => {
    document.addEventListener?.(event, fn);
  };

  addDocListener('fullscreenchange', update);
  addDocListener('webkitfullscreenchange', update);
  addDocListener('mozfullscreenchange', update);
  addDocListener('MSFullscreenChange', update);

  update();
}

export function setupSiteZoom(container) {
  if (!container) return;

  const siteZoomIn = container.querySelector?.('#site-zoom-in');
  const siteZoomOut = container.querySelector?.('#site-zoom-out');
  const siteZoomReset = container.querySelector?.('#site-zoom-reset');
  const siteZoomVal = container.querySelector?.('#site-zoom-val');

  let currentSiteZoom = 1.0;
  try {
    const saved = sessionStorage.getItem('lamplighter-site-zoom');
    if (saved) currentSiteZoom = Math.max(0.6, Math.min(1.5, parseFloat(saved) || 1.0));
  } catch {}

  function applySiteZoom(val) {
    currentSiteZoom = Math.max(0.6, Math.min(1.5, Math.round(val * 10) / 10));
    const pct = Math.round(currentSiteZoom * 100);
    if (siteZoomVal) {
      siteZoomVal.textContent = `${pct}%`;
      siteZoomVal.classList?.toggle('is-custom', pct !== 100);
    }
    if (siteZoomReset) {
      siteZoomReset.style.display = pct === 100 ? 'none' : 'inline-flex';
    }

    if (typeof document !== 'undefined' && document.body?.style) {
      document.body.style.zoom = currentSiteZoom === 1.0 ? '' : String(currentSiteZoom);
    }
    if (typeof document !== 'undefined' && document.documentElement?.style) {
      document.documentElement.style.setProperty?.('--site-zoom', String(currentSiteZoom));
    }
    try {
      if (currentSiteZoom === 1.0) {
        sessionStorage.removeItem('lamplighter-site-zoom');
      } else {
        sessionStorage.setItem('lamplighter-site-zoom', String(currentSiteZoom));
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent?.(new Event('resize'));
    }
  }

  if (currentSiteZoom !== 1.0) {
    applySiteZoom(currentSiteZoom);
  }

  if (siteZoomIn) siteZoomIn.onclick = () => applySiteZoom(currentSiteZoom + 0.1);
  if (siteZoomOut) siteZoomOut.onclick = () => applySiteZoom(currentSiteZoom - 0.1);
  if (siteZoomReset) siteZoomReset.onclick = () => applySiteZoom(1.0);
  if (siteZoomVal) siteZoomVal.onclick = () => applySiteZoom(1.0);
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

let cleanup = () => {};
let levels = [];
let currentTheme = localStorage.getItem('lamplighter-theme') || 'dark';
let currentCategories = [...categories];

const programMemoryCache = new Map();

function getProgramStorageKey(levelId, isPreview) {
  return isPreview ? 'lamplighter-preview-program' : `lamplighter-program-${levelId}`;
}

function loadSavedProgram(levelId, isPreview) {
  const key = getProgramStorageKey(levelId, isPreview);
  if (programMemoryCache.has(key)) return structuredClone(programMemoryCache.get(key));
  try {
    const storage = isPreview ? sessionStorage : localStorage;
    const raw = storage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      programMemoryCache.set(key, structuredClone(parsed));
      return parsed;
    }
  } catch {}
  return null;
}

function saveProgram(levelId, isPreview, programData) {
  const key = getProgramStorageKey(levelId, isPreview);
  if (programData && (programData.blocks?.length || programData.functions?.length || programData.lists?.length)) {
    const clone = structuredClone(programData);
    programMemoryCache.set(key, clone);
    try {
      const storage = isPreview ? sessionStorage : localStorage;
      storage.setItem(key, JSON.stringify(clone));
    } catch {}
  } else {
    programMemoryCache.delete(key);
    try {
      const storage = isPreview ? sessionStorage : localStorage;
      storage.removeItem(key);
    } catch {}
  }
}

let gameSettings = {
  footerDayText: 'Місто чекає на твою програму.',
  footerNightText: 'Ніч чекає на твою програму.',
  developerText: ''
};

function updateFooter(t = currentTheme) {
  const footer = document.querySelector('footer');
  if (!footer) return;
  const quote =
    t === 'light'
      ? gameSettings.footerDayText || 'Місто чекає на твою програму.'
      : gameSettings.footerNightText || 'Ніч чекає на твою програму.';
  const dev = gameSettings.developerText
    ? `<div class="footer-developer">${esc(gameSettings.developerText)}</div>`
    : '';
  footer.innerHTML = `<div class="footer-quote">${esc(quote)}</div>${dev}`;
}

const themeBtn = document.querySelector('#theme');

function applyTheme(t) {
  currentTheme = t;
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem('lamplighter-theme', t);
  } catch {}
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', t === 'light' ? '#f8f9fa' : '#101820');
  updateFooter(t);
  if (themeBtn) {
    themeBtn.textContent = t === 'light' ? '☀️ Тема: День' : '🌙 Тема: Ніч';
    themeBtn.setAttribute('aria-pressed', String(t === 'light'));
  }
}
applyTheme(currentTheme);

if (themeBtn) {
  themeBtn.onclick = () => {
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
    route();
  };
}

function completed() {
  try {
    return JSON.parse(localStorage.getItem('lamplighter-completed') || '[]');
  } catch {
    return [];
  }
}

function complete(id) {
  try {
    localStorage.setItem(
      'lamplighter-completed',
      JSON.stringify([...new Set([...completed(), id])])
    );
  } catch {}
}

const resetProgressBtn = document.querySelector('#reset-progress');
if (resetProgressBtn) {
  resetProgressBtn.onclick = () => {
    const done = completed();
    const countInfo = done.length
      ? ` (пройдено ${done.length} ${done.length === 1 ? 'рівень' : 'рівнів'})`
      : '';
    const msg = `Ви впевнені, що хочете повністю скинути весь прогрес гри${countInfo}?\n\nВсі відмітки пройдених вулиць буде видалено, а наступні розділи знову повернуться під замок.`;

    if (confirm(msg)) {
      try {
        localStorage.removeItem('lamplighter-completed');
        programMemoryCache.clear();
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('lamplighter-program-')) toRemove.push(k);
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
      route();
    }
  };
}

async function load() {
  try {
    try {
      const setRes = await fetch('./levels/settings.json', { cache: 'no-store' });
      if (setRes.ok) {
        const s = await setRes.json();
        if (s) gameSettings = { ...gameSettings, ...s };
        updateFooter(currentTheme);
      }
    } catch {}

    try {
      const catRes = await fetch('./levels/categories.json', { cache: 'no-store' });
      if (catRes.ok) currentCategories = await catRes.json();
    } catch {}

    const response = await fetch('./levels/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Не вдалося відкрити список рівнів.');
    const ids = await response.json();

    levels = await Promise.all(
      ids.map(async (id) => {
        if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Некоректний ID рівня');
        const r = await fetch(`./levels/${id}.json`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`Не знайдено рівень ${id}`);
        const l = await r.json();
        const errors = validateLevel(l);
        if (errors.length) throw new Error(`${id}: ${errors.join(' ')}`);
        return l;
      })
    );
    route();
  } catch (e) {
    app.innerHTML = `<div class="panel"><h2>Не вдалося завантажити рівні</h2><p>${esc(e.message)}</p><p>Локально запусти <code>node server.cjs</code> та відкрий localhost:5173.</p></div>`;
  }
}

function route() {
  cleanup();
  cleanup = () => {};

  const resetBtn = document.querySelector('#reset-progress');
  const id = new URLSearchParams(location.hash.slice(1)).get('level');

  if (id === 'preview') {
    if (resetBtn) resetBtn.style.display = 'none';
    try {
      const level = JSON.parse(sessionStorage.getItem('lamplighter-preview'));
      const errors = validateLevel(level);
      if (errors.length) throw new Error(errors.join(' '));
      cleanup = startGame(app, level, true, {
        currentTheme,
        gameSettings,
        loadSavedProgram,
        saveProgram,
        complete,
        getNextLevel: (levelId) => findNextLevel(levels, currentCategories, completed(), levelId),
        effects
      });
    } catch (e) {
      app.innerHTML = `<div class="panel"><h2>Немає рівня для тестування</h2><p>${esc(e.message)}</p><a href="./admin/">Повернутися в редактор</a></div>`;
    }
    return;
  }

  const l = levels.find((item) => item.id === id);
  if (l) {
    if (resetBtn) resetBtn.style.display = 'none';
    if (l.hidden) {
      app.innerHTML = `
        <div class="panel" style="max-width:540px;margin:50px auto;text-align:center;padding:36px 28px">
          <div style="font-size:44px;margin-bottom:12px">👁</div>
          <h2>Цей рівень приховано</h2>
          <p>Вулиця «${esc(l.name)}» наразі прихована в редакторі або знаходиться на оновленні.</p>
          <div style="margin-top:24px"><a href="#" class="primary" style="display:inline-block;padding:11px 24px;border-radius:9px">Повернутися на головну ↗</a></div>
        </div>`;
      return;
    }

    const done = completed();
    const catsWithLevels = getLevelSections(levels, currentCategories);

    const catIdx = catsWithLevels.findIndex((c) => c.levels.some((lvl) => lvl.id === l.id));
    if (catIdx > 0 && !isCatUnlocked(catIdx, catsWithLevels, done)) {
      const prevCat = catsWithLevels[catIdx - 1];
      app.innerHTML = `
        <div class="panel" style="max-width:540px;margin:50px auto;text-align:center;padding:36px 28px">
          <div style="font-size:44px;margin-bottom:12px">🔒</div>
          <h2>Цей рівень під замком</h2>
          <p>Щоб відкрити вулицю «${esc(l.name)}», спочатку пройди всі завдання теми <strong>«${esc(prevCat.title)}»</strong>.</p>
          <div style="margin-top:24px"><a href="#" class="primary" style="display:inline-block;padding:11px 24px;border-radius:9px">Повернутися на головну ↗</a></div>
        </div>`;
      return;
    }

    cleanup = startGame(app, l, false, {
      currentTheme,
      gameSettings,
      loadSavedProgram,
      saveProgram,
      complete,
      getNextLevel: (levelId) => findNextLevel(levels, currentCategories, completed(), levelId),
      effects
    });
  } else {
    if (resetBtn) resetBtn.style.display = '';
    renderHome(app, {
      levels,
      categories: currentCategories,
      done: completed(),
      currentTheme
    });
  }
}

window.addEventListener('hashchange', route);
load();
