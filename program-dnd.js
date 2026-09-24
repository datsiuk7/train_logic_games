import { commands, childLists } from './logic.mjs';
import { iconMarkup } from './program-icons.js';

export class ProgramDnd {
  constructor(editor) {
    this.editor = editor;
    this.marker = document.createElement('div');
    this.marker.className = 'insertion-preview';
    this.marker.setAttribute('aria-hidden', 'true');
    this.floating = null;
    this.drag = null;
    this.source = null;
    this.insertion = null;
    this.zones = new WeakMap();
    this.suppressClickUntil = 0;
  }

  bind(element, data, source) {
    let origin = null;
    let started = false;
    element.draggable = false;

    element.onpointerdown = (e) => {
      if (
        this.editor.locked ||
        element.disabled ||
        e.button !== 0 ||
        e.target.closest('select,input,textarea') ||
        (element !== source && e.target.closest('button'))
      ) {
        return;
      }
      e.preventDefault();
      try { window.getSelection()?.removeAllRanges(); } catch {}
      origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
      started = false;
      element.setPointerCapture(e.pointerId);
    };

    element.onpointermove = (e) => {
      if (!origin) return;
      if (!started && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < 6) return;
      e.preventDefault();

      if (!started) {
        started = true;
        this.drag = data;
        this.source = source;
        source.classList.add('drag-source');
        this.editor.host.classList.add('receiving');
        const type = data.type || this.editor.find(data.id)?.block?.type;
        this.floating = document.createElement('div');
        this.floating.className = 'drag-floating';
        this.floating.setAttribute('aria-label', commands[type] ? commands[type][1] : type);
        this.floating.innerHTML = `<span>${iconMarkup(type, this.editor.theme)}</span>`;
        document.body.append(this.floating);
      }

      this.floating.style.transform = `translate(${e.clientX + 15}px,${e.clientY + 15}px)`;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const trash = hit?.closest('.trash-zone');
      const zone = hit?.closest('.code-body, .loop-body, .program');

      if (trash && this.drag && !this.drag.type) {
        this.clearPreview();
        trash.classList.add('drop-target');
        this.insertion = { trash };
        this.floating.classList.remove('invalid');
        return;
      }

      const list = zone && this.zones.get(zone);
      if (list && this.canDrop(list)) {
        this.preview(zone, list, this.position(zone, list, e.clientX, e.clientY));
      } else {
        this.clearPreview();
      }

      this.floating.classList.toggle('invalid', !list || !this.canDrop(list));

      if (e.clientY > innerHeight - 45) window.scrollBy(0, 14);
      else if (e.clientY < 45) window.scrollBy(0, -14);
    };

    const finish = (e) => {
      if (!origin) return;
      origin = null;
      if (started) {
        e.preventDefault();
        this.suppressClickUntil = Date.now() + 250;
        const slot = this.insertion;
        if (slot?.trash) this.removeDragged();
        else if (slot) this.drop(slot.list, slot.index);
        else this.removeDragged();
      }
      started = false;
      if (element.hasPointerCapture(e.pointerId)) {
        element.releasePointerCapture(e.pointerId);
      }
    };

    element.onpointerup = finish;
    element.onpointercancel = () => {
      origin = null;
      started = false;
      this.endDrag();
    };
    element.onlostpointercapture = () => {
      if (origin) {
        origin = null;
        started = false;
        this.endDrag();
      }
    };

    element.addEventListener('click', (e) => {
      if (Date.now() < this.suppressClickUntil) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
  }

  attachPalette(element, type) {
    this.bind(element, { type }, element);
  }

  attachBlock(row, handle, b, list) {
    this.bind(handle || row, { id: b.id }, row);
  }

  attachZone(el, list) {
    this.zones.set(el, list);
    el.ondragover = (e) => {
      e.stopPropagation();
      if (!this.canDrop(list)) {
        e.dataTransfer.dropEffect = 'none';
        this.clearPreview();
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = this.drag?.id ? 'move' : 'copy';
      this.preview(el, list, this.position(el, list, e.clientX, e.clientY));
    };
    el.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = this.insertion?.el === el
        ? this.insertion.index
        : this.position(el, list, e.clientX, e.clientY);
      this.drop(list, index);
    };
  }

  clearPreview() {
    this.editor.host?.classList.remove('drop-target');
    this.editor.trash?.classList.remove('drop-target');
    this.marker.remove();
    this.insertion = null;
    this.editor.palette?.parentElement?.querySelectorAll('.drop-target').forEach((e) => {
      e.classList.remove('drop-target');
    });
  }

  endDrag() {
    this.floating?.remove();
    this.floating = null;
    this.clearPreview();
    this.source?.classList.remove('drag-source');
    this.source = null;
    this.drag = null;
    this.editor.host?.classList.remove('receiving');
  }

  removeDragged() {
    const d = this.drag;
    const found = d && !d.type ? this.editor.find(d.id) : null;
    this.endDrag();
    if (!found) return;
    found.list.splice(found.list.indexOf(found.block), 1);
    if (this.editor.selected === found.block.id) this.editor.selected = null;
    this.editor.draw();
  }

  canDrop(list) {
    if (this.editor.locked || !this.drag) return false;
    const type = this.drag.type || this.editor.find(this.drag.id)?.block?.type;
    if (!type) return false;
    if (this.drag.id) {
      const b = this.editor.find(this.drag.id)?.block;
      const contains = (block) =>
        childLists(block).some((children) => children === list || children.some(contains));
      if (b && contains(b)) return false;
    }
    return !this.drag.type || !this.editor.level.limit || this.editor.used() < this.editor.level.limit;
  }

  position(el, list, x, y) {
    if (this.insertion?.el === el) {
      const r = this.marker.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return this.insertion.index;
      }
    }
    const nodes = [...el.children].filter((n) => n.classList.contains('block'));
    if (!nodes.length) return 0;
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].getBoundingClientRect();
      if (getComputedStyle(el).flexDirection === 'column') {
        if (y < r.top + r.height / 2) return i;
        continue;
      }
      if (y < r.top - 6) return i;
      if (y <= r.bottom + 6 && x < r.left + r.width / 2) return i;
    }
    return list.length;
  }

  preview(el, list, index) {
    if (this.insertion?.el === el && this.insertion.index === index) return;
    const nodes = [...el.children].filter((n) => n.classList.contains('block'));
    const before = new Map(nodes.map((n) => [n, n.getBoundingClientRect()]));
    this.clearPreview();

    const type = this.drag.type || this.editor.find(this.drag.id)?.block?.type;
    this.marker.innerHTML = `<span class="preview-icon">${iconMarkup(type, this.editor.theme)}</span>`;
    this.marker.setAttribute('aria-label', commands[type] ? commands[type][1] : type);
    this.marker.classList.toggle('loop-preview', type === 'loop');
    el.insertBefore(this.marker, nodes[index] || null);
    el.classList.add('drop-target');
    this.insertion = { el, list, index };

    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const n of nodes) {
        const prev = before.get(n);
        const next = n.getBoundingClientRect();
        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (dx || dy) {
          n.animate(
            [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }],
            { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }
          );
        }
      }
    }
  }

  drop(list, index) {
    if (!this.canDrop(list)) {
      this.endDrag();
      return;
    }
    const d = this.drag;
    this.endDrag();
    if (d.type) {
      this.editor.insert(d.type, list, index);
      return;
    }
    const found = this.editor.find(d.id);
    if (!found) return;
    const old = found.list.indexOf(found.block);
    found.list.splice(old, 1);
    if (list === found.list && old < index) index--;
    list.splice(index, 0, found.block);
    this.editor.draw();
  }
}
