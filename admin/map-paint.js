import { cellAt, refreshCell } from './map-editor.js';

export function formatCellInfo(level, x, z) {
  const cell = level?.cells?.[z]?.[x];
  if (!cell) return `· ${x + 1}, ${z + 1} · порожньо`;
  let extra = '';
  if (cell.lamp) {
    extra = cell.needsBulb
      ? ' · ліхтар 💡❌ без лампочки (потрібна лампочка)'
      : cell.spark
      ? ' · ліхтар ⚡ іскрить (коротить)'
      : cell.lit === true
      ? ' · ліхтар ✦ ввімкнений (вночі)'
      : ' · ліхтар ● вимкнений (вночі)';
  } else if (cell.house) {
    const hd = Number.isInteger(cell.dir) ? cell.dir : 2;
    extra = ` · будиночок (${['двері на північ ↑', 'двері на схід →', 'двері на південь ↓', 'двері на захід ←'][hd]})${cell.lit === true ? ' ✦ світло ввімкнено (вночі)' : ' ● світло вимкнено (вночі)'}`;
  } else if (cell.bulb) {
    extra = ' · запасна лампочка 💡';
  } else if (cell.kit) {
    extra = ' · комплект ремонту 🔧';
  } else if (cell.tree) {
    extra = ' · дерево 🌲';
  } else if (cell.bush) {
    extra = ' · кущ 🌿';
  } else if (cell.rock) {
    extra = ' · камінь 🪨';
  } else if (cell.box) {
    extra = ' · коробка 📦 (можна штовхати або вистрибнути)';
  }
  return `· ${x + 1}, ${z + 1} · висота ${cell.height}${extra}`;
}

