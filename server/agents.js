// The merchant agents. Once per market day each merchant decides how much of each good it wants to keep (its targets,
// 60–160% of usual) and which school it specialises in, and signs that decision from its own account with a key that
// can do nothing else (merchant_set_strategy). The relayer pays the gas.
//   Layer 1, the rules: always available, deterministic (oversupplied goods are wanted less, scarce ones more, the
//     Edict's school more), and the fallback whenever the model is missing, slow or wrong.
//   Layer 2, NEAR AI Cloud: the merchant, in character, may adjust those choices. Its reply is parsed, checked and
//     clamped to the same limits the contract enforces. Prices are never set by the model: they still come only from
//     js/market/merchant-rules.js.
// Each decision is written to a journal the game shows on the merchant's stall, with a link to its transaction.
//
// The same agents also hire: a merchant short of a good may post one paid job (merchant_post_job), its wage held in
// escrow by the contract; the rules pick the good and pay, the model may choose among the rules' options, and the
// contract checks the terms again (checkJob in the rules file). And they haggle: the contract decides every haggle by
// the rules file; NEAR AI only gives the merchant's answer a voice, and must state the decided price exactly.
import * as R from '../js/market/merchant-rules.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {characters, schools} from '../js/content.js';
import {haggleLines} from '../js/market/haggle-words.js';

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

const stateOf = books => {
  const map = key => Object.fromEntries(books.goods.map(g => [g.token_id, Number(g[key])]));
  return {cash: Number(books.cash), stock: map('stock'), target: map('target'), baseTarget: map('base_target'),
    flow: Object.fromEntries(books.goods.map(g => [g.token_id, g.flow])), closed: books.closed, specialty: books.specialty};
};

/** Every job the rules allow this merchant today: goods (tier 1–3) under 60% of what it wants, with the pay range. */
export function jobOptions(books, tick, testimonyBps = 0) {
  const def = R.MERCHANTS.find(m => m.id === books.rules_id);
  if (!def || books.closed || books.status !== 'open') return [];
  const state = stateOf(books), out = [];
  for (const g of books.goods) {
    const token = MARKET_TOKENS[g.token_id], stock = Number(g.stock), target = Number(g.target);
    if (!token || (token.tier ?? 1) > 3 || stock * 10 >= target * 6) continue;
    const q = R.quote({merchant: def, state, token, side: 'sell', qty: 1, tick, testimonyBps});
    const terms = R.jobTerms(def, {stock, target, bid: q.bid, mid: q.mid, cash: state.cash, open: true});
    if (!terms.maxUnits || terms.maxPay <= terms.minPay) continue;
    out.push({token: g.token_id, name: name(g.token_id), stock, target, bid: q.bid, mid: q.mid, terms, need: stock / Math.max(1, target)});
  }
  return out.sort((a, b) => a.need - b.need);
}

/** Pins a proposed job to the rules: a third of the way from bid to mid by default, never past 60% of the way. */
export function settleJob(books, option, {units, pay} = {}) {
  const def = R.MERCHANTS.find(m => m.id === books.rules_id);
  const {bid, mid, terms} = option;
  const top = bid + Math.floor((mid - bid) * 0.6);
  const payEach = Math.max(bid + 1, Math.min(top, Number.isFinite(pay) ? Math.round(pay) : bid + Math.floor((mid - bid) / 3)));
  const most = Math.min(terms.maxUnits, Math.floor(terms.maxEscrow / payEach), Math.floor((Number(books.cash) - terms.floor) / payEach));
  const n = Math.max(1, Math.min(most, Number.isFinite(units) ? Math.round(units) : most));
  const job = {token: option.token, name: option.name, units: n, payEach};
  return R.checkJob(def, {stock: option.stock, target: option.target, bid, mid, cash: Number(books.cash), open: true}, {units: n, payEach}) === 'OK' ? job : null;
}

