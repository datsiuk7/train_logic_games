import {
  commands,
  getCommandInfo,
  blockCount,
  childLists,
  defaultCondition
} from './logic.mjs';
import { iconMarkup } from './program-icons.js';
import {
  createButton,
  createSelect,
  createNumberInput,
  createValueEditor,
  createConditionEditor
} from './program-blocks.js';
import { ProgramDnd } from './program-dnd.js';

let serial = 0;

export class ProgramEditor {
  constructor(palette, host, count, level, trash, theme = 'dark', initialProgram = null) {
    Object.assign(this, {
      palette,
      host,
      count,
      level,
      trash,
      theme,
      blocks: [],
      locked: false,
      selected: null,
      active: null
    });

    this.functions = [];
    this.dnd = new ProgramDnd(this);

    this.library = document.createElement('div');
    this.library.className = 'code-library';
    this.palette.after(this.library);

    this.host.ondragleave = (e) => {
      const r = this.host.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        this.dnd.clearPreview();
      }
    };

    if (initialProgram) {
      this.blocks = Array.isArray(initialProgram.blocks)
        ? this.sanitizeBlocks(structuredClone(initialProgram.blocks))
        : [];
      this.functions = Array.isArray(initialProgram.functions)
        ? structuredClone(initialProgram.functions)
        : [];
      this.updateSerial();
    }

