// Price tooltips are drawn in one page-level layer, so tables and scroll areas never clip them.
// Each price keeps its reasons in a hidden element that aria-describedby points at; this layer shows a copy
// on hover, keyboard focus or tap, and keeps it fully on screen.
let layer = null, anchor = null;

function show(tip) {
  const body = tip.querySelector('.price-tip-body');
  if (!body) return;
  layer ??= Object.assign(document.body.appendChild(document.createElement('div')), {className: 'price-tip-layer', role: 'presentation'});
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = body.innerHTML;
  layer.hidden = false;
  anchor = tip;
  const box = tip.getBoundingClientRect(), width = Math.min(320, window.innerWidth - 24);
  layer.style.width = width + 'px';
  const height = layer.offsetHeight;
  const above = box.top - height - 10, below = box.bottom + 10;
  layer.style.top = (above >= 8 || below + height > window.innerHeight ? Math.max(8, above) : below) + 'px';
  layer.style.left = Math.max(12, Math.min(window.innerWidth - width - 12, box.left + box.width / 2 - width / 2)) + 'px';
}
function hide() {
  if (layer) layer.hidden = true;
  anchor = null;
}

export function installPriceTooltips() {
  document.addEventListener('mouseover', event => { const tip = event.target.closest?.('.price-tip'); if (tip && tip !== anchor) show(tip); });
  document.addEventListener('mouseout', event => { if (anchor && !anchor.contains(event.relatedTarget) && document.activeElement !== anchor) hide(); });
  document.addEventListener('focusin', event => { const tip = event.target.closest?.('.price-tip'); tip ? show(tip) : hide(); });
  document.addEventListener('focusout', event => { if (anchor && event.target === anchor) hide(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, {passive: true, capture: true});
  window.addEventListener('resize', hide);
  new MutationObserver(() => { if (anchor && !anchor.isConnected) hide(); }).observe(document.body, {childList: true, subtree: true});
}
