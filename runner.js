import {
  initialState,
  lampCount,
  won,
  step,
  validateProgram,
  createMemory,
  executeProgram,
  getCommandInfo,
  getLevelDescription,
  ElectricShockError
} from './logic.mjs';
import { World } from './scene.js';
import { ProgramEditor } from './program.js';
import { setupGameHints } from './game-hints.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function spawnConfetti(container) {
  const colors = ['#edc17c', '#73c6bb', '#91b9ef', '#e69a9a', '#c5a2e8', '#f1e7b0'];
  for (let i = 0; i < 90; i++) {
    const ribbon = document.createElement('i');
    ribbon.className = 'confetti-ribbon';
    ribbon.style.setProperty('--x', `${Math.random() * 100}%`);
    ribbon.style.setProperty('--delay', `${Math.random() * 0.9}s`);
    ribbon.style.setProperty('--duration', `${1.9 + Math.random() * 1.1}s`);
    ribbon.style.setProperty('--sway', `${-90 + Math.random() * 180}px`);
    ribbon.style.setProperty('--spin', `${Math.random() < 0.5 ? '-' : ''}${360 + Math.random() * 720}deg`);
    ribbon.style.setProperty('--flip', `${Math.random() * 540}deg`);
    ribbon.style.setProperty('--width', `${4 + Math.random() * 5}px`);
    ribbon.style.setProperty('--height', `${16 + Math.random() * 20}px`);
    ribbon.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.append(ribbon);
    setTimeout(() => ribbon.remove(), 4300);
  }
}

