import { lampCount } from './logic-world.mjs';
import { blockCount } from './logic-validate.mjs';

export function compile(l, program) {
  if (!program.length) throw new Error('Додай команди до програми.');
  if (l.limit && blockCount(program) > l.limit) throw new Error(`Ліміт — ${l.limit} блоків.`);
  const result = [];
  for (const b of program) {
    if (!l.allowed.includes(b.type)) throw new Error('У програмі є недоступна команда.');
    if (b.type === 'loop') {
      if (!Number.isInteger(b.times) || b.times < 2 || b.times > 10 || !b.body.length) {
        throw new Error('Цикл: 2–10 повторень і хоча б одна команда всередині.');
      }
      for (let i = 0; i < b.times; i++) {
        for (const child of b.body) {
          if (child.type === 'loop' || !l.allowed.includes(child.type)) {
            throw new Error('Вкладені або недоступні команди у циклі.');
          }
          result.push({ ...child, iteration: i + 1 });
        }
      }
    } else {
      result.push(b);
    }
  }
  if (result.length > 2000) throw new Error('Програма надто довга (максимум 2000 дій).');
  return result;
}

export function createMemory() {
  return {};
}

export function valueOf(expr, l, s, memory) {
  if (!expr) throw new Error('Задай значення для порівняння.');
  switch (expr.kind) {
    case 'number':
      if (!Number.isFinite(expr.value)) throw new Error('Введи коректне число.');
      return expr.value;
    case 'height':
      return l.cells[s.z][s.x].height;
    case 'lit':
      return s.lit.length;
    case 'remaining':
      return s.theme === 'light' ? s.lit.length : lampCount(l) - s.lit.length;
    case 'repairKits':
      return s.repairKits || 0;
    case 'bulbs':
      return s.carriedBulbs || 0;
    default:
      throw new Error('Невідоме значення.');
  }
}

export function* executeProgram(l, program, functions, readState, memory, conditionValueFn) {
  let operations = 0;
  const fnMap = new Map(functions.map((f) => [f.id, f]));

  function* walk(items, depth = 0) {
    if (depth > 20) throw new Error('Забагато вкладених викликів.');
    for (const b of items) {
      if (++operations > 1500) {
        throw new Error('Програму зупинено після 1500 кроків. Перевір, чи умова while колись стає хибною.');
      }
      if (b.type === 'if') {
        yield { ...b, control: true };
        if (b.branches) {
          let matched = false;
          for (const branch of b.branches) {
            if (conditionValueFn(branch.condition, l, readState(), memory)) {
              yield* walk(branch.body, depth + 1);
              matched = true;
              break;
            }
          }
          if (!matched && b.elseBody) yield* walk(b.elseBody, depth + 1);
        } else {
          if (conditionValueFn(b.condition, l, readState(), memory)) {
            yield* walk(b.body || [], depth + 1);
          } else if (b.elseBody) {
            yield* walk(b.elseBody, depth + 1);
          }
        }
      } else if (b.type === 'while') {
        while (true) {
          if (++operations > 1500) {
            throw new Error('Програму зупинено: while не завершується. Перевір умову.');
          }
          yield { ...b, control: true };
          if (!conditionValueFn(b.condition, l, readState(), memory)) break;
          yield* walk(b.body, depth + 1);
        }
      } else if (b.type === 'loop') {
        yield { ...b, control: true };
        for (let i = 0; i < b.times; i++) yield* walk(b.body, depth + 1);
      } else if (b.type === 'call') {
        yield { ...b, control: true };
        const fn = fnMap.get(b.functionId);
        if (!fn) throw new Error('Функцію не знайдено.');
        yield* walk(fn.body, depth + 1);
      } else {
        yield b;
      }
    }
  }

  yield* walk(program);
}