export const rulesJob = (books, tick, testimonyBps = 0) => {
  const [first] = jobOptions(books, tick, testimonyBps);
  return first ? settleJob(books, first) : null;
};

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
    + `You may also hire cultivators to bring you ONE good you are short of, choosing from hireOptions (pay in jade per unit, within its range). `
    + `Reply with JSON only: {"targets": {"<good id>": <percent>}, "specialty": "<school id or null>", "hire": {"id": "<good id>", "units": <n>, "pay": <jade each>} or null, "say": "<one sentence in your own voice, under 25 words, why>"}. `
    + `Change at most ${MAX_CHANGES} goods. Speak only of the bazaar, its goods and its people.`;
  const user = JSON.stringify({day: Math.floor(tick / 24) + 1, edictFavours: {id: edict, name: schoolName(edict)}, event: event?.text ?? null, goods,
    advisorSuggests: Object.fromEntries(rules.targets.map(([id, bps]) => [id, bps / 100])),
    hireOptions: (rules.jobOptions ?? []).slice(0, 4).map(o => ({id: o.token, name: o.name, have: o.stock, want: o.target, maxUnits: o.terms.maxUnits,
      payRange: [o.bid / 100, (o.bid + Math.floor((o.mid - o.bid) * 0.6)) / 100]}))});
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
    const option = reply.hire && (rules.jobOptions ?? []).find(o => o.token === reply.hire.id);
    const job = reply.hire === null ? null : option ? settleJob(books, option, {units: Number(reply.hire.units), pay: Number(reply.hire.pay) * 100}) ?? rules.job : rules.job;
    return {targets: changes.map(ch => [ch.token, ch.to]), specialty, changes, say, job, source: 'near-ai', model};
  } catch { return rules; }
}

/** A merchant whose purse is under half its start does not ask for more stock or hire: that is how idle shops go broke. */
export function thrifty(books, decision) {
  const def = R.MERCHANTS.find(m => m.id === books.rules_id);
  if (!def || Number(books.cash) * R.BPS >= def.startCash * 5_000) return decision;
  const changes = decision.changes.filter(c => c.to <= c.from);
  return {...decision, changes, targets: changes.map(c => [c.token, c.to]), job: null};
}

/** Runs the agents on a timer: at most a few merchants per minute, each once per market day. Also the Ministry's
 *  relief: a shop shuttered for `reliefAfter` (real time) that no player has rekindled is rekindled by the owner. */
