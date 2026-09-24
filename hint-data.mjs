export const hintTargets = {
  palette: 'Доступні команди',
  program: 'Поле програми',
  run: 'Кнопка «Запустити»',
  scene: 'Ігрове поле'
};

export function validateHints(hints, allowedCommands = null) {
  if (!Array.isArray(hints) || hints.length > 5) {
    return 'Підказок може бути від 0 до 5.';
  }
  for (const hint of hints) {
    if (!hint || typeof hint.text !== 'string' || !hint.text.trim() || hint.text.length > 180) {
      return 'Текст кожної підказки має містити від 1 до 180 символів.';
    }
    if (Object.hasOwn(hintTargets, hint.target)) continue;
    if (allowedCommands && typeof hint.target === 'string' && hint.target.startsWith('command:') &&
      allowedCommands.includes(hint.target.slice(8))) continue;
    return 'Підказка вказує на недоступну команду або невідоме місце.';
  }
  return null;
}

export function chooseHints(level) {
  if (Array.isArray(level.hints) && level.hints.length && !validateHints(level.hints, level.allowed)) {
    return level.hints;
  }
  return [];
}
