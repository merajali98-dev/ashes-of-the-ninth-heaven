// The browser side of sign-in and the ledger seal. Everything degrades to the practice market: if the page is served
// without the game server (a static host, file://) or the server has no ledger, `state.ledger` stays false.
import {deviceKey, forgetDeviceKey} from './keystore.js';
import {signDelegate, supported} from './signer.js';

export const state = {loaded: false, signedIn: false, user: null, signIn: null, ledger: false, busy: false};

async function call(method, path, body) {
  const res = await fetch(path, {method, credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', 'X-Ashes': '1'}, body: body ? JSON.stringify(body) : undefined});
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || 'SERVER'), {code: json.error || 'SERVER', status: res.status});
  return json;
}
const remember = json => {
  if (json.user) { state.user = json.user; state.signedIn = true; }
  return json;
};

export async function load() {
  try {
    const json = await call('GET', '/api/session');
    Object.assign(state, {loaded: true, signedIn: json.signedIn, user: json.user, signIn: json.signIn, ledger: json.ledger && supported()});
  } catch {
    Object.assign(state, {loaded: true, signedIn: false, user: null, signIn: null, ledger: false});
  }
  return state;
}

export const guest = name => call('POST', '/api/auth/guest', {name}).then(remember);
export const emailStart = email => call('POST', '/api/auth/email', {email});
export const emailVerify = (email, code) => call('POST', '/api/auth/email/verify', {email, code}).then(remember);
export const google = credential => call('POST', '/api/auth/google', {credential}).then(remember);

export async function signOut() {
  await call('POST', '/api/auth/logout').catch(() => {});
  await forgetDeviceKey();
  Object.assign(state, {signedIn: false, user: null});
}

/** Presses the player's seal: makes (or reuses) this browser's key and links it to their account on the ledger. */
export async function ensureSeal(name = '') {
  if (!state.ledger || !state.signedIn) return state.user;
  const {publicKey} = await deviceKey();
  const json = await call('POST', '/api/seal', {publicKey, ...(name ? {name} : {})});
  return remember(json).user;
}

let lastNonce = 0n;
/** Signs one market call with the device key and hands it to the relayer. Returns {ok, receipt, code}. */
export async function sealCall(contractId, methodName, args) {
  const {keyPair, publicKey} = await deviceKey();
  const next = await call('GET', '/api/seal/next?key=' + encodeURIComponent(publicKey));
  const nonce = BigInt(next.nonce) > lastNonce ? BigInt(next.nonce) : lastNonce + 1n;
  lastNonce = nonce;
  const signed = await signDelegate(keyPair, {senderId: state.user.seal.id, receiverId: contractId, publicKey, nonce,
    maxBlockHeight: BigInt(next.maxBlockHeight), actions: [{methodName, args, gas: 100_000_000_000_000n, deposit: 0n}]});
  return call('POST', '/api/seal/relay', signed);
}

// Google's own "Sign in with Google" button (Google Identity Services), loaded only when the sign-in dialog opens.
let gis = null;
export function mountGoogleButton(container, onCredential) {
  const clientId = state.signIn?.google;
  if (!container || !clientId) return;
  gis ??= new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), {src: 'https://accounts.google.com/gsi/client', async: true});
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  gis.then(() => {
    window.google.accounts.id.initialize({client_id: clientId, callback: ({credential}) => onCredential(credential), ux_mode: 'popup'});
    window.google.accounts.id.renderButton(container, {theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 280});
  }).catch(() => { container.textContent = 'Google sign-in could not load. Use your email instead.'; });
}
