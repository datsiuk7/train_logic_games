import { sensors, comparisons, defaultCondition } from './logic.mjs';

export function createButton(text, action, locked = false) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.type = 'button';
  btn.disabled = locked;
  btn.onclick = () => {
    if (!locked) action();
  };
  return btn;
}

export function createSelect(options, value, onChange, label, locked = false) {
  const sel = document.createElement('select');
  sel.ariaLabel = label;
  sel.disabled = locked;
  for (const [id, name] of Object.entries(options)) {
    sel.add(new Option(name, id));
  }
  sel.value = value;
  sel.onchange = () => {
    onChange(sel.value);
  };
  return sel;
}

export function createNumberInput(value, onChange, label, locked = false) {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value;
  input.ariaLabel = label;
  input.disabled = locked;
  input.onchange = () => {
    onChange(input.value === '' ? NaN : Number(input.value));
  };
  return input;
}

export function createValueEditor({ expr, onChange, allowed = [], onRedraw, locked = false }) {
  const box = document.createElement('span');
  box.className = 'value-editor';

  const kinds = {
    number: 'Число',
    height: 'Висота клітинки',
    lit: 'Запалено ліхтарів',
    remaining: 'Залишилось ліхтарів',
    repairKits: 'Ремкомплекти',
    bulbs: 'Лампочки'
  };

  box.append(
    createSelect(kinds, expr.kind, (kind) => {
      onChange({
        kind,
        value: 1
      });
      onRedraw();
    }, 'Значення', locked)
  );

  if (expr.kind === 'number') {
    box.append(createNumberInput(expr.value, (v) => { expr.value = v; }, 'Число', locked));
  }

  return box;
}

export function createConditionEditor({ condition, allowed = [], allowedSensors = null, onRedraw, locked = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'condition-editor';

  const term = condition.terms?.[0] || condition;
  term.kind = 'sensor';

  const notBtn = createButton('НЕ', () => {
    term.not = !term.not;
    onRedraw();
  }, locked);
  notBtn.className = 'not-btn' + (term.not ? ' selected' : '');
  notBtn.setAttribute('aria-pressed', String(!!term.not));
  wrap.append(notBtn);

  const availableSensors = Array.isArray(allowedSensors) && allowedSensors.length
    ? Object.fromEntries(Object.entries(sensors).filter(([k]) => allowedSensors.includes(k)))
    : sensors;

  const validKeys = Object.keys(availableSensors);
  if (!validKeys.includes(term.sensor) && validKeys.length) {
    term.sensor = validKeys[0];
  }

  wrap.append(
    createSelect(availableSensors, term.sensor || validKeys[0] || 'obstacleAhead', (v) => {
      term.sensor = v;
      onRedraw();
    }, 'Датчик', locked)
  );

  return wrap;
}
