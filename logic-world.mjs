export const commands = {
  forward: ['↑', 'Вперед'],
  left: ['↶', 'Вліво'],
  right: ['↷', 'Вправо'],
  jump: ['↟', 'Стрибок'],
  light: ['✦', 'Запалити ліхтар'],
  take: ['📥', 'Взяти'],
  fix: ['🔧', 'Полагодити'],
  loop: ['⟳', 'Цикл'],
  if: ['?', 'Якщо · if'],
  while: ['↻', 'Поки · while'],
  call: ['ƒ', 'Функція']
};

export const key = (x, z) => `${x},${z}`;

export const categories = [
  {
    id: 'basics',
    title: '1. Основи руху',
    badge: 'Базові команди',
    icon: '✦',
    description: 'Кроки вперед, повороти стрілками, стрибки, збір речей та запалювання ліхтаря.',
    allowedCommands: ['forward', 'left', 'right', 'jump', 'light', 'take', 'fix']
  },
  {
    id: 'loops',
    title: '2. Цикли',
    badge: 'Повторення дій',
    icon: '⟳',
    description: 'Скорочуй довгі програми та автоматизуй кроки за допомогою циклів.',
    allowedCommands: ['forward', 'left', 'right', 'jump', 'light', 'take', 'fix', 'loop']
  },
  {
    id: 'conditions',
    title: '3. Умови',
    badge: 'Якщо / Інакше',
    icon: '?',
    description: 'Перевіряй наявність ліхтарів, перешкоди та іскріння датчиками та обирай шлях.',
    allowedCommands: ['forward', 'left', 'right', 'jump', 'light', 'take', 'fix', 'loop', 'if', 'while']
  },
  {
    id: 'functions',
    title: '4. Функції',
    badge: 'Підпрограми',
    icon: 'ƒ',
    description: 'Обʼєднуй повторювані дії у власні функції та викликай їх у будь-який момент.',
    allowedCommands: ['forward', 'left', 'right', 'jump', 'light', 'take', 'fix', 'loop', 'if', 'while', 'call']
  }
];

export function getCategory(l) {
  if (l?.category && categories.some((c) => c.id === l.category)) return l.category;
  if (l?.allowed?.includes('call')) return 'functions';
  if (l?.allowed?.some((c) => ['if', 'while'].includes(c))) return 'conditions';
  if (l?.allowed?.includes('loop')) return 'loops';
  return 'basics';
}

export const isLightTarget = (c) => Boolean(c && (c.lamp || c.house));

export const allLamps = (l) =>
  l.cells.flatMap((row, z) => row.map((c, x) => (isLightTarget(c) ? key(x, z) : null)).filter(Boolean));

export const collectBulbs = (l) =>
  l.cells.flatMap((row, z) => row.map((c, x) => (c?.bulb ? key(x, z) : null)).filter(Boolean));

export const collectKits = (l) =>
  l.cells.flatMap((row, z) => row.map((c, x) => (c?.kit ? key(x, z) : null)).filter(Boolean));

export const collectBoxes = (l) =>
  l.cells.flatMap((row, z) => row.map((c, x) => (c?.box ? key(x, z) : null)).filter(Boolean));

export const sparkLamps = (l) =>
  l.cells.flatMap((row, z) => row.map((c, x) => (c?.lamp && c?.spark ? key(x, z) : null)).filter(Boolean));

export const litLamps = (l, theme = 'dark') =>
  l.cells.flatMap((row, z) =>
    row
      .map((c, x) =>
        isLightTarget(c) && !c.spark && !c.needsBulb && (theme === 'light' ? !c.lit : c.lit === true) ? key(x, z) : null
      )
      .filter(Boolean)
  );

export const initialState = (l, theme = 'dark') => ({
  ...l.start,
  theme,
  lit: litLamps(l, theme),
  unscrewed: [],
  bulbs: collectBulbs(l),
  kits: collectKits(l),
  sparks: sparkLamps(l),
  boxes: collectBoxes(l),
  onBox: false,
  carriedBulbs: 0,
  repairKits: Number.isInteger(l.repairKits) ? l.repairKits : 0,
  fittedLamps: []
});

