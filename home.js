import { getCategory, getLevelDescription } from './logic.mjs';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

export function isCatUnlocked(catIdx, catsWithLevels, done) {
  if (catIdx <= 0) return true;
  for (let i = 0; i < catIdx; i++) {
    const prevCat = catsWithLevels[i];
    const prevLevels = prevCat.levels.filter((l) => !l.hidden);
    const prevDone = prevLevels.filter((l) => done.includes(l.id)).length;
    if (prevLevels.length > 0 && prevDone < prevLevels.length) return false;
  }
  return true;
}

export function getLevelSections(levels, categories) {
  const visibleLevels = levels.filter((l) => !l.hidden);
  const catsWithLevels = categories
    .map((cat) => ({
      ...cat,
      levels: visibleLevels.filter((lvl) => (lvl.category || getCategory(lvl)) === cat.id)
    }))
    .filter((cat) => cat.levels.length > 0);

  const otherLevels = visibleLevels.filter(
    (l) => !categories.some((c) => c.id === (l.category || getCategory(l)))
  );
  if (otherLevels.length) {
    catsWithLevels.push({
      id: 'other',
      title: 'Інші вулиці',
      badge: 'Додатково',
      icon: '✦',
      description: 'Рівні поза основними темами.',
      levels: otherLevels
    });
  }

  return catsWithLevels;
}

export function findNextLevel(levels, categories, done, currentId) {
  const sections = getLevelSections(levels, categories);
  const currentSection = sections.findIndex((section) =>
    section.levels.some((level) => level.id === currentId)
  );
  if (currentSection < 0) return null;

  const currentLevels = sections[currentSection].levels;
  const currentIndex = currentLevels.findIndex((level) => level.id === currentId);
  if (currentIndex + 1 < currentLevels.length) return currentLevels[currentIndex + 1];

  const nextSection = currentSection + 1;
  if (nextSection >= sections.length || !isCatUnlocked(nextSection, sections, done)) return null;
  return sections[nextSection].levels[0];
}

export function renderHome(container, { levels, categories, done, currentTheme }) {
  const catsWithLevels = getLevelSections(levels, categories);

  const sectionsHtml = catsWithLevels
    .map((cat, catIdx) => {
      const isUnlocked = isCatUnlocked(catIdx, catsWithLevels, done);
      if (!isUnlocked) {
        return `<section class="category-section locked" data-cat="${cat.id}">
        <div class="category-locked-simple">
          <span class="locked-icon" aria-hidden="true">🔒</span>
          <span>Розділ під замком</span>
        </div>
      </section>`;
      }

      const cardsHtml = cat.levels
        .map((l, lvlIdx) => {
          const isDone = done.includes(l.id);
          const lvlNum = `${catIdx + 1}.${lvlIdx + 1}`;
          return `<a href="#level=${l.id}" class="level-card ${isDone ? 'completed-card' : ''}">
        <div class="card-art" style="flex-direction:column;gap:8px">
          <span class="level-number">${lvlNum}</span>
          <span class="level-name">${esc(l.name)}</span>
          ${isDone ? '<span class="completed-badge"><span class="badge-icon">✓</span> Пройдено</span>' : ''}
        </div>
        <div class="card-body">
          <p>${esc(getLevelDescription(l, currentTheme))}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:6px">
            <span style="font-size:11px;color:#8da4b3">${l.allowed.length} ком.</span>
            ${l.limit ? `<span class="card-limit" style="margin-top:0">Ліміт: ${l.limit}</span>` : ''}
          </div>
        </div>
      </a>`;
        })
        .join('');

      return `<section class="category-section" data-cat="${cat.id}">
      <div class="level-grid home-level-grid">${cardsHtml}</div>
    </section>`;
    })
    .join('');

  const heroEyebrow =
    currentTheme === 'light'
      ? 'ЕНЕРГООЩАДНІ АЛГОРИТМИ ДНЯ'
      : 'АЛГОРИТМИ ПІСЛЯ ЗАХОДУ СОНЦЯ';
  const heroH1 =
    currentTheme === 'light'
      ? 'Ясний день над містом.<br>Твій хід — вимкни зайве.'
      : 'Місто заснуло.<br>Твій хід — світити.';
  const heroDesc =
    currentTheme === 'light'
      ? 'Складай команди, знаходь непотрібні ліхтарі, що палають удень, та викручуй їх для збереження енергії.'
      : 'Складай команди, долай сходинки й запалюй ліхтарі. Проходь навчальні теми від базового руху до циклів і розгалужень.';

  container.innerHTML = `<section class="hero"><div class="hero-copy"><span class="eyebrow">${heroEyebrow}</span><h1>${heroH1}</h1><p>${heroDesc}</p></div></section><div class="categories-container">${sectionsHtml}</div>`;
}
