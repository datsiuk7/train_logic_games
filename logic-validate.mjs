import { commands } from './logic-world.mjs';
import { validateHints } from './hint-data.mjs';

export function childLists(b) {
  return [
    ...(Array.isArray(b.body) ? [b.body] : []),
    ...(b.branches || []).map((branch) => branch.body),
    ...(Array.isArray(b.elseBody) ? [b.elseBody] : [])
  ];
}

export function blockCount(program) {
  return program.reduce(
    (n, b) => n + 1 + childLists(b).reduce((sum, list) => sum + blockCount(list), 0),
    0
  );
}

export function validateLevel(l) {
  const errors = [];
  if (!l || typeof l !== 'object') return ['Некоректний файл рівня.'];
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(l.id || '')) {
    errors.push('ID: малі латинські літери, цифри та дефіс (до 60 символів).');
  }
  if (typeof l.name !== 'string' || !l.name.trim() || l.name.length > 80) {
    errors.push('Назва: від 1 до 80 символів.');
  }
  if (typeof l.description !== 'string' || l.description.length > 500) {
    errors.push('Опис: до 500 символів.');
  }
  if (l.descriptionNight !== undefined && (typeof l.descriptionNight !== 'string' || l.descriptionNight.length > 500)) {
    errors.push('Завдання для ночі: до 500 символів.');
  }
  if (l.descriptionDay !== undefined && (typeof l.descriptionDay !== 'string' || l.descriptionDay.length > 500)) {
    errors.push('Завдання для дня: до 500 символів.');
  }
  if (l.hints !== undefined) {
    const hintError = validateHints(l.hints, l.allowed);
    if (hintError) errors.push(hintError);
  }
  if (!Number.isInteger(l.width) || !Number.isInteger(l.depth) || l.width < 2 || l.width > 10 || l.depth < 2 || l.depth > 10) {
    errors.push('Розміри поля: від 2 до 10.');
  }
  if (
    !Array.isArray(l.cells) ||
    l.cells.length !== l.depth ||
    l.cells.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== l.width ||
        row.some(
          (c) =>
            c !== null &&
            (!c ||
              !Number.isInteger(c.height) ||
              c.height < 0 ||
              c.height > 5 ||
              typeof c.tree !== 'boolean' ||
              typeof c.lamp !== 'boolean' ||
              (c.bush !== undefined && typeof c.bush !== 'boolean') ||
              (c.rock !== undefined && typeof c.rock !== 'boolean') ||
              (c.box !== undefined && typeof c.box !== 'boolean') ||
              (c.house !== undefined && typeof c.house !== 'boolean') ||
              (Number(Boolean(c.tree)) + Number(Boolean(c.bush)) + Number(Boolean(c.rock)) + Number(Boolean(c.box)) + Number(Boolean(c.lamp)) + Number(Boolean(c.house)) > 1) ||
              (c.lit !== undefined && typeof c.lit !== 'boolean') ||
              (c.spark !== undefined && typeof c.spark !== 'boolean') ||
              (c.spark && !c.lamp) ||
              (c.needsBulb !== undefined && typeof c.needsBulb !== 'boolean') ||
              (c.needsBulb && !c.lamp) ||
              (c.needsBulb && (c.spark || c.lit)) ||
              (c.bulb !== undefined && typeof c.bulb !== 'boolean') ||
              (c.bulb && (c.tree || c.bush || c.rock || c.box || c.lamp || c.house)) ||
              (c.kit !== undefined && typeof c.kit !== 'boolean') ||
              (c.kit && (c.tree || c.bush || c.rock || c.box || c.lamp || c.house)) ||
              (c.dir !== undefined && (!Number.isInteger(c.dir) || c.dir < 0 || c.dir > 3)))
        )
    )
  ) {
    errors.push('Некоректні клітинки: висота 0–5; дерево, ліхтар та будиночок несумісні.');
  }

  const s = l.start;
  if (
    !s ||
    !Number.isInteger(s.x) ||
    !Number.isInteger(s.z) ||
    !Number.isInteger(s.dir) ||
    s.dir < 0 ||
    s.dir > 3 ||
    s.x < 0 ||
    s.x >= l.width ||
    s.z < 0 ||
    s.z >= l.depth ||
    !l.cells?.[s.z]?.[s.x] ||
    l.cells[s.z][s.x].tree ||
    l.cells[s.z][s.x].bush ||
    l.cells[s.z][s.x].rock ||
    l.cells[s.z][s.x].box
  ) {
    errors.push('Постав старт на плитці без дерева.');
  }

  if (!l.cells?.some((row) => Array.isArray(row) && row.some((c) => c?.lamp || c?.house))) {
    errors.push('Додай хоча б один ліхтар або будиночок.');
  }
  if (
    !Array.isArray(l.allowed) ||
    !l.allowed.length ||
    l.allowed.some((c) => !Object.hasOwn(commands, c)) ||
    new Set(l.allowed).size !== l.allowed.length
  ) {
    errors.push('Вибери доступні команди.');
  }
  if (!l.allowed?.includes('light') && !l.allowed?.includes('fix')) {
    errors.push('Для проходження потрібна команда «Запалити ліхтар» або «Полагодити».');
  }
  if (!Number.isInteger(l.limit) || l.limit < 0 || l.limit > 100) {
    errors.push('Ліміт блоків: 0 (без ліміту) або 1–100.');
  }
  if (l.repairKits !== undefined && (!Number.isInteger(l.repairKits) || l.repairKits < 0 || l.repairKits > 50)) {
    errors.push('Комплекти ремонту: число від 0 до 50.');
  }
  if (l.category !== undefined && (typeof l.category !== 'string' || !/^[a-z0-9-]+$/.test(l.category))) {
    errors.push('Категорія: малі латинські літери та дефіс.');
  }
  return errors;
}