export function paintCell({
  level,
  x,
  z,
  tool,
  height,
  lampState,
  lampLitState,
  houseDir,
  setLampState,
  setLampLitState,
  setHouseDir,
  onStatus,
  onCheckpoint,
  onDirty,
  onRefreshCell,
  isStrokeActive,
  markStrokeActive
}) {
  const start = level.start.x === x && level.start.z === z;
  const oldStart = { ...level.start };
  let c = level.cells[z]?.[x];
  let next = c ? { ...c } : null;

  let targetLampState = lampState ?? (lampLitState === true ? 'on' : lampLitState === false ? 'off' : 'off');

  if (tool === 'empty') {
    if (start) {
      onStatus('Спочатку перенеси старт на іншу плитку.', true);
      return false;
    }
    next = null;
  } else if (tool === 'terrain') {
    next = {
      height,
      tree: c?.tree || false,
      bush: c?.bush || false,
      rock: c?.rock || false,
      box: c?.box || false,
      lamp: c?.lamp || false,
      house: c?.house || false,
      bulb: c?.bulb || false,
      kit: c?.kit || false,
      spark: c?.spark || false,
      needsBulb: c?.needsBulb || false,
      dir: c?.house ? c?.dir ?? 2 : undefined,
      lit: c?.lamp || c?.house ? Boolean(c?.lit) : false
    };
  } else if (tool === 'start') {
    if (!c || c.tree || c.bush || c.rock || c.box) {
      onStatus('Старт має бути на вільній плитці без перешкод.', true);
      return false;
    }
    if (start) return false;
  } else if (tool === 'erase') {
    if (!c) return false;
    next = { ...c, tree: false, bush: false, rock: false, box: false, lamp: false, house: false, bulb: false, kit: false, spark: false, needsBulb: false, dir: undefined, lit: false };
  } else if (tool === 'tree') {
    if (!c || start || c.lamp || c.house || c.bulb || c.kit) {
      onStatus('Дерево потребує плитки без ліхтаря, будинку, старту чи предметів.', true);
      return false;
    }
    next = { ...c, tree: true, bush: false, rock: false, box: false, lamp: false, house: false, bulb: false, kit: false, spark: false, needsBulb: false, dir: undefined, lit: false };
  } else if (tool === 'bush') {
    if (!c || start || c.lamp || c.house || c.bulb || c.kit) {
      onStatus('Кущ потребує плитки без ліхтаря, будинку, старту чи предметів.', true);
      return false;
    }
    next = { ...c, bush: true, tree: false, rock: false, box: false, lamp: false, house: false, bulb: false, kit: false, spark: false, needsBulb: false, dir: undefined, lit: false };
  } else if (tool === 'rock') {
    if (!c || start || c.lamp || c.house || c.bulb || c.kit) {
      onStatus('Камінь потребує плитки без ліхтаря, будинку, старту чи предметів.', true);
      return false;
    }
    next = { ...c, rock: true, tree: false, bush: false, box: false, lamp: false, house: false, bulb: false, kit: false, spark: false, needsBulb: false, dir: undefined, lit: false };
  } else if (tool === 'box') {
    if (!c || start || c.lamp || c.house || c.bulb || c.kit) {
      onStatus('Коробка потребує плитки без ліхтаря, будинку, старту чи предметів.', true);
      return false;
    }
    next = { ...c, box: true, tree: false, bush: false, rock: false, lamp: false, house: false, bulb: false, kit: false, spark: false, needsBulb: false, dir: undefined, lit: false };
  } else if (tool === 'bulb') {
    if (!c || start || c.tree || c.bush || c.rock || c.box || c.lamp || c.house) {
      onStatus('Лампочка потребує плитки без старту, перешкод, ліхтаря чи будинку.', true);
      return false;
    }
    next = { ...c, bulb: true, kit: false, tree: false, bush: false, rock: false, box: false, lamp: false, house: false, spark: false, needsBulb: false, dir: undefined, lit: false };
  } else if (tool === 'kit') {
    if (!c || start || c.tree || c.bush || c.rock || c.box || c.lamp || c.house) {
      onStatus('Комплект ремонту потребує плитки без старту, перешкод, ліхтаря чи будинку.', true);
      return false;
    }
    next = { ...c, kit: true, bulb: false, tree: false, bush: false, rock: false, box: false, lamp: false, house: false, spark: false, needsBulb: false, dir: undefined, lit: false };
  } else if (tool === 'lamp') {
    if (!c || c.tree || c.bush || c.rock || c.box) {
      onStatus('Ліхтар потребує плитки без перешкод.', true);
      return false;
    }
    if (c.lamp) {
      const current = c.needsBulb ? 'no-bulb' : c.spark ? 'spark' : c.lit ? 'on' : 'off';
      const order = ['off', 'on', 'spark', 'no-bulb'];
      const nextState = current === targetLampState ? order[(order.indexOf(current) + 1) % order.length] : targetLampState;
      next = {
        ...c,
        lamp: true,
        house: false,
        bulb: false,
        kit: false,
        dir: undefined,
        lit: nextState === 'on',
        spark: nextState === 'spark',
        needsBulb: nextState === 'no-bulb'
      };
      if (setLampState) setLampState(nextState);
      else if (setLampLitState) setLampLitState(nextState === 'on');
    } else {
      next = {
        ...c,
        lamp: true,
        house: false,
        bulb: false,
        kit: false,
        dir: undefined,
        lit: targetLampState === 'on',
        spark: targetLampState === 'spark',
        needsBulb: targetLampState === 'no-bulb'
      };
    }
  } else if (tool === 'house') {
    if (!c || c.tree || c.bush || c.rock || c.box) {
      onStatus('Будинок потребує плитки без перешкод.', true);
      return false;
    }
    const houseLit = targetLampState === 'on';
    if (c.house) {
      let nextDir = houseDir;
      const currentDir = Number.isInteger(c.dir) ? c.dir : 2;
      if (currentDir === houseDir) {
        nextDir = (houseDir + 1) % 4;
        if (setHouseDir) setHouseDir(nextDir);
      }
      next = { ...c, house: true, lamp: false, bulb: false, kit: false, spark: false, dir: nextDir, lit: houseLit };
    } else {
      next = { ...c, house: true, lamp: false, bulb: false, kit: false, spark: false, dir: houseDir, lit: houseLit };
    }
  }

  if (tool !== 'start' && JSON.stringify(next) === JSON.stringify(c)) return false;

  if (!isStrokeActive()) {
    onCheckpoint();
    markStrokeActive();
  }

  if (tool === 'start') {
    level.start = { x, z, dir: level.start.dir };
  } else {
    level.cells[z][x] = next;
  }

  onStatus('');
  onDirty();
  onRefreshCell(x, z);
  if (tool === 'start') {
    onRefreshCell(oldStart.x, oldStart.z);
  }
  return true;
}