export const lampCount = (l) => l.cells.flat().filter(isLightTarget).length;

export const dayLampsToUnscrew = (l) =>
  l.cells.flat().filter((c) => isLightTarget(c) && !c.lit && !c.spark && !c.needsBulb).length;

export const won = (l, s) => {
  if (s.sparks && s.sparks.length > 0) return false;
  return s.theme === 'light'
    ? s.lit.length === 0 && (dayLampsToUnscrew(l) === 0 || (s.unscrewed?.length || 0) >= dayLampsToUnscrew(l))
    : s.lit.length === lampCount(l);
};

export function getCommandInfo(type, theme = 'dark') {
  if (type === 'light' && theme === 'light') return ['💡', 'Вимкнути світло'];
  return commands[type] || ['•', type];
}

export function getLevelDescription(l, theme = 'dark') {
  if (!l) return '';
  if (theme === 'light') {
    return l.descriptionDay || l.description || '';
  }
  return l.descriptionNight || l.description || '';
}

export class ElectricShockError extends Error {
  constructor() {
    super('Цей ліхтар коротить! ⚡ Спроба перемкнути світло вдарила персонажа струмом. Спочатку полагодь ліхтар.');
    this.name = 'ElectricShockError';
  }
}

export function step(l, s, cmd) {
  if (!l.allowed.includes(cmd)) throw new Error('Ця команда недоступна в цьому рівні.');

  const k = key(s.x, s.z);

  if (cmd === 'left') return { ...s, dir: (s.dir + 3) % 4 };
  if (cmd === 'right') return { ...s, dir: (s.dir + 1) % 4 };

  if (cmd === 'take') {
    const hasBulb = s.bulbs?.includes(k);
    const hasKit = s.kits?.includes(k);
    if (!hasBulb && !hasKit) {
      throw new Error('Тут немає предмета, який можна взяти.');
    }
    if (hasBulb) {
      return {
        ...s,
        bulbs: s.bulbs.filter((id) => id !== k),
        carriedBulbs: (s.carriedBulbs || 0) + 1
      };
    }
    return {
      ...s,
      kits: s.kits.filter((id) => id !== k),
      repairKits: (s.repairKits || 0) + 1
    };
  }

  if (cmd === 'fix') {
    const here = l.cells[s.z][s.x];
    if (!here?.lamp || !s.sparks?.includes(k)) {
      throw new Error('Тут немає несправного ліхтаря, який потрібно полагодити.');
    }
    if ((s.repairKits || 0) <= 0) {
      throw new Error('Цей ліхтар коротить! Потрібен комплект ремонту, щоб його полагодити.');
    }
    return {
      ...s,
      repairKits: s.repairKits - 1,
      sparks: s.sparks.filter((id) => id !== k)
    };
  }

  if (cmd === 'light') {
    const here = l.cells[s.z][s.x];
    if (!here?.lamp && !here?.house) {
      throw new Error('Тут немає ліхтаря чи будиночка. Стань на клітинку з ліхтарем або зайди в будиночок.');
    }
    if (s.sparks?.includes(k)) {
      throw new ElectricShockError();
    }
    if (here.needsBulb && !s.fittedLamps?.includes(k)) {
      if ((s.carriedBulbs || 0) <= 0) {
        throw new Error('У цьому ліхтарі немає лампочки! Спочатку знайди та візьми лампочку.');
      }
      return {
        ...s,
        carriedBulbs: s.carriedBulbs - 1,
        fittedLamps: [...(s.fittedLamps || []), k],
        lit: [...new Set([...s.lit, k])]
      };
    }

    const isLit = s.lit.includes(k);
    if (isLit) {
      return {
        ...s,
        lit: s.lit.filter((id) => id !== k),
        unscrewed: [...new Set([...(s.unscrewed || []), k])]
      };
    } else {
      return {
        ...s,
        lit: [...new Set([...s.lit, k])],
        unscrewed: (s.unscrewed || []).filter((id) => id !== k)
      };
    }
  }

  if (cmd !== 'forward' && cmd !== 'jump') throw new Error('Невідома команда.');

  const [dx, dz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][s.dir];
  const x = s.x + dx;
  const z = s.z + dz;
  const here = l.cells[s.z][s.x];
  const cell = l.cells[z]?.[x];

  if (!cell) throw new Error('Попереду немає плитки. Зміни напрямок.');

  if (here?.house) {
    const doorDir = Number.isInteger(here.dir) ? here.dir : 2;
    if (s.dir !== doorDir) throw new Error('Тут стіна будиночка. Вийти можна лише через двері.');
  }

  if (cell.house) {
    const doorDir = Number.isInteger(cell.dir) ? cell.dir : 2;
    const requiredDir = (doorDir + 2) % 4;
    if (s.dir !== requiredDir) throw new Error('Тут стіна будиночка. Зайти можна лише через двері.');
  }

  if (cell.tree) throw new Error('Дерево перекриває шлях. Обійди його.');
  if (cell.bush) throw new Error('Кущ перекриває шлях. Обійди його.');
  if (cell.rock) throw new Error('Камінь перекриває шлях. Обійди його.');

  const curHeight = here.height + (s.onBox ? 1 : 0);
  const targetHasBox = Boolean(s.boxes?.includes(key(x, z)));

  if (cmd === 'forward') {
    if (s.onBox) {
      const targetHeight = cell.height + (targetHasBox ? 1 : 0);
      if (targetHeight !== curHeight) throw new Error('Інша висота. Використай стрибок.');
      return { ...s, x, z, onBox: targetHasBox };
    }

    if (targetHasBox) {
      const bx = x + dx;
      const bz = z + dz;
      const cellBeyond = l.cells[bz]?.[bx];
      if (!cellBeyond) throw new Error('Попереду немає плитки, щоб посунути коробку.');
      if (
        cellBeyond.tree ||
        cellBeyond.bush ||
        cellBeyond.rock ||
        cellBeyond.box ||
        cellBeyond.house ||
        cellBeyond.lamp ||
        cellBeyond.bulb ||
        cellBeyond.kit ||
        s.boxes?.includes(key(bx, bz))
      ) {
        throw new Error('Шлях для коробки заблоковано.');
      }
      if (cellBeyond.height !== cell.height) {
        throw new Error('Коробку можна посунути лише на плитку такої ж висоти.');
      }

      const newBoxes = (s.boxes || []).map((k) => (k === key(x, z) ? key(bx, bz) : k));
      return {
        ...s,
        x,
        z,
        onBox: false,
        boxes: newBoxes,
        pushedBox: { from: { x, z }, to: { x: bx, z: bz } }
      };
    }

    const diff = Math.abs(cell.height - curHeight);
    if (diff) throw new Error('Інша висота. Використай стрибок.');
    return { ...s, x, z, onBox: false };
  }

  if (cmd === 'jump') {
    const targetHeight = cell.height + (targetHasBox ? 1 : 0);
    const diff = Math.abs(targetHeight - curHeight);
    if (diff > 1) throw new Error('Зависокий перепад: стрибок долає лише один рівень висоти.');
    return { ...s, x, z, onBox: targetHasBox };
  }
}

