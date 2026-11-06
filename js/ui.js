const paths = {
  crest:'M12 2 22 12 12 22 2 12 12 2ZM6.5 15.5c4-2 5.5-5 5.5-9 1 3 2.7 5.2 5.5 6.5-2 0-3.6-.6-4.7-1.9-1 3.3-3 4.5-6.3 4.4Z',
  home:'M3 12 12 4l9 8M5 11v9h14v-9M10 20v-6h4v6',
  compass:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 6-2.4 5.6L8 16l2.4-5.6L16 8Z',
  cards:'m5 4 10-2 4 15-10 3L5 4Zm1 3-3 1 4 14 9-2m-4-13 2 3-1 3-3-2 2-4Z',
  bag:'M8 3h8l-2 5c4 1 7 4 7 8v3H3v-3c0-4 3-7 7-8L8 3Zm1 5h6m-6 7h6',
  forge:'M3 9h18l-4 5h-3v4l3 2H7l3-2v-4H7L3 9ZM9 5h6',
  market:'M3 9h18l-2-5H5L3 9Zm1 0v11h16V9M9 20v-6h6v6',
  tower:'m4 10 8-6 8 6H4Zm2 5 6-5 6 5H6Zm-2 5 8-5 8 5H4ZM12 4V2',
  book:'M3 5h7l2 2 2-2h7v14h-7l-2 2-2-2H3V5Zm9 2v14M6 9h3m-3 4h3m6-4h3m-3 4h3',
  heart:'M12 21 4.4 13C-1 7 6 2 12 7c6-5 13 0 7.6 6L12 21Z',
  jade:'m12 2 8 7-8 13L4 9l8-7Zm-8 7h16m-11 0 3 13 3-13',
  essence:'M12 2c2 6 7 8 7 13a7 7 0 0 1-14 0c0-5 5-7 7-13Zm0 9c1 2 3 4 3 6a3 3 0 1 1-6 0c0-2 2-4 3-6Z',
  arrow:'M4 12h15m-6-6 6 6-6 6',
  sword:'m20 4-3 8-8 5-2-2 5-8 8-3ZM5 12l7 7m-8 1 4-4',
  shield:'m12 3 8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z',
  lock:'M5 10h14v11H5V10Zm3 0V7a4 4 0 0 1 8 0v3m-4 5v2',
  check:'m4 12 5 5L20 6',
  close:'m6 6 12 12M18 6 6 18',
  sound:'M4 9h4l5-4v14l-5-4H4V9Zm12-1a5 5 0 0 1 0 8m2-11a9 9 0 0 1 0 14',
  mute:'M4 9h4l5-4v14l-5-4H4V9Zm12 1 5 5m0-5-5 5',
  gear:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM10 2h4l1 3 3 1 3 4-2 2 2 2-3 4-3 1-1 3h-4l-1-3-3-1-3-4 2-2-2-2 3-4 3-1 1-3Z',
  spark:'M12 2v20M2 12h20M5 5l14 14M19 5 5 19',
  menu:'M4 6h16M4 12h16M4 18h16',
  moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
  burn:'M12 2c3 5 1 6 4 8l2-2c5 9-1 14-6 14S1 16 6 9l1 4c3-2 4-6 5-11Zm0 11c-5 5-1 8 1 6 2-2 0-3-1-6Z',
  poison:'M7 3h10l-3 6 6 9-2 3H6l-2-3 6-9-3-6Zm1 12h8m-6 3h1m3-6h1',
  bleed:'M12 2c-1 5-7 9-7 14a7 7 0 0 0 14 0c0-5-6-9-7-14Zm-3 13-1 3',
  weak:'M3 6 8 3l4 5 4-5 5 3-5 6 3 8-7-4-7 4 3-8-5-6Z',
  vulnerable:'m12 2 9 5-3 10-6 5-6-5L3 7l9-5Zm0 3-2 7 5-2-3 9',
  focus:'M12 2v4m0 12v4M2 12h4m12 0h4M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  regen:'M5 8a8 8 0 1 1-1 9M3 3v6h6m3 1v7m-3-4h6',
  ward:'m12 2 9 5-3 10-6 5-6-5L3 7l9-5Zm0 4-4 6 4 6 4-6-4-6Z',
  spell:'m14 2-3 7H5l5 5-2 8 6-7h5l-4-5 3-8h-4Z',
};

export const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="' + (paths[name] || paths.spark) + '"/></svg>';
export const esc = (text = '') => String(text ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const titleCase = (text = '') => String(text).replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
export const button = (label, action, id = '', options = {}) =>
  '<button type="button" class="btn ' + (options.className || '') + '" data-action="' + action + '" data-id="' + esc(id) + '"' +
  (options.ariaLabel ? ' aria-label="' + esc(options.ariaLabel) + '"' : '') +
  (typeof options.pressed==='boolean' ? ' aria-pressed="' + options.pressed + '"' : '') +
  (options.disabled ? ' disabled' : '') + '>' + (options.icon ? icon(options.icon) : '') + esc(label) + '</button>';
export const tag = (label, color = '') => '<span class="tag ' + color + '">' + esc(label) + '</span>';
export const meter = (now, total, color, label) =>
  '<div class="meter ' + color + '" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="' +
  Math.max(1, total) + '" aria-valuenow="' + Math.max(0, Math.min(total, now)) + '"><i style="width:' +
  Math.max(0, Math.min(100, 100 * now / Math.max(1,total))) + '%"></i></div>';

export function effectText(effect) {
  const number = effect.amount ?? effect.value ?? 0;
  switch (effect.type) {
    case 'damage': return 'Deal ' + number + (effect.hits > 1 ? ' × ' + effect.hits : '') + ' damage';
    case 'block': return 'Gain ' + number + ' guard';
    case 'heal': return 'Restore ' + number + ' vitality';
    case 'draw': return 'Draw ' + number + (number === 1 ? ' card' : ' cards');
    case 'energy': return 'Gain ' + number + ' Qi';
    case 'status': return 'Apply ' + number + ' ' + titleCase(effect.status) + (effect.target === 'self' ? ' to self' : '');
    case 'cleanse': return 'Cleanse ' + number + ' negative status' + (number === 1 ? '' : 'es');
    default: return titleCase(effect.type) + ' ' + number;
  }
}
