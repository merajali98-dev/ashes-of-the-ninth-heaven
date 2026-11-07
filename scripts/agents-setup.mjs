// Gives each merchant account an agent key: a function-call key that can ONLY call `merchant_set_strategy` on the items
// contract. The game server holds these agent keys, never the merchants' full keys, so the strategist can adjust a shop's
// wants once a day within the contract's limits and can do nothing else. Re-runnable: existing agent keys are kept.
// Run: node scripts/agents-setup.mjs   (keys go to ~/.near-credentials/testnet-agents/, or set NEAR_AGENT_KEY_<ACCOUNT>)
import {parseNearAmount} from 'near-api-js';
import * as R from '../js/market/merchant-rules.js';
import {CONTRACT, account, loadAgentKey, merchantAccount, newKeyPair, provider, saveAgentKey} from '../server/chain/near.js';

for (const m of R.MERCHANTS) {
  const id = merchantAccount(m.id);
  const existing = await loadAgentKey(id);
  if (existing) {
    const keys = await provider.viewAccessKeyList({accountId: id});
    const pub = (await import('near-api-js')).KeyPair.fromString(existing).getPublicKey().toString();
    if (keys.keys.some(k => k.public_key === pub)) { console.log(`✓ ${id} has its agent key`); continue; }
  }
  const key = newKeyPair();
  const owner = await account(id);
  await owner.addFunctionCallAccessKey({publicKey: key.getPublicKey(), contractId: CONTRACT, methodNames: ['merchant_set_strategy'],
    allowance: BigInt(parseNearAmount('0.05'))});
  await saveAgentKey(id, key);
  console.log(`+ ${id}: agent key added (merchant_set_strategy only)`);
}
