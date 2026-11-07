// The merchant agents. Once per market day each merchant decides how much of each good it wants to keep (its targets,
// 60–160% of usual) and which school it specialises in, and signs that decision from its own account with a key that
// can do nothing else (merchant_set_strategy). The relayer pays the gas.
//   Layer 1, the rules: always available, deterministic (oversupplied goods are wanted less, scarce ones more, the
//     Edict's school more), and the fallback whenever the model is missing, slow or wrong.
//   Layer 2, NEAR AI Cloud: the merchant, in character, may adjust those choices. Its reply is parsed, checked and
//     clamped to the same limits the contract enforces. Prices are never set by the model: they still come only from
//     js/market/merchant-rules.js.
// Each decision is written to a journal the game shows on the merchant's stall, with a link to its transaction.
import * as R from '../js/market/merchant-rules.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {characters, schools} from '../js/content.js';

const [MIN, MAX] = [R.ADAPTATION.minBps, R.ADAPTATION.maxBps];
const MAX_CHANGES = 5;
const CHAIN_WORDS = /\b(wallets?|blockchain|crypto\w*|token|NEAR|gas|seed phrase|testnet|transaction)\b/i;
const who = id => characters.find(c => c.id === id);
const schoolName = id => schools.find(s => s.id === id)?.name ?? id;
const clamp = bps => Math.max(MIN, Math.min(MAX, Math.round(bps / 100) * 100));
const name = id => MARKET_TOKENS[id]?.name ?? id;

/** The rules' decision for one merchant's books (as the contract's market_merchant view returns them). */
export function rulesDecision(books, tick) {
  const def = R.MERCHANTS.find(m => m.id === books.rules_id);
  const edict = R.edictSchool(tick);
  const changes = [];
  for (const g of books.goods) {
    const token = MARKET_TOKENS[g.token_id];
    if (!token || (token.tier ?? 1) > 3) continue;
    const stock = Number(g.stock), target = Number(g.target), base = Number(g.base_target);
    if (!base) continue;
    const now = Math.round(target * R.BPS / base);
    let want = now, why = null;
    if (stock > target * 2.5) { want = 7_500; why = 'glut'; }
    else if (stock * 10 < target * 4) { want = 12_500; why = 'scarce'; }
    else if (token.school === edict) { want = 12_000; why = 'edict'; }
    else if (Math.abs(now - R.BPS) >= 1_000) { want = now + Math.sign(R.BPS - now) * 500; why = 'settle'; }
    want = clamp(want);
    if (Math.abs(want - now) >= 500) changes.push({token: g.token_id, from: now, to: want, why, weight: Math.abs(want - now)});
  }
  changes.sort((a, b) => b.weight - a.weight);
  const chosen = changes.slice(0, MAX_CHANGES);
  const trades = family => Boolean(def?.families?.[family]);
  const specialty = trades(`essence-${edict}`) ? edict : null;
  return {targets: chosen.map(c => [c.token, c.to]), specialty, changes: chosen, say: rulesLine(chosen[0], edict), source: 'rules'};
}

function rulesLine(top, edict) {
  if (!top) return 'My shelves sit where I want them. Nothing to change today.';
  const n = name(top.token);
  if (top.why === 'glut') return `I'm drowning in ${n}. I'll want less of it and pay less until it clears.`;
  if (top.why === 'scarce') return `${n} keeps leaving my shelf. I'll want more of it tomorrow and pay a little better.`;
  if (top.why === 'edict') return `The Pagoda Edict favours ${schoolName(edict)}, so I'm keeping more ${n} on hand.`;
  return `${n} has settled. I'll bring my wants back toward the usual.`;
}

