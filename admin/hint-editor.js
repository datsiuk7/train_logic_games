import { hintTargets } from '../hint-data.mjs';
import { commands } from '../logic.mjs';

export function renderHintEditor(container, hints, { allowedCommands = [], onChange }) {
  if (!container) return;
  let steps = Array.isArray(hints) ? hints : [];
  container.replaceChildren();

  const commit = (next, redraw = true) => {
    steps = next;
    onChange(next);
    if (redraw) renderHintEditor(container, next, { allowedCommands, onChange });
  };

  steps.forEach((hint, index) => {
    const row = document.createElement('div');
    row.className = 'hint-editor-row';

    const label = document.createElement('span');
    label.className = 'hint-editor-number';
    label.textContent = `Крок ${index + 1}`;

    const text = document.createElement('textarea');
    text.rows = 2;
    text.maxLength = 180;
    text.placeholder = 'Що зробити учню?';
    text.ariaLabel = `Текст підказки ${index + 1}`;
    text.value = hint.text || '';
    text.onchange = () => commit(steps.map((step, i) => i === index ? { ...step, text: text.value.trim() } : step), false);

    const target = document.createElement('select');
    target.ariaLabel = `Що підсвітити для підказки ${index + 1}`;
    const choices = [
      ...Object.entries(hintTargets),
      ...allowedCommands.map((command) => [`command:${command}`, `Команда: ${commands[command]?.[1] || command}`])
    ];
    if (hint.target && !choices.some(([value]) => value === hint.target)) {
      choices.push([hint.target, `Недоступно: ${hint.target}`]);
    }
    for (const [value, name] of choices) target.add(new Option(name, value));
    target.value = hint.target || 'palette';
    target.onchange = () => commit(steps.map((step, i) => i === index ? { ...step, target: target.value } : step), false);

    const actions = document.createElement('div');
    actions.className = 'hint-editor-actions';
    for (const [symbol, title, delta] of [['↑', 'Перемістити вище', -1], ['↓', 'Перемістити нижче', 1]]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = symbol;
      button.title = title;
      button.disabled = index + delta < 0 || index + delta >= steps.length;
      button.onclick = () => {
        const next = steps.map((step) => ({ ...step }));
        [next[index], next[index + delta]] = [next[index + delta], next[index]];
        commit(next);
      };
      actions.append(button);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Видалити';
    remove.onclick = () => commit(steps.filter((_, i) => i !== index));
    actions.append(remove);

    row.append(label, text, target, actions);
    container.append(row);
  });

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'hint-add';
  add.textContent = '＋ Додати підказку';
  add.disabled = steps.length >= 5;
  add.onclick = () => commit([...steps, { text: '', target: 'palette' }]);
  container.append(add);
}
