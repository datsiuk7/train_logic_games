let activeDraggedId = null;
let activeDraggedCat = null;
let isDraggingLevel = false;

export function isLevelTreeDragging() {
  return isDraggingLevel;
}

export function enableLevelTreeDnd({ ul, categoryId, onReorder }) {
  if (!ul) return;

  const items = ul.querySelectorAll('.cat-level-item');
  items.forEach((li) => {
    li.setAttribute('draggable', 'true');

    li.ondragstart = (e) => {
      activeDraggedId = li.dataset.id;
      activeDraggedCat = categoryId;
      isDraggingLevel = true;
      li.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', li.dataset.id);
      }
    };

    li.ondragend = () => {
      li.classList.remove('is-dragging');
      ul.querySelectorAll('.cat-level-item').forEach((item) => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      activeDraggedId = null;
      activeDraggedCat = null;
      setTimeout(() => {
        isDraggingLevel = false;
      }, 80);
    };

    li.ondragover = (e) => {
      if (!activeDraggedId || activeDraggedId === li.dataset.id) return;
      if (activeDraggedCat !== categoryId) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const rect = li.getBoundingClientRect();
      const isTop = e.clientY < rect.top + rect.height / 2;

      li.classList.toggle('drag-over-top', isTop);
      li.classList.toggle('drag-over-bottom', !isTop);
    };

    li.ondragleave = (e) => {
      if (e.relatedTarget && li.contains(e.relatedTarget)) return;
      li.classList.remove('drag-over-top', 'drag-over-bottom');
    };

    li.ondrop = async (e) => {
      if (!activeDraggedId || activeDraggedId === li.dataset.id) return;
      if (activeDraggedCat !== categoryId) return;
      e.preventDefault();

      const isTop = li.classList.contains('drag-over-top');
      li.classList.remove('drag-over-top', 'drag-over-bottom');

      const draggedLi = ul.querySelector(`.cat-level-item[data-id="${activeDraggedId}"]`);
      if (!draggedLi) return;

      const targetRef = isTop ? li : li.nextSibling;
      if (draggedLi !== targetRef && draggedLi.nextSibling !== targetRef) {
        ul.insertBefore(draggedLi, targetRef);
        const newIdsInCat = Array.from(ul.querySelectorAll('.cat-level-item')).map(
          (el) => el.dataset.id
        );
        if (typeof onReorder === 'function') {
          await onReorder(categoryId, newIdsInCat);
        }
      }
    };
  });
}
