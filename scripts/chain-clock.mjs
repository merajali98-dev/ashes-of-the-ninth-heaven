// Sets how long a market hour lasts on the live contract (owner only). The contract rebases its clock so the current
// market hour does not change. Run: node scripts/chain-clock.mjs 300000   (one market hour per five real minutes)
import {actions} from 'near-api-js';
import {CONTRACT, PARENT, account, provider} from '../server/chain/near.js';

const ms = Number(process.argv[2]);
if (!Number.isSafeInteger(ms) || ms < 1_000) throw new Error('usage: node scripts/chain-clock.mjs <milliseconds per market hour>');
const before = await provider.callFunction({contractId: CONTRACT, method: 'contract_info', args: {}});
const owner = await account(PARENT);
const result = await owner.signAndSendTransaction({receiverId: CONTRACT, actions: [actions.functionCall('set_clock', {tick_ms: ms}, 30_000_000_000_000n, 0n)]});
const after = await provider.callFunction({contractId: CONTRACT, method: 'contract_info', args: {}});
console.log(`market hour ${before.tick} at ${before.tick_ms / 1000}s → ${after.tick} at ${after.tick_ms / 1000}s · tx ${result.transaction.hash}`);
