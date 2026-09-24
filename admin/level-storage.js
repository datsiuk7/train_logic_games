import { categories } from '../logic.mjs';

const TRANSLIT = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
  'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
  'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '',
  'ю': 'yu', 'я': 'ya', 'ё': 'yo', 'э': 'e', 'ъ': '', 'ы': 'y'
};

export function slugify(name) {
  return name
    .toLowerCase()
    .split('')
    .map((c) => TRANSLIT[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'level';
}

export async function getExistingIds() {
  try {
    const r = await fetch('../levels/index.json', { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data)) return data;
    }
  } catch {}
  return [];
}

export function makeUniqueId(nameOrId, existingIds, currentSavedId = null) {
  const cleanBase = slugify(nameOrId) || 'level';
  if (!existingIds.includes(cleanBase) || cleanBase === currentSavedId) return cleanBase;
  let prefix = cleanBase;
  let num = 2;
  const m = cleanBase.match(/^(.*?)-(\d+)$/);
  if (m) {
    prefix = m[1];
    num = parseInt(m[2], 10) + 1;
  }
  let candidate = `${prefix}-${num}`.slice(0, 60);
  while (existingIds.includes(candidate) && candidate !== currentSavedId) {
    num++;
    candidate = `${prefix}-${num}`.slice(0, 60);
  }
  return candidate;
}

export async function fetchCategories() {
  try {
    const r = await fetch('../api/structure', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d.categories) && d.categories.length) {
        return d.categories;
      }
    }
  } catch {}
  try {
    const r = await fetch('../levels/categories.json', { cache: 'no-store' });
    if (r.ok) {
      return await r.json();
    }
  } catch {}
  return [...categories];
}

export async function saveLevelToServer(candidate, overwrite) {
  const r = await fetch('../api/levels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
    body: JSON.stringify({ level: candidate, overwrite })
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || 'Помилка збереження.');
  return result;
}

export async function deleteLevelOnServer(id) {
  const r = await fetch('../api/levels/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
    body: JSON.stringify({ id })
  });
  return r.ok;
}

export async function reorderLevelsOnServer(ids) {
  const r = await fetch('../api/levels/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Local-Editor': '1' },
    body: JSON.stringify({ ids })
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || 'Помилка зміни порядку рівнів.');
  return result;
}

export async function fetchStructureLevels() {
  try {
    const r = await fetch('../api/structure', { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      return {
        categories: Array.isArray(data.categories) ? data.categories : [],
        levels: Array.isArray(data.levels) ? data.levels : []
      };
    }
  } catch {}

  const loaded = [];
  try {
    const r = await fetch('../levels/index.json', { cache: 'no-store' });
    if (r.ok) {
      const ids = await r.json();
      for (const id of ids) {
        try {
          const lr = await fetch(`../levels/${id}.json`, { cache: 'no-store' });
          if (lr.ok) loaded.push(await lr.json());
        } catch {}
      }
    }
  } catch {}

  return { categories: [], levels: loaded };
}
