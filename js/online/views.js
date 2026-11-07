// The sign-in dialog ("press your ledger seal"), its Settings section and the market header chip.
// Words follow the fiction: the account is a ledger seal, the chain is the Honest Ledger. Nothing to write down.
import {button, esc} from '../ui.js';

const NAME_HINT = '3–20 lowercase letters, numbers or dashes, starting with a letter.';
const promise = '<p class="microcopy seal-promise">Nothing to write down and nothing to pay. Sign in again with the same Google account or email and your seal comes back.</p>';

const nameField = value => `<label class="seal-field"><span>Name in the ledger <em>(optional)</em></span>
  <input id="seal-name" type="text" inputmode="latin" autocomplete="nickname" maxlength="20" pattern="[a-z][a-z0-9-]{2,19}" placeholder="shen-luo" value="${esc(value || '')}">
  <small>${NAME_HINT}</small></label>`;

export function sealDialog(state, flow = {}) {
  const title = 'Your ledger seal', subtitle = 'THE HONEST LEDGER';
  if (state.signedIn && state.user?.seal) {
    return {title, subtitle, body: `<p class="dialog-lead">Sealed as <strong>${esc(state.user.name)}</strong>. Every trade you make with the merchants is recorded on the Honest Ledger under your seal.</p>
      ${state.user.email ? `<p class="microcopy">Signed in as ${esc(state.user.email)}.</p>` : state.user.kind === 'guest' ? '<p class="microcopy">Playing as a guest. Add an email or Google account below to keep this seal on any device.</p>' : ''}
      ${state.user.kind === 'guest' ? choices(state, flow, {upgrade: true}) : ''}
      <div class="settings-list">${button('Go to the Ash Market', 'nav', 'market', {icon: 'bag'})}${button('Sign out on this device', 'seal-signout', '', {className: 'quiet'})}</div>`};
  }
  if (state.signedIn && state.ledger) {
    return {title, subtitle, body: `<p class="dialog-lead">Signed in as <strong>${esc(state.user?.name || 'Cultivator')}</strong>. Press your seal to trade on the Honest Ledger.</p>
      ${nameField(flow.name)}<div class="settings-list">${button(flow.busy ? 'Pressing your seal…' : 'Press my seal', 'seal-press', '', {icon: 'jade', disabled: flow.busy})}</div>${promise}`};
  }
  if (!state.ledger && !state.signIn) {
    return {title, subtitle, body: `<p class="dialog-lead">The Honest Ledger is closed in this copy of the game, so the Ash Market runs as a practice market in this browser.</p>
      <p class="microcopy">Everything still works: merchants, prices, reasons and the fast-forward week. Run the game with <code>npm start</code> to sign in.</p>`};
  }
  return {title, subtitle, body: `<p class="dialog-lead">Press your seal to trade on the Honest Ledger with every other cultivator. Your practice market stays in this browser.</p>
    ${choices(state, flow)}${promise}`};
}

function choices(state, flow, {upgrade = false} = {}) {
  if (flow.step === 'code') {
    return `<section class="seal-step"><h3>Enter your code</h3><p class="microcopy">${flow.sent ? `We sent a 6-digit code to ${esc(flow.email)}. It works once, for 15 minutes. Check your spam folder too.` : `Development sign-in: no email is sent, so your code is shown here.`}</p>
      ${flow.dev ? `<p class="seal-dev">Code <strong>${esc(flow.dev.code)}</strong> ${button('Use this code', 'seal-use-code', flow.dev.code, {className: 'quiet'})} <a href="${esc(flow.dev.link)}">or open the link</a></p>` : ''}
      <label class="seal-field"><span>Code</span><input id="seal-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" value="${esc(flow.code || '')}" autofocus></label>
      <div class="settings-list">${button('Sign in', 'seal-email-verify', '', {icon: 'jade', disabled: flow.busy})}${button('Use another email', 'seal-back', '', {className: 'quiet'})}</div></section>`;
  }
  return `${upgrade ? '' : nameField(flow.name)}
    ${state.signIn?.google ? `<section class="seal-step"><div id="seal-google" class="seal-google" aria-label="Continue with Google"></div></section>` : ''}
    <section class="seal-step"><label class="seal-field"><span>Email</span><input id="seal-email" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(flow.email || '')}"></label>
      <div class="settings-list">${button(flow.busy ? 'Sending…' : 'Send me a code', 'seal-email-send', '', {icon: 'book', disabled: flow.busy})}</div></section>
    ${upgrade ? '' : `<section class="seal-step">${button('Play as a guest', 'seal-guest', '', {className: 'quiet', disabled: flow.busy})}<p class="microcopy">A guest seal lives on this device. You can add an email later and keep it.</p></section>`}`;
}

/** The Ledger seal block inside Settings. This is the one place the real record is linked. */
export function settingsSection(state) {
  if (!state.ledger && !state.signIn) return '';
  if (!state.signedIn) return `<section class="ledger-seal"><h3>Ledger seal</h3><p class="microcopy">Sign in to trade with every other cultivator on the Honest Ledger.</p>${button('Press your seal', 'seal-open', '', {icon: 'jade'})}</section>`;
  const seal = state.user?.seal;
  return `<section class="ledger-seal"><h3>Ledger seal</h3>
    <p class="microcopy">${esc(state.user.name)}${state.user.email ? ' · ' + esc(state.user.email) : state.user.kind === 'guest' ? ' · guest' : ''}</p>
    ${seal ? `<p class="microcopy">Seal <code>${esc(seal.id)}</code> · <a href="https://testnet.nearblocks.io/address/${encodeURIComponent(seal.id)}" target="_blank" rel="noopener">View my records</a></p>` /* chain-words-ok */ : ''}
    <div class="settings-list">${button('Manage seal', 'seal-open', '', {icon: 'jade'})}${button('Sign out on this device', 'seal-signout', '', {className: 'quiet'})}</div></section>`;
}

/** The chip at the top of every screen: Sign in, or the name of the seal in use. */
export function headerChip(state) {
  if (!state.loaded || (!state.ledger && !state.signIn)) return '';
  if (state.signedIn && state.user?.seal) return `<button type="button" class="seal-chip sealed header-seal" data-action="seal-open" title="Your ledger seal">${esc(state.user.name)}</button>`;
  return `<button type="button" class="seal-chip header-seal" data-action="seal-open">Sign in</button>`;
}

/** A small chip in the market header: practice market, or the seal in use. */
export function marketChip(state) {
  if (!state.loaded || (!state.ledger && !state.signIn)) return '';
  if (state.signedIn && state.user?.seal) return `<button type="button" class="seal-chip sealed" data-action="seal-open">Sealed · ${esc(state.user.name)}</button>`;
  return `<button type="button" class="seal-chip" data-action="seal-open">Practice market · Press your seal</button>`;
}
