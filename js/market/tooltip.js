// Price tooltips are drawn in one page-level layer, so tables and scroll areas never clip them.
// Each price keeps its reasons in a hidden element that aria-describedby points at (screen readers get every line).
// The layer shows the main reason and the price first; "Why?" (click, tap again, or Enter) opens the rest.
let layer = null, anchor = null, expanded = false;

function show(tip, open = false) {
  const body = tip.querySelector('.price-tip-body');
  if (!body) return;
  layer ??= Object.assign(document.body.appendChild(document.createElement('div')), {className: 'price-tip-layer', role: 'presentation'});
  layer.setAttribute('aria-hidden', 'true');
  const lines = [...body.children].map(line => line.outerHTML);
  const total = lines.length > 1 ? lines.at(-1).replace('<span', '<span class="tip-total"') : '';
  const reasons = lines.length > 1 ? lines.slice(0, -1) : lines;
  layer.innerHTML = open || reasons.length <= 1 ? reasons.join('') + total
    : reasons[0] + total + `<em class="tip-more">Why? ${reasons.length - 1} more reason${reasons.length > 2 ? 's' : ''}: click or press Enter</em>`;
  layer.hidden = false;
  anchor = tip;
  expanded = open;
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
  expanded = false;
}

export function installPriceTooltips() {
  document.addEventListener('mouseover', event => { const tip = event.target.closest?.('.price-tip'); if (tip && tip !== anchor) show(tip); });
  document.addEventListener('mouseout', event => { if (anchor && !anchor.contains(event.relatedTarget) && document.activeElement !== anchor) hide(); });
  document.addEventListener('focusin', event => { const tip = event.target.closest?.('.price-tip'); tip ? (tip !== anchor && show(tip)) : hide(); });
  document.addEventListener('focusout', event => { if (anchor && event.target === anchor) hide(); });
  document.addEventListener('click', event => { const tip = event.target.closest?.('.price-tip'); if (tip) show(tip, tip === anchor ? !expanded : true); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
    if ((event.key === 'Enter' || event.key === ' ') && anchor && document.activeElement === anchor) { event.preventDefault(); show(anchor, !expanded); }
  });
  window.addEventListener('scroll', hide, {passive: true, capture: true});
  window.addEventListener('resize', hide);
  new MutationObserver(() => { if (anchor && !anchor.isConnected) hide(); }).observe(document.body, {childList: true, subtree: true});
}
