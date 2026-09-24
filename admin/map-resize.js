import { applyDimensions as validateDimensions } from './map-editor.js';

export function resizeLevel(level, w, d, onStatus) {
  if (!validateDimensions(level, w, d, onStatus)) return null;
  if (level.width === w && level.depth === d) {
    return { success: true, changed: false, shiftX: 0, shiftZ: 0, startRelocated: false };
  }

  const oldW = level.width;
  const oldD = level.depth;
  const hasHoles = level.cells.some((row) => row.some((c) => c === null));

  let shiftX = 0;
  let shiftZ = 0;
  let startRelocated = false;

  const anchorObjects = [];
  for (let z = 0; z < oldD; z++) {
    for (let x = 0; x < oldW; x++) {
      const c = level.cells[z]?.[x];
      if (c && (c.lamp || c.house || c.tree || c.height > 0 || (hasHoles && c !== null))) {
        anchorObjects.push({ x, z });
      }
    }
  }

  if (anchorObjects.length > 0) {
    const minObjX = Math.min(...anchorObjects.map((p) => p.x));
    const minObjZ = Math.min(...anchorObjects.map((p) => p.z));
    if (w < oldW) shiftX = Math.min(minObjX, oldW - w);
    if (d < oldD) shiftZ = Math.min(minObjZ, oldD - d);
  } else {
    const startPt = level.start || { x: 0, z: 0 };
    if (w < oldW) shiftX = Math.min(Math.max(0, startPt.x - w + 1), Math.max(0, oldW - w));
    if (d < oldD) shiftZ = Math.min(Math.max(0, startPt.z - d + 1), Math.max(0, oldD - d));
  }

  const newCells = Array.from({ length: d }, (_, z) =>
    Array.from({ length: w }, (_, x) => {
      const srcZ = z + shiftZ;
      const srcX = x + shiftX;
      if (srcZ >= 0 && srcZ < oldD && srcX >= 0 && srcX < oldW) {
        return level.cells[srcZ][srcX] ? { ...level.cells[srcZ][srcX] } : null;
      }
      return { height: 0, tree: false, lamp: false, house: false, lit: false };
    })
  );

  let newStartX = level.start.x - shiftX;
  let newStartZ = level.start.z - shiftZ;
  const isValidStart = (x, z) => {
    if (x < 0 || x >= w || z < 0 || z >= d) return false;
    const c = newCells[z]?.[x];
    return !!c && !c.tree;
  };

  if (!isValidStart(newStartX, newStartZ)) {
    startRelocated = true;
    const clampedX = Math.max(0, Math.min(w - 1, newStartX));
    const clampedZ = Math.max(0, Math.min(d - 1, newStartZ));

    if (isValidStart(clampedX, clampedZ)) {
      newStartX = clampedX;
      newStartZ = clampedZ;
    } else {
      let bestX = -1;
      let bestZ = -1;
      let bestDist = Infinity;
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < w; x++) {
          if (isValidStart(x, z)) {
            const hasLamp = !!newCells[z][x].lamp;
            const dist = Math.hypot(x - clampedX, z - clampedZ) + (hasLamp ? 2 : 0);
            if (dist < bestDist) {
              bestDist = dist;
              bestX = x;
              bestZ = z;
            }
          }
        }
      }
      if (bestX !== -1) {
        newStartX = bestX;
        newStartZ = bestZ;
      } else {
        newStartX = clampedX;
        newStartZ = clampedZ;
        newCells[newStartZ][newStartX] = { height: 0, tree: false, lamp: false, house: false, lit: false };
      }
    }
  }

  level.cells = newCells;
  level.width = w;
  level.depth = d;
  level.start = {
    x: newStartX,
    z: newStartZ,
    dir: level.start.dir ?? 0
  };

  return {
    success: true,
    changed: true,
    shiftX,
    shiftZ,
    startRelocated,
    newStartX,
    newStartZ
  };
}

export function setupSizeMatrix({ matrixEl, previewBadgeEl, infoEl, getLevel, onResize }) {
  if (!matrixEl) return { render: () => {} };

  matrixEl.replaceChildren();
  for (let d = 1; d <= 10; d++) {
    for (let w = 1; w <= 10; w++) {
      const cell = document.createElement('div');
      cell.className = 'size-cell';
      cell.dataset.w = w;
      cell.dataset.d = d;
      cell.title = w < 2 || d < 2 ? 'Мінімальний розмір — 2 × 2' : `${w} × ${d}`;
      if (w < 2 || d < 2) {
        cell.classList.add('unavailable');
        cell.setAttribute('aria-disabled', 'true');
      }
      matrixEl.append(cell);
    }
  }

  function render(hoverW = null, hoverD = null) {
    const level = getLevel();
    const activeW = level?.width || 4;
    const activeD = level?.depth || 4;
    const displayW = hoverW !== null ? hoverW : activeW;
    const displayD = hoverD !== null ? hoverD : activeD;

    if (previewBadgeEl) previewBadgeEl.textContent = `${displayW} × ${displayD}`;
    if (infoEl) {
      infoEl.textContent =
        hoverW !== null
          ? `Клікни або відпусти, щоб обрати ${displayW} × ${displayD}`
          : 'Виділи прямокутник мишкою (від 2×2 до 10×10)';
    }

    matrixEl.querySelectorAll('.size-cell').forEach((cell) => {
      const cw = +cell.dataset.w;
      const cd = +cell.dataset.d;
      const inActive = cw <= activeW && cd <= activeD;
      const inHover = hoverW !== null && cw <= hoverW && cd <= hoverD;
      cell.classList.toggle('selected', inActive);
      cell.classList.toggle('hovered', inHover);
    });
  }

  const getTargetCoords = (e) => {
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.size-cell');
    if (!cell || !matrixEl.contains(cell)) return null;
    if (+cell.dataset.w < 2 || +cell.dataset.d < 2) return null;
    return {
      w: Math.max(2, Math.min(10, +cell.dataset.w)),
      d: Math.max(2, Math.min(10, +cell.dataset.d))
    };
  };

  let isMatrixDragging = false;
  let didResizeOnPointerUp = false;

  matrixEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const coords = getTargetCoords(e);
    if (!coords) return;
    e.preventDefault();
    matrixEl.setPointerCapture(e.pointerId);
    isMatrixDragging = true;
    render(coords.w, coords.d);
  });

  matrixEl.addEventListener('pointermove', (e) => {
    const coords = getTargetCoords(e);
    if (coords) {
      render(coords.w, coords.d);
    } else if (!isMatrixDragging) {
      render();
    }
  });

  matrixEl.addEventListener('pointerleave', () => {
    if (!isMatrixDragging) render();
  });

  matrixEl.addEventListener('pointerup', (e) => {
    if (!isMatrixDragging) return;
    isMatrixDragging = false;
    const coords = getTargetCoords(e);
    if (coords) {
      didResizeOnPointerUp = true;
      onResize(coords.w, coords.d);
      setTimeout(() => { didResizeOnPointerUp = false; }, 60);
    }
    render();
  });

  matrixEl.addEventListener('click', (e) => {
    if (didResizeOnPointerUp) return;
    const coords = getTargetCoords(e);
    if (coords) {
      onResize(coords.w, coords.d);
    }
  });

  return { render };
}