export function createAgents({store, chain, decide = aiDecision, every = 60_000, perRound = 3, reliefAfter = 2 * 3600e3}) {
  const data = store.data;
  let timer = null, running = false;
  async function round() {
    if (running || !(await chain.online()) || !(await chain.agentsReady())) return;
    running = true;
    try {
      const market = await chain.market();
      const day = Math.floor(market.tick / R.TIME.ticksPerDay);
      data.closedSince ??= {};
      const now = Date.now();
      for (const m of market.merchants) if (m.closed) data.closedSince[m.account_id] ??= now; else delete data.closedSince[m.account_id];
      const relief = market.merchants.filter(m => m.closed && now - data.closedSince[m.account_id] >= reliefAfter);
      if (relief.length && chain.ministryRelief) {
        const result = await chain.ministryRelief(relief.map(m => m.account_id));
        for (const m of relief) {
          data.journal ??= {};
          data.journal[m.rules_id] = [{day, at: now, source: 'ministry', changes: [], tx: result.tx ?? null, ok: result.ok, code: result.ok ? null : result.code,
            say: `The Ministry of Ash has rekindled ${m.name}'s shop. Patrons who put jade in now share what it earns.`}, ...(data.journal[m.rules_id] ?? [])].slice(0, 12);
          if (result.ok) delete data.closedSince[m.account_id];
        }
        store.save();
      }
      const due = market.merchants.filter(m => (data.agents?.[m.account_id]?.day ?? -1) < day).slice(0, perRound);
      for (const books of due) {
        const rules = rulesDecision(books, market.tick);
        rules.jobOptions = jobOptions(books, market.tick, market.testimonyBps ?? 0);
        rules.job = rules.jobOptions[0] ? settleJob(books, rules.jobOptions[0]) : null;
        const decision = thrifty(books, await decide(books, market.tick, rules));
        const result = await chain.agentCall(books.account_id, 'merchant_set_strategy', {target_bps: decision.targets, specialty: decision.specialty});
        const entry = {day, at: Date.now(), say: decision.say, source: decision.source, specialty: decision.specialty,
          changes: decision.changes.map(c => ({token: c.token, name: name(c.token), from: c.from, to: c.to})), tx: result.tx ?? null,
          ok: result.ok || result.code === 'STRATEGY_ALREADY_SET_TODAY', code: result.ok ? null : result.code};
        const open = (market.jobs ?? []).some(j => j.merchant_id === books.account_id && !j.expired);
        if (decision.job && !open) {
          const posted = await chain.agentCall(books.account_id, 'merchant_post_job',
            {token_id: decision.job.token, amount: String(decision.job.units), pay_each: String(decision.job.payEach)});
          entry.job = {...decision.job, tx: posted.tx ?? null, ok: Boolean(posted.ok), code: posted.ok ? null : posted.code};
        }
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


// ------------------------------------------------------------------ haggling: the contract decides, the merchant speaks

/** The merchant's answer to a haggle, in character. The outcome and price were decided on the ledger by the rules file;
 *  the model only phrases them, and its line is used only if it states the decided price exactly. */
export async function haggleSay(receipt, books, {fetchImpl = fetch, apiKey = process.env.NEAR_AI_API_KEY, model = process.env.NEAR_AI_MODEL || 'z-ai/glm-5.3-flash', timeoutMs = 9_000} = {}) {
  const def = R.MERCHANTS.find(m => m.id === books?.rules_id);
  const token = MARKET_TOKENS[receipt.token_id] ?? {id: receipt.token_id, name: receipt.token_id};
  if (!def) return {say: '', lines: [], source: 'rules'};
  const side = receipt.sell ? 'sell' : 'buy', posted = Number(receipt.posted), offer = Number(receipt.offer);
  const struggling = books.status === 'struggling';
  const h = R.haggle({merchant: def, side, posted, offer, helps: Boolean(receipt.helps), struggling});
  const decided = {outcome: receipt.outcome, price: Number(receipt.price), bendBps: receipt.bend_bps, room: Math.trunc(posted * receipt.bend_bps / R.BPS)};
  const lines = haggleLines(def, token, {...h, ...decided}, {side, posted, offer, helps: Boolean(receipt.helps), struggling});
  const fallback = {say: lines[0], lines, source: 'rules'};
  if (!apiKey) return fallback;
  const c = who(def.id), price = R.jade(decided.price);
  const facts = {youAre: def.name, temperament: def.temperament, good: token.name, units: Number(receipt.amount),
    theCultivator: side === 'sell' ? 'wants to sell to you' : 'wants to buy from you', yourPostedTotal: R.jade(posted), theirOffer: R.jade(offer),
    decided: decided.outcome === 'walked' ? 'you refuse and will not haggle with them again today'
      : decided.outcome === 'countered' ? `you counter at exactly ${price} jade` : `you accept at exactly ${price} jade`,
    reasons: lines.slice(1)};
  const system = `You are ${def.name}, ${c?.role ?? 'a merchant'} in the Night Bazaar of a dark xianxia city. ${c?.description ?? ''} `
    + 'A cultivator is haggling with you. The outcome is already decided; never change it. Answer in one or two sentences, under 35 words, '
    + `in your own voice, giving one of the reasons. ${decided.outcome === 'walked' ? '' : `Say the price exactly as "${price} jade".`} `
    + 'Speak only of the bazaar, its goods and its people. Reply with the line only.';
  try {
    const res = await fetchImpl('https://cloud-api.near.ai/v1/chat/completions', {method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({model, reasoning_effort: 'low', max_tokens: 400, messages: [{role: 'system', content: system}, {role: 'user', content: JSON.stringify(facts)}]})});
    if (!res.ok) return fallback;
    const text = String((await res.json()).choices?.[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '');
    const states = decided.outcome === 'walked' || text.includes(price);
    if (!text || text.length > 260 || CHAIN_WORDS.test(text) || !states) return fallback;
    return {say: text, lines, source: 'near-ai', model};
  } catch { return fallback; }
}
