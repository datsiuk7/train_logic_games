import { categories } from '../logic.mjs';

export function createFreshLevel(defaultAllowed = null) {
  const allowed = defaultAllowed || [...categories[0].allowedCommands];
  return {
    id: '',
    name: '',
    description: '',
    descriptionNight: '',
    descriptionDay: '',
    category: '',
    width: 4,
    depth: 4,
    start: { x: 0, z: 3, dir: 0 },
    allowed,
    hints: [],
    limit: 0,
    repairKits: 0,
    cells: Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ({
        height: 0,
        tree: false,
        lamp: false,
        house: false,
        bulb: false,
        kit: false,
        spark: false,
        lit: false
      }))
    )
  };
}

export function loadDraft(freshLevel) {
  try {
    const raw = localStorage.getItem('lamplighter-draft');
    if (!raw) return { level: freshLevel, dirty: false, savedId: null };
    const draft = JSON.parse(raw);
    if (
      draft?.level &&
      Array.isArray(draft.level.cells) &&
      !(
        !draft.savedId &&
        !draft.dirty &&
        draft.level.cells.flat().every((c) => c === null)
      )
    ) {
      return {
        level: draft.level,
        dirty: draft.dirty ?? false,
        savedId: draft.savedId ?? null
      };
    }
  } catch {}
  return { level: freshLevel, dirty: false, savedId: null };
}

export function saveDraft(level, dirty, savedId) {
  try {
    localStorage.setItem(
      'lamplighter-draft',
      JSON.stringify({ level, dirty, savedId })
    );
  } catch {}
}

export class LevelHistory {
  constructor(maxSize = 40) {
    this.history = [];
    this.future = [];
    this.maxSize = maxSize;
  }

  checkpoint(level) {
    this.history.push(JSON.stringify(level));
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
    this.future = [];
  }

  undo(currentLevel = null) {
    if (!this.history.length) return null;
    if (currentLevel) {
      this.future.push(JSON.stringify(currentLevel));
      if (this.future.length > this.maxSize) this.future.shift();
    }
    return JSON.parse(this.history.pop());
  }

  redo(currentLevel = null) {
    if (!this.future.length) return null;
    if (currentLevel) {
      this.history.push(JSON.stringify(currentLevel));
      if (this.history.length > this.maxSize) this.history.shift();
    }
    return JSON.parse(this.future.pop());
  }

  clear() {
    this.history = [];
    this.future = [];
  }

  get length() {
    return this.history.length;
  }

  get canUndo() {
    return this.history.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}