    this.draw();
  }

  setTheme(theme) {
    this.theme = theme;
    this.draw();
  }

  sanitizeBlocks(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((b) => {
      if (!b || !b.type) return false;
      if (!this.level.allowed.includes(b.type)) return false;
      if (Array.isArray(b.body)) b.body = this.sanitizeBlocks(b.body);
      if (Array.isArray(b.elseBody)) b.elseBody = this.sanitizeBlocks(b.elseBody);
      return true;
    });
  }

  updateSerial() {
    const scan = (item) => {
      if (!item) return;
      if (item.id) {
        const n = parseInt(String(item.id).replace(/\D+/g, ''), 10);
        if (!isNaN(n) && n > serial) serial = n;
      }
      if (Array.isArray(item.body)) item.body.forEach(scan);
      if (Array.isArray(item.elseBody)) item.elseBody.forEach(scan);
    };

    this.blocks.forEach(scan);
    this.functions.forEach((f) => {
      scan(f);
      if (Array.isArray(f.body)) f.body.forEach(scan);
    });
  }

  getProgram() {
    return {
      blocks: structuredClone(this.blocks),
      functions: structuredClone(this.functions)
    };
  }

  setProgram(data) {
    if (!data) return;
    this.blocks = Array.isArray(data.blocks)
      ? this.sanitizeBlocks(structuredClone(data.blocks))
      : [];
    this.functions = Array.isArray(data.functions)
      ? structuredClone(data.functions)
      : [];
    this.updateSerial();
    this.draw();
  }

  clear() {
    this.blocks = [];
    this.draw();
  }

  notifyChange() {
    this.onChange?.(this.getProgram());
  }

  make(type) {
    const b = { id: `b${++serial}`, type };
    if (type === 'loop') Object.assign(b, { times: 2, body: [] });
    if (type === 'while') Object.assign(b, { condition: defaultCondition(), body: [] });
    if (type === 'if') Object.assign(b, { condition: defaultCondition(), body: [] });
    if (type === 'call') {
      if (!this.functions.length) this.addFunction();
      b.functionId = this.functions[0].id;
    }
    return b;
  }

  addFunction() {
    this.functions.push({
      id: `f${++serial}`,
      name: 'Назва функції ' + (this.functions.length + 1),
      body: []
    });
  }

  allLists() {
    const result = [];
    const visit = (list) => {
      result.push(list);
      for (const b of list) childLists(b).forEach(visit);
    };
    visit(this.blocks);
    this.functions.forEach((f) => visit(f.body));
    return result;
  }

  find(id) {
    for (const list of this.allLists()) {
      const block = list.find((b) => b.id === id);
      if (block) return { block, list };
    }
    return null;
  }

  targetList() {
    if (this.selected) {
      const entry = this.find(this.selected);
      if (entry && Array.isArray(entry.block.body)) return entry.block.body;
      const fn = this.functions.find((f) => f.id === this.selected);
      if (fn) return fn.body;
    }
    return this.blocks;
  }

  insert(type, list = this.blocks, index = list.length) {
    if (this.locked) return;
    list.splice(Math.min(index, list.length), 0, this.make(type));
    this.draw();
    this.notifyChange();
  }

  renderPalette() {
    this.palette.replaceChildren();
    for (const type of this.level.allowed) {
      const [icon, name] = getCommandInfo(type, this.theme);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `command command-${type}`;
      btn.innerHTML = `<span class="icon">${iconMarkup(type, this.theme)}</span><span class="command-label">${name}</span><span class="command-grip" aria-hidden="true">⠿</span>`;
      btn.setAttribute('aria-label', name);
      btn.title = name;
      btn.disabled = this.locked || Boolean(this.level.limit && this.used() >= this.level.limit);
      btn.onclick = () => this.insert(type, this.targetList());
      this.dnd.attachPalette(btn, type);
      this.palette.append(btn);
    }
  }

  zone(el, list) {
    this.dnd.attachZone(el, list);
  }

  used() {
    return blockCount(this.blocks) + this.functions.reduce((n, f) => n + blockCount(f.body), 0);
  }

  draw() {
    this.renderPalette();
    this.host.replaceChildren();
    const count = this.used();
    if (this.level.limit) {
      const remaining = Math.max(0, this.level.limit - count);
      this.count.textContent = `Залишилося ${remaining}/${this.level.limit}`;
    } else {
      this.count.textContent = `Блоків: ${count}`;
    }
    this.count.parentElement?.classList.toggle('over-limit', Boolean(this.level.limit && count > this.level.limit));

    this.renderList(this.blocks, this.host);
    this.zone(this.host, this.blocks);
    this.renderLibrary();
    this.highlight(this.active);
  }

  renderList(list, host) {
    for (const [index, b] of list.entries()) {
      const cmdInfo = getCommandInfo(b.type, this.theme);
      const name = cmdInfo[1];
      const row = document.createElement('div');
      row.className = `block command-${b.type}` + (b.type === 'loop' ? ' loop' : '') + (this.active === b.id ? ' active' : '');
      row.dataset.block = b.id;
      row.tabIndex = this.locked ? -1 : 0;
      row.setAttribute('aria-label', name);

      if (['if', 'while', 'call'].includes(b.type)) {
        row.classList.add('advanced-block');
      }

      const head = document.createElement('div');
      head.className = 'block-head';

      const iconSpan = document.createElement('span');
      iconSpan.className = `icon${b.type === 'loop' ? ' loop-icon' : ''}`;
      iconSpan.innerHTML = iconMarkup(b.type, this.theme);

      const label = document.createElement('span');
      label.className = 'command-label';
      label.textContent = name;

      head.append(iconSpan, label);

      if (b.type === 'loop') {
        const times = document.createElement('span');
        times.className = 'loop-times';
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.ariaLabel = 'Зменшити кількість повторень';
        const value = document.createElement('span');
        value.textContent = `${b.times}×`;
        value.ariaLabel = `Кількість повторень ${b.times}`;
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.ariaLabel = 'Збільшити кількість повторень';
        minus.disabled = this.locked;
        plus.disabled = this.locked;
        minus.onclick = () => {
          b.times = Math.max(2, (b.times || 2) - 1);
          this.draw();
          this.notifyChange();
        };
        plus.onclick = () => {
          b.times = Math.min(10, (b.times || 2) + 1);
          this.draw();
          this.notifyChange();
        };
        times.append(minus, value, plus);
        head.append(times);
      }

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'block-remove';
      remove.setAttribute('aria-label', `Видалити команду ${name}`);
      remove.title = 'Видалити команду';
      remove.textContent = '×';
      remove.disabled = this.locked;

      head.append(remove);
      row.append(head);

      this.dnd.attachBlock(row, head, b, list);

      row.onkeydown = (e) => {
        if (this.locked) return;
        if (e.key === 'ArrowUp' && index > 0) {
          e.preventDefault();
          list.splice(index - 1, 0, list.splice(index, 1)[0]);
          this.draw();
          this.notifyChange();
          this.focus(b.id);
        }
        if (e.key === 'ArrowDown' && index < list.length - 1) {
          e.preventDefault();
          list.splice(index + 1, 0, list.splice(index, 1)[0]);
          this.draw();
          this.notifyChange();
          this.focus(b.id);
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          list.splice(index, 1);
          this.draw();
          this.notifyChange();
        }
      };

      remove.onclick = (e) => {
        e.stopPropagation();
        if (this.locked) return;
        list.splice(list.indexOf(b), 1);
        if (this.selected === b.id) this.selected = null;
        this.draw();
        this.notifyChange();
      };

      this.renderRow(b, row, list);
      host.append(row);
    }
  }

  focus(id) {
    this.host.querySelector(`[data-block="${id}"]`)?.focus();
  }

  button(text, action) {
    return createButton(text, () => {
      action();
      this.notifyChange();
    }, this.locked);
  }

  select(options, value, onChange, label) {
    return createSelect(options, value, (v) => {
      onChange(v);
      this.notifyChange();
    }, label, this.locked);
  }

  number(value, onChange, label) {
    return createNumberInput(value, (v) => {
      onChange(v);
      this.notifyChange();
    }, label, this.locked);
  }

  valueEditor(expr, onChange) {
    return createValueEditor({
      expr,
      onChange,
      allowed: this.level.allowed,
      onRedraw: () => this.draw(),
      locked: this.locked
    });
  }

  conditionEditor(condition, allowCompare = false) {
    return createConditionEditor({
      condition,
      allowCompare,
      allowed: this.level.allowed,
      onRedraw: () => this.draw(),
      locked: this.locked
    });
  }

  bodyZone(parent, list, className = 'code-body') {
    const body = document.createElement('div');
    body.className = className;
    this.zone(body, list);
    if (!list.length) body.classList.add('empty');
    this.renderList(list, body);
    parent.append(body);
  }

  renderRow(b, row, list) {
    if (b.type === 'loop') {
      this.bodyZone(row, b.body, 'loop-body');
    }

    if (b.type === 'while') {
      row.append(this.conditionEditor(b.condition, true));
      this.bodyZone(row, b.body, 'code-body');
    }

    if (b.type === 'if') {
      const branches = b.branches || [{ condition: b.condition, body: b.body }];
      b.branches = branches;
      delete b.condition;
      delete b.body;

      branches.forEach((branch, branchIndex) => {
        const branchBox = document.createElement('div');
        branchBox.className = 'if-branch';

        const head = document.createElement('div');
        head.className = 'branch-head';
        head.append(document.createTextNode(branchIndex === 0 ? 'Якщо' : 'Інакше якщо'));
        head.append(this.conditionEditor(branch.condition, true));

        if (branchIndex > 0) {
          head.append(this.button('Видалити', () => {
            branches.splice(branchIndex, 1);
            this.draw();
          }));
        }
        branchBox.append(head);
        this.bodyZone(branchBox, branch.body);
        row.append(branchBox);
      });

      const actions = document.createElement('div');
      actions.className = 'branch-actions';
      actions.append(this.button('＋ elif', () => {
        branches.push({ condition: defaultCondition(), body: [] });
        this.draw();
      }));

      if (!b.elseBody) {
        actions.append(this.button('＋ else', () => {
          b.elseBody = [];
          this.draw();
        }));
      }
      row.append(actions);

      if (b.elseBody) {
        const elseBox = document.createElement('div');
        elseBox.className = 'if-branch else-branch';
        const head = document.createElement('div');
        head.className = 'branch-head';
        head.append(document.createTextNode('Інакше'));
        head.append(this.button('Видалити else', () => {
          delete b.elseBody;
          this.draw();
        }));
        elseBox.append(head);
        this.bodyZone(elseBox, b.elseBody);
        row.append(elseBox);
      }
    }

    if (b.type === 'call') {
      const options = Object.fromEntries([
        ['', 'Обери функцію'],
        ...this.functions.map((f) => [f.id, f.name])
      ]);
      row.append(this.select(options, b.functionId, (v) => { b.functionId = v; }, 'Виклик функції'));
    }
  }

  renderLibrary() {
    this.library.replaceChildren();
    if (!this.level.allowed.includes('call')) return;

    const addSection = (title, onAdd) => {
      const section = document.createElement('div');
      section.className = 'library-section';
      const header = document.createElement('div');
      header.className = 'section-header';
      const h3 = document.createElement('h3');
      h3.textContent = title;
      header.append(h3, this.button('＋ Створити', onAdd));
      section.append(header);
      this.library.append(section);
      return section;
    };

    if (this.level.allowed.includes('call')) {
      const section = addSection('Мої функції · підпрограми', () => this.addFunction());
      for (const fn of this.functions) {
        const card = document.createElement('div');
        card.className = 'function-card';
        const input = document.createElement('input');
        input.value = fn.name;
        input.maxLength = 40;
        input.ariaLabel = 'Назва функції';
        input.disabled = this.locked;
        input.onchange = () => {
          fn.name = input.value.trim() || 'Назва функції';
          this.draw();
        };
        card.append(input, this.button('Видалити функцію', () => {
          this.functions.splice(this.functions.indexOf(fn), 1);
          this.draw();
        }));
        this.bodyZone(card, fn.body);
        section.append(card);
      }
    }
  }

  lock(value) {
    this.dnd.endDrag();
    this.locked = value;
    this.draw();
  }

  highlight(id) {
    this.active = id;
    this.palette.parentElement
      ?.querySelectorAll('.block')
      .forEach((e) => e.classList.toggle('active', e.dataset.block === id));
  }
}