export class MapGridController {
  constructor({
    gridEl,
    infoEl,
    getLevel,
    getTool,
    getHeight,
    getLampState,
    setLampState,
    getLampLitState,
    setLampLitState,
    getHouseDir,
    setHouseDir,
    onStatus,
    onCheckpoint,
    onDirty,
    onStoreDraft
  }) {
    this.gridEl = gridEl;
    this.infoEl = infoEl;
    this.getLevel = getLevel;
    this.getTool = getTool;
    this.getHeight = getHeight;
    this.getLampState = getLampState || getLampLitState;
    this.setLampState = setLampState || setLampLitState;
    this.getHouseDir = getHouseDir;
    this.setHouseDir = setHouseDir;
    this.onStatus = onStatus;
    this.onCheckpoint = onCheckpoint;
    this.onDirty = onDirty;
    this.onStoreDraft = onStoreDraft;

    this.painting = false;
    this.strokeStarted = false;
    this.visited = new Set();
    this.previousPoint = null;

    this.bindEvents();
  }

  paint(x, z) {
    const id = `${x},${z}`;
    if (this.visited.has(id)) return;
    this.visited.add(id);

    paintCell({
      level: this.getLevel(),
      x,
      z,
      tool: this.getTool(),
      height: this.getHeight(),
      lampState: this.getLampState ? this.getLampState() : 'off',
      houseDir: this.getHouseDir(),
      setLampState: this.setLampState,
      setHouseDir: this.setHouseDir,
      onStatus: this.onStatus,
      onCheckpoint: this.onCheckpoint,
      onDirty: this.onDirty,
      onRefreshCell: (cx, cz) => {
        const cellButton = this.gridEl.querySelector(`[data-x="${cx}"][data-z="${cz}"]`);
        refreshCell(this.getLevel(), cellButton, cx, cz);
      },
      isStrokeActive: () => this.strokeStarted,
      markStrokeActive: () => {
        this.strokeStarted = true;
      }
    });
  }

  hover(b) {
    this.gridEl.querySelector('.hovered')?.classList.remove('hovered');
    if (!b) return;
    b.classList.add('hovered');
    const x = +b.dataset.x;
    const z = +b.dataset.z;
    if (this.infoEl) {
      this.infoEl.textContent = formatCellInfo(this.getLevel(), x, z);
    }
  }

  endStroke() {
    if (this.strokeStarted) this.onStoreDraft();
    this.painting = false;
    this.strokeStarted = false;
    this.visited.clear();
    this.previousPoint = null;
  }

  bindEvents() {
    const grid = this.gridEl;

    grid.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const b = e.target.closest('.edit-cell');
      if (!b) return;
      e.preventDefault();
      grid.setPointerCapture(e.pointerId);
      this.painting = true;
      this.visited.clear();
      this.strokeStarted = false;
      this.previousPoint = [e.clientX, e.clientY];
      this.paint(+b.dataset.x, +b.dataset.z);
      this.hover(b);
    });

    grid.addEventListener('pointermove', (e) => {
      const b = cellAt(grid, e.clientX, e.clientY);
      this.hover(b);
      if (!this.painting) return;
      if (this.getTool() === 'start') return;
      const from = this.previousPoint || [e.clientX, e.clientY];
      const distance = Math.hypot(e.clientX - from[0], e.clientY - from[1]);
      const steps = Math.max(1, Math.ceil(distance / 8));
      for (let i = 1; i <= steps; i++) {
        const c = cellAt(
          grid,
          from[0] + ((e.clientX - from[0]) * i) / steps,
          from[1] + ((e.clientY - from[1]) * i) / steps
        );
        if (c) this.paint(+c.dataset.x, +c.dataset.z);
      }
      this.previousPoint = [e.clientX, e.clientY];
    });

    grid.addEventListener('pointerleave', () => {
      if (!this.painting) {
        this.hover(null);
        if (this.infoEl) this.infoEl.textContent = '· Наведи на клітинку';
      }
    });

    const finish = () => this.endStroke();
    grid.addEventListener('lostpointercapture', finish);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
  }
}
