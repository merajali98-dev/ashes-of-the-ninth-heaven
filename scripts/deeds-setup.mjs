// Mints one Shop Deed (NEP-171) per merchant to the Ministry, and points token media at the hosted game so each deed's
// picture is drawn live from its shop (/deeds/<merchant>.svg). Re-runnable: existing deeds are left alone.
// Run: node scripts/deeds-setup.mjs [base-url]
import {teraToGas} from 'near-api-js';
import {CONTRACT, PARENT, account, view} from '../server/chain/near.js';

const base = process.argv[2] || 'https://ashes-ninth.duckdns.org/';
const owner = await account(PARENT);
const call = (methodName, args) => owner.callFunction({contractId: CONTRACT, methodName, args, gas: teraToGas(150)});
const minted = await call('deed_mint_all', {});
console.log(minted.length ? `+ minted ${minted.join(', ')}` : '✓ every shop already has its deed');
await call('set_base_uri', {base_uri: base});
const deeds = await view('deeds');
console.log(`✓ ${deeds.length} deeds; media under ${base}deeds/; e.g. ${JSON.stringify(await view('nft_token', {token_id: 'deed:lu-yan'})).slice(0, 220)}…`);
