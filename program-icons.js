import { commands } from './logic.mjs';

const paths = {
  forward: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  left: '<path d="M19 19v-6a5 5 0 0 0-5-5H5"/><path d="m9 4-5 4 5 4"/>',
  right: '<path d="M5 19v-6a5 5 0 0 1 5-5h9"/><path d="m15 4 5 4-5 4"/>',
  jump: '<path d="M3 20h6v-7h12"/><path d="M5 16C6 8.5 12 5 18 8.5"/><path d="m14.5 5.5 4 3-2.5 4"/><circle cx="5" cy="16" r="1" fill="currentColor"/>',
  take: '<path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 3v10m-4-4 4 4 4-4"/><circle cx="12" cy="7" r="1.5" fill="currentColor"/>',
  fix: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  light: (isLightMode) => isLightMode
    ? '<path d="M9 18h6m-5 3h4M12 2a6 6 0 0 0-3.5 10.9V15a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-2.1A6 6 0 0 0 12 2Z"/><path d="m18 8 3-2m-2 5 3 1"/>'
    : '<path d="M8 7h8l-2-2h-4z"/><path d="M7 7l1.5 8h7L17 7"/><path d="M10 17h4"/><path d="M12 2v3"/><circle cx="12" cy="11" r="2" fill="currentColor"/><path d="M3 11h2m14 0h2m-14.5-5.5l1.5 1.5m10-1.5-1.5 1.5"/>',
  loop: '<path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M21 3v5h-5"/>',
  if: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12Z"/><path d="M9.8 8.8a2.3 2.3 0 0 1 4.4 0c0 1.3-1.3 1.8-1.9 2.4-.4.4-.4.8-.4 1.8"/><circle cx="11.9" cy="16.5" r=".8" fill="currentColor"/>',
  while: '<path d="M21 12a9 9 0 1 1-3.3-6.8L21 8"/><path d="M21 3v5h-5"/><path d="m9 12 2 2 4-4"/>',
  call: '<path d="M11 4c-1.8 0-3 1.2-3 3.5V18c0 1.8-1 2.5-2.5 2.5"/><path d="M5 11h7"/><path d="M15 7a6 6 0 0 1 0 10M18 5a9 9 0 0 1 0 14"/>'
};

export function iconMarkup(type, theme = 'dark') {
  const isLightMode = theme === 'light';
  const renderer = paths[type];
  const pathContent = typeof renderer === 'function' ? renderer(isLightMode) : renderer;
  const fallback = `<text x="12" y="17" text-anchor="middle" fill="currentColor" stroke="none" font-size="17">${commands[type]?.[0] || '?'}</text>`;

  return `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${pathContent || fallback}</svg>`;
}
