// Runs one round of the merchant agents now (normally the server does this once per market day) and prints the
// journal: each merchant's decision, who made it (NEAR AI or the rules) and its transaction.
// Run: node scripts/agents-once.mjs [count]   (needs testnet keys, the agent keys and optionally NEAR_AI_API_KEY in .env)
import '../server/env.js';
import {openStore} from '../server/store.js';
import {createChain} from '../server/chain/service.js';
import {createAgents} from '../server/agents.js';

const store = await openStore('memory');
const chain = createChain({store, enabled: true});
const agents = createAgents({store, chain, perRound: Number(process.argv[2] || 1)});
await agents.round();
for (const [id, [entry]] of Object.entries(store.data.journal ?? {})) {
  console.log(`${id} (${entry.source}${entry.code ? ', ' + entry.code : ''}): “${entry.say}”`);
  for (const c of entry.changes) console.log(`   wants ${c.name}: ${c.from / 100}% → ${c.to / 100}%`);
  if (entry.specialty) console.log(`   specialty: ${entry.specialty}`);
  if (entry.tx) console.log(`   https://testnet.nearblocks.io/txns/${entry.tx}`);
}
