// Gives each merchant account an agent key: a function-call key that can ONLY call `merchant_set_strategy`,
// `merchant_post_job` and `merchant_fill_job` on the items contract. The game server holds these agent keys, never the
// merchants' full keys, so the agent can adjust a shop's wants once a day, post paid jobs and fill other merchants' jobs,
// within the contract's limits, and nothing else.
// Re-runnable: a key that already has every method is kept; an older key is replaced and then deleted.
// Run: node scripts/agents-setup.mjs   (keys go to ~/.near-credentials/testnet-agents/, or set NEAR_AGENT_KEY_<ACCOUNT>)
import {KeyPair, parseNearAmount} from 'near-api-js';
import * as R from '../js/market/merchant-rules.js';
import {CONTRACT, account, loadAgentKey, merchantAccount, newKeyPair, provider, saveAgentKey} from '../server/chain/near.js';

export const AGENT_METHODS = ['merchant_set_strategy', 'merchant_post_job', 'merchant_fill_job'];

for (const m of R.MERCHANTS) {
  const id = merchantAccount(m.id);
  const existing = await loadAgentKey(id);
  let old = null;
  if (existing) {
    const keys = await provider.viewAccessKeyList({accountId: id});
    const pub = KeyPair.fromString(existing).getPublicKey().toString();
    const found = keys.keys.find(k => k.public_key === pub);
    const methods = found?.access_key?.permission?.FunctionCall?.method_names ?? [];
    if (found && AGENT_METHODS.every(name => methods.includes(name))) { console.log(`✓ ${id} has its agent key`); continue; }
    if (found) old = pub;
  }
  const key = newKeyPair();
  const owner = await account(id);
  await owner.addFunctionCallAccessKey({publicKey: key.getPublicKey(), contractId: CONTRACT, methodNames: AGENT_METHODS,
    allowance: BigInt(parseNearAmount('0.05'))});
  await saveAgentKey(id, key);
  if (old) await owner.deleteKey(old);
  console.log(`+ ${id}: agent key added (${AGENT_METHODS.join(', ')} only)${old ? '; the older key was deleted' : ''}`);
}