/** NEAR AI's decision, in character; falls back to `rules` on any problem. */
export async function aiDecision(books, tick, rules, {fetchImpl = fetch, apiKey = process.env.NEAR_AI_API_KEY, model = process.env.NEAR_AI_MODEL || 'z-ai/glm-5.3-flash'} = {}) {
  if (!apiKey) return rules;
  const def = R.MERCHANTS.find(m => m.id === books.rules_id), c = who(books.rules_id);
  const edict = R.edictSchool(tick), event = R.activeEvent(tick);
  const goods = books.goods.filter(g => (MARKET_TOKENS[g.token_id]?.tier ?? 1) <= 3).slice(0, 18).map(g => ({
    id: g.token_id, name: name(g.token_id), stock: Number(g.stock), want: Number(g.target), usual: Number(g.base_target), recentFlow: g.flow}));
  const system = `You are ${books.name}, ${c?.role ?? 'a merchant'} in the Night Bazaar of a dark xianxia city. ${c?.description ?? ''} `
    + `Temperament: ${def?.temperament ?? 'cautious'}. Once a market day you decide how much of each good you want to keep, as a percentage of `
    + `your usual amount between 60 and 160, and optionally a specialty school. Wanting more of a good makes you pay more for it; wanting less makes you pay less. `
    + `Reply with JSON only: {"targets": {"<good id>": <percent>}, "specialty": "<school id or null>", "say": "<one sentence in your own voice, under 25 words, why>"}. `
    + `Change at most ${MAX_CHANGES} goods. Speak only of the bazaar, its goods and its people.`;
  const user = JSON.stringify({day: Math.floor(tick / 24) + 1, edictFavours: {id: edict, name: schoolName(edict)}, event: event?.text ?? null, goods,
    advisorSuggests: Object.fromEntries(rules.targets.map(([id, bps]) => [id, bps / 100]))});
  try {
    const res = await fetchImpl('https://cloud-api.near.ai/v1/chat/completions', {method: 'POST', signal: AbortSignal.timeout(25_000),
      headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({model, reasoning_effort: 'low', max_tokens: 700, messages: [{role: 'system', content: system}, {role: 'user', content: user}]})});
    if (!res.ok) return rules;
    const text = (await res.json()).choices?.[0]?.message?.content ?? '';
    const reply = JSON.parse(/\{[\s\S]*\}/.exec(text)?.[0] ?? 'null');
    if (!reply || typeof reply !== 'object') return rules;
    const traded = new Map(books.goods.map(g => [g.token_id, Math.round(Number(g.target) * R.BPS / Math.max(1, Number(g.base_target)))]));
    const changes = Object.entries(reply.targets ?? {}).filter(([id, pct]) => traded.has(id) && Number.isFinite(Number(pct)))
      .slice(0, MAX_CHANGES).map(([id, pct]) => ({token: id, from: traded.get(id), to: clamp(Number(pct) * 100), why: 'agent'}))
      .filter(ch => ch.to !== ch.from);
    const say = typeof reply.say === 'string' && reply.say.length <= 220 && !CHAIN_WORDS.test(reply.say) ? reply.say.trim() : rules.say;
    const specialty = schools.some(s => s.id === reply.specialty) ? reply.specialty : rules.specialty;
    return {targets: changes.map(ch => [ch.token, ch.to]), specialty, changes, say, source: 'near-ai', model};
  } catch { return rules; }
}

/** Runs the agents on a timer: at most a few merchants per minute, each once per market day. */
export function createAgents({store, chain, decide = aiDecision, every = 60_000, perRound = 3}) {
  const data = store.data;
  let timer = null, running = false;
  async function round() {
    if (running || !(await chain.online()) || !(await chain.agentsReady())) return;
    running = true;
    try {
      const market = await chain.market();
      const day = Math.floor(market.tick / R.TIME.ticksPerDay);
      const due = market.merchants.filter(m => (data.agents?.[m.account_id]?.day ?? -1) < day).slice(0, perRound);
      for (const books of due) {
        const rules = rulesDecision(books, market.tick);
        const decision = await decide(books, market.tick, rules);
        const result = await chain.agentCall(books.account_id, 'merchant_set_strategy', {target_bps: decision.targets, specialty: decision.specialty});
        const entry = {day, at: Date.now(), say: decision.say, source: decision.source, specialty: decision.specialty,
          changes: decision.changes.map(c => ({token: c.token, name: name(c.token), from: c.from, to: c.to})), tx: result.tx ?? null,
          ok: result.ok || result.code === 'STRATEGY_ALREADY_SET_TODAY', code: result.ok ? null : result.code};
        data.agents ??= {};
        data.agents[books.account_id] = {day};
        data.journal ??= {};
        data.journal[books.rules_id] = [entry, ...(data.journal[books.rules_id] ?? [])].slice(0, 12);
        store.save();
      }
      if (due.length) chain.forgetBooks();
    } catch (error) {
      console.error('agents', error.message);
    } finally { running = false; }
  }
  return {
    round,
    start() { if (!timer) { timer = setInterval(round, every); timer.unref?.(); setTimeout(round, 5_000).unref?.(); } },
    stop() { clearInterval(timer); timer = null; },
  };
}