export const sensors = {
  lampShorts: 'Ліхтар коротить',
  onLamp: 'Тут є ліхтар чи будинок',
  obstacleAhead: 'Попереду перешкода',
  lampLit: 'Світло тут світить',
  canJump: 'Можна стрибнути'
};

export const comparisons = {
  '==': '= дорівнює',
  '!=': '≠ не дорівнює',
  '<': '< менше',
  '<=': '≤ менше або дорівнює',
  '>': '> більше',
  '>=': '≥ більше або дорівнює'
};

export const defaultCondition = () => ({ kind: 'sensor', sensor: 'obstacleAhead', not: false });

export function conditionValue(condition, l, s, memory, valueOfFn) {
  if (!condition) throw new Error('Додай умову.');

  const [dx, dz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][s.dir];
  const ahead = l.cells[s.z + dz]?.[s.x + dx];
  const here = l.cells[s.z][s.x];
  const isLightPoint = Boolean(here?.lamp || here?.house);
  const houseExitBlocked = Boolean(here?.house && s.dir !== (Number.isInteger(here.dir) ? here.dir : 2));
  const houseEnterBlocked = Boolean(ahead?.house && s.dir !== ((Number.isInteger(ahead.dir) ? ahead.dir : 2) + 2) % 4);

  const curH = here.height + (s.onBox ? 1 : 0);
  const aheadHasBox = Boolean(ahead && s.boxes?.includes(key(s.x + dx, s.z + dz)));
  const aheadH = ahead ? ahead.height + (aheadHasBox ? 1 : 0) : 0;

  const isStaticObstacle = Boolean(ahead?.tree || ahead?.bush || ahead?.rock);
  const boxCanBePushed = Boolean(
    aheadHasBox &&
      !s.onBox &&
      (() => {
        const bx = s.x + dx * 2;
        const bz = s.z + dz * 2;
        const beyond = l.cells[bz]?.[bx];
        if (!beyond) return false;
        if (
          beyond.tree ||
          beyond.bush ||
          beyond.rock ||
          beyond.box ||
          beyond.house ||
          beyond.lamp ||
          beyond.bulb ||
          beyond.kit ||
          s.boxes?.includes(key(bx, bz))
        ) {
          return false;
        }
        return beyond.height === ahead.height;
      })()
  );

  const blocked =
    houseExitBlocked ||
    houseEnterBlocked ||
    !ahead ||
    isStaticObstacle ||
    (aheadHasBox && !boxCanBePushed && !s.onBox);
  const isObstacleAhead = blocked || (ahead && aheadH > curH);
  const canJumpAhead = !houseExitBlocked && !houseEnterBlocked && ahead && !isStaticObstacle && Math.abs(aheadH - curH) <= 1;

  const tests = {
    lampShorts: Boolean(isLightPoint && s.sparks?.includes(key(s.x, s.z))),
    onLamp: isLightPoint,
    obstacleAhead: isObstacleAhead,
    lampLit: Boolean(isLightPoint && s.lit?.includes(key(s.x, s.z))),
    canJump: canJumpAhead,

    // Fallbacks for compatibility with any older tests/references
    canForward: !blocked && aheadH === curH,
    treeAhead: Boolean(ahead?.tree || ahead?.bush || ahead?.rock),
    allLit: won(l, s)
  };

  const term = (t) => {
    let result;
    if (t.kind === 'sensor') {
      if (!Object.hasOwn(tests, t.sensor)) throw new Error('Невідомий датчик.');
      result = tests[t.sensor];
    } else if (t.kind === 'compare') {
      if (!valueOfFn) throw new Error('Не задано обчислювач значень для порівняння.');
      const a = valueOfFn(t.left, l, s, memory);
      const b = valueOfFn(t.right, l, s, memory);
      switch (t.op) {
        case '==': result = a === b; break;
        case '!=': result = a !== b; break;
        case '<': result = a < b; break;
        case '<=': result = a <= b; break;
        case '>': result = a > b; break;
        case '>=': result = a >= b; break;
        default: throw new Error('Обери порівняння.');
      }
    } else {
      throw new Error('Невідома умова.');
    }
    return t.not ? !result : result;
  };

  if (condition.terms && condition.mode) {
    if (!['and', 'or'].includes(condition.mode) || !condition.terms.length) throw new Error('Додай умову.');
    return condition.mode === 'and' ? condition.terms.every(term) : condition.terms.some(term);
  }
  return term(condition);
}