export function startGame(container, l, preview, options) {
  const {
    currentTheme,
    gameSettings,
    getNextLevel,
    loadSavedProgram,
    saveProgram,
    complete,
    effects
  } = options;

  document.body.classList.add('in-game');

  const headingEyebrow =
    currentTheme === 'light' ? 'ВИКРУТИ КОЖЕН ЛІХТАР' : 'ЗАПАЛИ КОЖЕН ЛІХТАР';
  const headingDesc = esc(getLevelDescription(l, currentTheme));
  const isAdvanced = l.allowed.some((c) =>
    ['if', 'while', 'call'].includes(c)
  );

  container.innerHTML = `
    <div class="game-top-bar">
      <a class="game-back-btn" href="${preview ? './admin/' : '#'}">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        <span>${preview ? 'До редактора' : 'Всі теми'}</span>
      </a>
      <div class="game-level-name">${esc(l.name)}</div>
      <button id="help-open" class="game-help-open" type="button" aria-label="Відкрити підказки">? Підказка</button>
    </div>
    <div id="help-card" class="game-help-card" hidden>
      <div class="game-help-heading"><strong>Як грати</strong><span id="help-count"></span></div>
      <p id="help-text" aria-live="polite"></p>
      <div class="game-help-actions">
        <button id="help-close" type="button">Закрити</button>
        <button id="help-next" type="button" class="primary">Далі</button>
      </div>
    </div>
    <div class="game-layout ${isAdvanced ? 'advanced-level' : ''}">
      <section class="world">
        <div id="scene" class="scene" role="img" aria-label="3D-поле з ліхтарником, деревами та ліхтарями">
          <div class="world-heading">
            <span class="eyebrow">${headingEyebrow}</span>
            <p>${headingDesc}</p>
          </div>
          <div class="scene-tools">
            <button id="reset-view" aria-label="Початкове положення поля" title="Початкове положення">⌂</button>
            <button id="zoom-out" aria-label="Зменшити масштаб">−</button>
            <span id="zoom-value">100%</span>
            <button id="zoom-in" aria-label="Збільшити масштаб">+</button>
            <button id="speed-btn" class="speed-btn" title="Швидкість анімації">1×</button>
          </div>
          <div class="world-bottom">
            <span id="lamps" class="lamp-count"></span>
            <span>Погляд персонажа = напрямок руху</span>
          </div>
        </div>
      </section>
      <aside class="program-panel">
        <div id="win" class="win" hidden></div>
        <div class="program-run-bar">
          <button id="run" class="primary" aria-label="Запустити програму">
            <span class="run-icon">▶</span> <span>Запустити</span>
          </button>
          <button id="reset" aria-label="Скинути програму" title="Скинути програму">↺</button>
        </div>
        <div class="section-label"><span id="count" class="count"></span></div>
        <div id="program" class="program" aria-label="Програма"></div>
        <div class="program-actions">
          <button id="trash" class="trash-zone" aria-label="Перемістіть сюди команду для видалення" title="Видалити команду">🗑</button>
        </div>
        <div class="section-label available-commands">Доступні команди <span class="count">${l.allowed.length}</span></div>
        <div id="palette" class="palette"></div>
        <p id="status" class="status" role="status" aria-live="polite"></p>
      </aside>
    </div>
  `;

  const $ = (s) => container.querySelector(s);
  let state = initialState(l, currentTheme);
  let token = 0;
  let running = false;
  let world;

  try {
    world = new World($('#scene'), l, state, currentTheme);
  } catch {
    $('#scene').textContent = 'Для 3D потрібен WebGL. Увімкни апаратне прискорення браузера.';
    $('#run').disabled = true;
    return () => { document.body.classList.remove('in-game'); };
  }

  const savedProgram = loadSavedProgram(l.id, preview);
  const editor = new ProgramEditor(
    $('#palette'),
    $('#program'),
    $('#count'),
    l,
    $('#trash'),
    currentTheme,
    savedProgram
  );

  const help = setupGameHints(container, l, preview);
  editor.onChange = (data) => {
    saveProgram(l.id, preview, data);
    help.refresh();
  };

  $('#trash').onclick = () => {
    if (editor.blocks.length && confirm('Очистити всі складені блоки програми?')) {
      editor.clear();
      saveProgram(l.id, preview, null);
    }
  };

  const status = (text, kind = '') => {
    $('#status').textContent = text;
    $('#status').className = 'status ' + kind;
  };

  const meter = () => {
    let text = '';
    if (currentTheme === 'light') {
      text = `💡 ${lampCount(l) - state.lit.length} / ${lampCount(l)} вимкнено`;
    } else {
      text = `☀ ${state.lit.length} / ${lampCount(l)} увімкнено`;
    }
    if ((state.repairKits || 0) > 0 || (l.repairKits || 0) > 0 || (state.kits && state.kits.length > 0)) {
      text += ` · 🔧 ${state.repairKits || 0} ремкомплектів`;
    }
    if ((state.carriedBulbs || 0) > 0 || (state.bulbs && state.bulbs.length > 0)) {
      text += ` · 💡 ${state.carriedBulbs || 0} лампочок`;
    }
    $('#lamps').textContent = text;
  };
  meter();

  const updateZoom = () => {
    $('#zoom-value').textContent = `${Math.round(world.zoom * 100)}%`;
  };
  $('#reset-view').onclick = () => world.resetView();
  $('#zoom-out').onclick = () => {
    world.setZoom(world.zoom - 0.1);
    updateZoom();
  };
  $('#zoom-in').onclick = () => {
    world.setZoom(world.zoom + 0.1);
    updateZoom();
  };
  world.onZoom = updateZoom;

  const speedSteps = [0.5, 1, 2, 3];
  const speedLabels = ['0.5×', '1×', '2×', '3×'];
  const savedSpeed = Number(localStorage.getItem('lamplighter-speed'));
  let speedIdx = speedSteps.indexOf(savedSpeed);
  if (speedIdx < 0) speedIdx = 1;
  const speedBtn = $('#speed-btn');

  function applySpeed() {
    world.speed = speedSteps[speedIdx];
    speedBtn.textContent = speedLabels[speedIdx];
    try {
      localStorage.setItem('lamplighter-speed', speedSteps[speedIdx]);
    } catch {}
  }
  applySpeed();
  speedBtn.onclick = () => {
    speedIdx = (speedIdx + 1) % speedSteps.length;
    applySpeed();
  };

  function reset() {
    token++;
    running = false;
    state = initialState(l, currentTheme);
    world.setState(state);
    editor.active = null;
    editor.lock(false);
    $('#run').disabled = false;
    $('#win').hidden = true;
    meter();
    status('На старті. Програму збережено — спробуй ще.');
  }
  $('#reset').onclick = reset;

  $('#run').onclick = async () => {
    help.close();
    if (running) return;
    let memory;

    try {
      validateProgram(l, editor.blocks, editor.functions);
      memory = createMemory();
    } catch (e) {
      status(e.message, 'error');
      if (!editor.blocks.length) {
        effects.angry?.();
        const runToken = ++token;
        $('#run').disabled = true;
        try {
          await world.frustrated(() => token !== runToken);
        } finally {
          if (token === runToken) $('#run').disabled = false;
        }
      }
      return;
    }

    reset();
    const runToken = token;
    let failed = false;
    let solved = false;
    running = true;
    editor.lock(true);
    $('#run').disabled = true;

    const execution = executeProgram(l, editor.blocks, editor.functions, () => state, memory);

    try {
      for (const block of execution) {
        if (token !== runToken) return;
        editor.highlight(block.id);
        status(getCommandInfo(block.type, currentTheme)[1]);

        if (block.control) {
          await wait(30);
          continue;
        }

        try {
          const next = step(l, state, block.type);
          if (block.type === 'forward') {
            effects.step?.();
          } else if (block.type === 'left' || block.type === 'right') {
            effects.turn?.();
          } else if (block.type === 'jump') {
            effects.jump?.();
          } else if (block.type === 'take') {
            effects.pickup?.();
          } else if (block.type === 'fix') {
            effects.repair?.();
          } else if (block.type === 'call') {
            effects.call?.();
          } else if (block.type === 'light') {
            const turnedOn = next.lit.includes(`${state.x},${state.z}`);
            if (turnedOn) effects.light?.();
            else effects.unscrew?.();
          }

          if (!(await world.animate(next, block.type, () => token !== runToken))) return;
          state = next;
          meter();

          if (won(l, state)) {
            solved = true;
            if (!preview) complete(l.id);
            effects.win();
            if (!(await world.celebrate(() => token !== runToken))) return;
            spawnConfetti($('#scene'));

            const successMsg =
              currentTheme === 'light'
                ? 'Усі лампочки викручено! Місто зберегло енергію.'
                : 'Усі ліхтарі світяться. Гарна робота!';
            status(successMsg, 'success');

            const nextLevel = getNextLevel(l.id);
            const winLink = preview
              ? '<a class="next-street" href="./admin/">← Повернутися до редактора</a>'
              : nextLevel
              ? '<a class="next-street" href="#level=' + nextLevel.id + '">Наступна вулиця →</a>'
              : '<a class="next-street" href="#">До всіх тем →</a>';
            $('#win').innerHTML = winLink;
            $('#win').hidden = false;
            $('#win').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            break;
          }
        } catch (e) {
          failed = true;
          if (e.message.startsWith('Попереду немає плитки.')) {
            effects.fall?.();
            await world.fall(state, () => token !== runToken);
            if (token !== runToken) return;
            world.robot.visible = false;
            state = initialState(l, currentTheme);
            world.setState(state);
            meter();
            editor.highlight(null);
            await wait(80);
            world.robot.visible = true;
            status('Персонаж вийшов за межі та впав.', 'error');
            await wait(1800);
            if (token === runToken) status('На старті. Спробуй ще раз.', 'error');
          } else if (e instanceof ElectricShockError) {
            effects.shock?.();
            status(e.message, 'error');
            if (!(await world.shocked(() => token !== runToken))) return;
            await wait(900);
            if (token === runToken) {
              state = initialState(l, currentTheme);
              world.setState(state);
              meter();
              editor.highlight(null);
              status('Персонаж повернувся на старт. Спершу полагодь іскристий ліхтар.', 'error');
            }
          } else {
            effects.angry?.();
            status(e.message, 'error');
            if (!(await world.frustrated(() => token !== runToken))) return;
            await wait(2000);
            if (token === runToken) {
              state = initialState(l, currentTheme);
              world.setState(state);
              meter();
              editor.highlight(null);
              status('Персонаж повернувся на старт.', 'error');
            }
          }
          break;
        }
      }
    } catch (e) {
      failed = true;
      status(e.message, 'error');
    }

    if (token === runToken && !failed && !solved) {
      const incompleteMsg =
        currentTheme === 'light'
          ? 'Програма завершилася, але ще не всі лампочки викручено. Доповни її.'
          : 'Програма завершилася, але ще не всі ліхтарі світяться. Доповни її.';
      status(incompleteMsg);
      await wait(2000);
      if (token === runToken) {
        state = initialState(l, currentTheme);
        world.setState(state);
        meter();
        status('На старті. Спробуй іншу програму.');
      }
    }

    if (token === runToken) {
      running = false;
      editor.lock(false);
      $('#run').disabled = false;
    }
  };

  return () => {
    help.close();
    document.body.classList.remove('in-game');
    token++;
    editor.dnd.endDrag();
    saveProgram(l.id, preview, editor.getProgram());
    world.dispose();
  };
}