export function validateProgram(l, program, functions = []) {
  if (!program.length) throw new Error('Додай команди до програми.');
  const count = blockCount(program) + functions.reduce((n, f) => n + blockCount(f.body), 0);
  if (l.limit && count > l.limit) throw new Error(`Ліміт — ${l.limit} блоків разом із функціями.`);
  if (count > 500) throw new Error('Забагато блоків: максимум 500.');

  const ids = new Set();
  for (const f of functions) {
    if (!f.id || ids.has(f.id)) throw new Error('Функції мають бути різними.');
    ids.add(f.id);
  }

  function visit(items, depth = 0) {
    if (depth > 12) throw new Error('Забагато вкладених блоків.');
    for (const b of items) {
      if (!l.allowed.includes(b.type)) throw new Error('У програмі є недоступна команда.');
      if (
        b.type === 'loop' &&
        (!Number.isInteger(b.times) || b.times < 2 || b.times > 10 || !b.body?.length)
      ) {
        throw new Error('Цикл: 2–10 повторень і хоча б одна команда всередині.');
      }
      if (b.type === 'call' && !ids.has(b.functionId)) {
        throw new Error('Обери функцію у блоці виклику.');
      }
      if (b.type === 'while' && !b.body?.length) {
        throw new Error('Додай команди всередину while.');
      }
      if (b.type === 'if' && !b.body?.length && !b.branches?.length) {
        throw new Error('Додай команди всередину if.');
      }
      for (const children of childLists(b)) visit(children, depth + 1);
    }
  }

  visit(program);
  functions.forEach((f) => visit(f.body));

  const fnMap = new Map(functions.map((f) => [f.id, f]));
  function calls(items) {
    return items.flatMap((b) => [
      ...(b.type === 'call' ? [b.functionId] : []),
      ...childLists(b).flatMap(calls)
    ]);
  }

  const done = new Set();
  function cycle(id, path = new Set()) {
    if (path.has(id)) {
      throw new Error('Функція не може викликати сама себе — навіть через іншу функцію.');
    }
    if (done.has(id)) return;
    const next = new Set(path).add(id);
    for (const child of calls(fnMap.get(id).body)) cycle(child, next);
    done.add(id);
  }

  for (const f of functions) cycle(f.id);
}
