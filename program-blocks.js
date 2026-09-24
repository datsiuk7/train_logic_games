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

export function createConditionEditor({ condition, allowCompare = false, allowed = [], onRedraw, locked = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'condition-editor';

  const term = condition.terms?.[0] || condition;
  if (!allowCompare || !term.kind) term.kind = 'sensor';

  const notBtn = createButton('НЕ', () => {
    term.not = !term.not;
    onRedraw();
  }, locked);
  notBtn.className = 'not-btn' + (term.not ? ' selected' : '');
  notBtn.setAttribute('aria-pressed', String(!!term.not));
  wrap.append(notBtn);

  if (allowCompare) {
    wrap.append(
      createSelect({ sensor: 'Датчик', compare: 'Порівняння' }, term.kind, (kind) => {
        Object.assign(term, {
          kind,
          sensor: 'obstacleAhead',
          left: { kind: 'height' },
          op: '==',
          right: { kind: 'number', value: 0 }
        });
        onRedraw();
      }, 'Тип умови', locked)
    );
  }

  if (term.kind === 'sensor') {
    wrap.append(
      createSelect(sensors, term.sensor || 'obstacleAhead', (v) => {
        term.sensor = v;
        onRedraw();
      }, 'Датчик', locked)
    );
  } else {
    wrap.append(createValueEditor({ expr: term.left, onChange: (v) => { term.left = v; }, allowed, onRedraw, locked }));
    wrap.append(createSelect(comparisons, term.op, (v) => { term.op = v; }, 'Порівняння', locked));
    wrap.append(createValueEditor({ expr: term.right, onChange: (v) => { term.right = v; }, allowed, onRedraw, locked }));
  }

  return wrap;
}
