//! Merchant pricing, ported line for line from `js/market/merchant-rules.js`.
//!
//! The parameters live in `rules_gen.rs`, generated from that JavaScript file. `tests/parity.rs` replays a recorded
//! week of the JavaScript market (`tests/fixtures/market-trace.json`) through these functions and must match every
//! quote and every daily snapshot exactly. Whole numbers only; division truncates toward zero, as in JavaScript's
//! `Math.trunc` (with negative zero normalised to zero, which Rust integers never produce).
use crate::rules_gen::*;
use near_sdk::near;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Role {
    Specialty,
    Side,
}

#[derive(Clone, Copy, Debug)]
pub struct Temperament {
    pub k_quarters: u32,
    pub spread_bps: i128,
    pub flow_weight_bps: i128,
    pub flow_fade_bps: i128,
    pub reversion_bps: i128,
    pub loyalty_bps: i128,
    pub haggle_bps: i128,
}

pub struct MerchantDef {
    pub id: &'static str,
    pub name: &'static str,
    pub start_cash: i128,
    pub consumables: bool,
    pub temperament: Temperament,
    pub families: &'static [(&'static str, Role)],
}

pub struct EventDef {
    pub id: &'static str,
    pub family: &'static str,
    pub price_bps: i128,
}

/// What pricing needs to know about a good.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct TokenInfo {
    pub id: String,
    pub family: String,
    pub school: Option<String>,
    pub tier: u8,
    pub consumable: bool,
    /// Usual price in jade cents.
    pub base: i64,
}

/// A merchant's books. Vectors are aligned with the merchant's goods, in token-registry order.
#[near(serializers = [borsh])]
#[derive(Clone, Debug, PartialEq, Default)]
pub struct MarketState {
    pub cash: i64,
    pub stock: Vec<i64>,
    pub target: Vec<i64>,
    pub base_target: Vec<i64>,
    pub flow: Vec<i64>,
    pub closed: bool,
    pub specialty: Option<String>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Open,
    Struggling,
    Closed,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Quote {
    pub code: &'static str,
    pub total: i128,
    pub units: Vec<i128>,
    pub tax_paid: i128,
    pub bid: i128,
    pub ask: i128,
    pub mid: i128,
    pub status: Status,
}

impl Quote {
    pub fn ok(&self) -> bool {
        self.code == "OK"
    }
}

#[inline]
fn div(a: i128, b: i128) -> i128 {
    a / b
}
#[inline]
fn ceil_div(a: i128, b: i128) -> i128 {
    (a + b - 1) / b
}
#[inline]
fn clamp(x: i128, lo: i128, hi: i128) -> i128 {
    hi.min(lo.max(x))
}

fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

/// (target / stock) ^ (k_quarters / 4), in parts per million. The ratio is held within 1/100 .. 100 first.
pub fn scarcity_ppm(target: i128, stock: i128, k_quarters: u32) -> i128 {
    const PPM: u128 = 1_000_000;
    let mut ratio = (target.max(1) as u128) * PPM / (stock.max(1) as u128);
    ratio = ratio.clamp(10_000, 100_000_000);
    let half = isqrt(ratio * PPM);
    let quarter = isqrt(half * PPM);
    let mut out = PPM;
    for _ in 0..k_quarters / 4 {
        out = out * ratio / PPM;
    }
    if k_quarters % 4 >= 2 {
        out = out * half / PPM;
    }
    if k_quarters % 2 == 1 {
        out = out * quarter / PPM;
    }
    out as i128
}

pub fn edict_school(tick: u64) -> &'static str {
    let week = (tick / TICKS_PER_WEEK + 1) as u32;
    EDICT_SCHOOLS[(week.wrapping_mul(2_654_435_761) % EDICT_SCHOOLS.len() as u32) as usize]
}

pub fn active_event(tick: u64) -> Option<&'static EventDef> {
    if tick % EVENT_PERIOD_TICKS >= EVENT_DURATION_TICKS {
        return None;
    }
    Some(&EVENTS[((tick / EVENT_PERIOD_TICKS) % EVENTS.len() as u64) as usize])
}

pub fn tax_bps(testimony_bps: i128) -> i128 {
    TAX_BASE_BPS - div(TAX_BASE_BPS * clamp(testimony_bps, 0, BPS), BPS)
}

pub fn merchant_def(id: &str) -> Option<&'static MerchantDef> {
    MERCHANTS.iter().find(|m| m.id == id)
}

pub struct Mid {
    pub mid: i128,
    pub raw: i128,
    pub floor: i128,
    pub ceiling: i128,
}

pub fn mid_price(def: &MerchantDef, token: &TokenInfo, stock: i128, target: i128, flow: i128, tick: u64) -> Mid {
    let t = &def.temperament;
    let scarcity = scarcity_ppm(target, stock, t.k_quarters);
    let demand = clamp(BPS + div(flow * t.flow_weight_bps, target.max(1)), DEMAND_MIN_BPS, DEMAND_MAX_BPS);
    let edict = if token.school.as_deref() == Some(edict_school(tick)) { BPS + EDICT_BOOST_BPS } else { BPS };
    let event = match active_event(tick) {
        Some(e) if e.family == token.family => e.price_bps,
        _ => BPS,
    };
    let base = token.base as i128;
    let mut mid = div(base * scarcity, 1_000_000);
    mid = div(div(div(mid * demand, BPS) * edict, BPS) * event, BPS);
    let floor = div(base * PRICE_FLOOR_BPS, BPS);
    let ceiling = div(base * PRICE_CEILING_BPS, BPS);
    Mid { mid: clamp(mid, floor.max(1), ceiling), raw: mid, floor, ceiling }
}

fn purse_state(def: &MerchantDef, cash: i128) -> Status {
    if cash * BPS < def.start_cash * PURSE_CLOSE_BELOW_BPS {
        Status::Closed
    } else if cash * BPS < def.start_cash * PURSE_THIN_BELOW_BPS {
        Status::Struggling
    } else {
        Status::Open
    }
}

/// A closed shop stays closed until rekindled to the reopening line.
pub fn merchant_status(def: &MerchantDef, state: &MarketState) -> Status {
    let cash = state.cash as i128;
    if state.closed {
        return if cash * BPS >= def.start_cash * PURSE_REOPEN_AT_BPS { Status::Open } else { Status::Closed };
    }
    purse_state(def, cash)
}

fn unit_price(def: &MerchantDef, token: &TokenInfo, state: &MarketState, sell: bool, mid: i128, rep: i128, tax: i128) -> i128 {
    let t = &def.temperament;
    let spread = t.spread_bps - div(div(t.spread_bps * t.loyalty_bps, BPS) * clamp(rep, 0, BPS), BPS);
    let premium = match (&state.specialty, &token.school) {
        (Some(a), Some(b)) if a == b => SPECIALTY_PREMIUM_BPS,
        _ => 0,
    };
    let purse = if (state.cash as i128) * BPS < def.start_cash * PURSE_THIN_BELOW_BPS { PURSE_THIN_PAY_BPS } else { BPS };
    if sell {
        1.max(div(div(div(mid * (BPS - spread + premium), BPS) * purse, BPS) * (BPS - tax), BPS))
    } else {
        ceil_div(ceil_div(mid * (BPS + spread), BPS) * (BPS + tax), BPS)
    }
}

/// Quote a trade. `sell` = the player sells to the merchant. `index` is the good's position in the merchant's list.
#[allow(clippy::too_many_arguments)]
pub fn quote(def: &MerchantDef, token: &TokenInfo, state: &MarketState, index: Option<usize>, sell: bool, qty: i128,
    tick: u64, reputation_bps: i128, testimony_bps: i128) -> Quote {
    let (stock, target, flow) = match index {
        Some(i) => (state.stock[i] as i128, state.target[i] as i128, state.flow[i] as i128),
        None => (0, 0, 0),
    };
    let tax = tax_bps(testimony_bps);
    let status = merchant_status(def, state);
    let at = |s: i128, f: i128| mid_price(def, token, s, target, f, tick).mid;
    let now = at(stock, flow);
    let bid = unit_price(def, token, state, true, at(stock + 1, flow - 1), reputation_bps, tax);
    let ask = unit_price(def, token, state, false, at((stock - 1).max(0), flow + 1), reputation_bps, tax);
    let mut q = Quote { code: "OK", total: 0, units: vec![], tax_paid: 0, bid, ask, mid: now, status };
    let refuse = |mut q: Quote, code: &'static str| {
        q.code = code;
        q
    };
    if !(1..=99).contains(&qty) {
        return refuse(q, "BAD_QTY");
    }
    if target == 0 {
        return refuse(q, "NOT_TRADED");
    }
    if status == Status::Closed {
        return refuse(q, "CLOSED");
    }
    if !sell && stock < qty {
        return refuse(q, "OUT_OF_STOCK");
    }
    if sell && (stock + qty) * BPS > target * STOREROOM_BPS {
        return refuse(q, "STOREROOM_FULL");
    }
    for i in 1..=qty {
        let (s, f) = if sell { (stock + i, flow - i) } else { (stock - i, flow + i) };
        q.units.push(unit_price(def, token, state, sell, at(s, f), reputation_bps, tax));
    }
    q.total = q.units.iter().sum();
    q.tax_paid = tax_on(q.total, sell, tax);
    if sell && ((state.cash as i128) - q.total - q.tax_paid) * BPS < def.start_cash * PURSE_STOP_BUYING_BELOW_BPS {
        q.units.clear();
        q.total = 0;
        q.tax_paid = 0;
        return refuse(q, "PURSE_EMPTY");
    }
    q
}

/// The Paper Taxman's cut inside a total: on a sale the merchant pays it on top; on a purchase it is part of the price.
pub fn tax_on(total: i128, sell: bool, tax: i128) -> i128 {
    if sell { div(total * tax, BPS - tax) } else { total - div(total * BPS, BPS + tax) }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Haggle {
    /// accepted | countered | walked
    pub outcome: &'static str,
    pub price: i128,
    pub bend_bps: i128,
    pub room: i128,
}

/// Haggle over a quoted trade (see `haggle` in merchant-rules.js). `posted` is the quote's total, `offer` the player's.
pub fn haggle(def: &MerchantDef, sell: bool, posted: i128, offer: i128, helps: bool, struggling: bool) -> Haggle {
    let bend_bps = if sell && struggling { 0 } else { def.temperament.haggle_bps + if helps { HAGGLE_NEED_BPS } else { 0 } };
    let room = div(posted * bend_bps, BPS);
    let over = if sell { offer - posted } else { posted - offer };
    let toward = |n: i128| if sell { posted + n } else { posted - n };
    let (outcome, price) = if over <= 0 {
        ("accepted", posted)
    } else if over <= room {
        ("accepted", offer)
    } else if room == 0 || over * BPS <= room * HAGGLE_WALK_AWAY_BPS {
        ("countered", toward(div(room, 2)))
    } else {
        ("walked", 0)
    };
    Haggle { outcome, price, bend_bps, room }
}

/// What a merchant knows when it posts a job for one good.
pub struct JobBooks {
    pub stock: i128,
    pub target: i128,
    pub bid: i128,
    pub mid: i128,
    pub cash: i128,
    pub open: bool,
}

/// "OK" or why a job is refused (see `checkJob` in merchant-rules.js).
pub fn check_job(def: &MerchantDef, b: &JobBooks, units: i128, pay_each: i128) -> &'static str {
    if !b.open {
        return "PURSE_TOO_THIN";
    }
    let max_units = JOB_MAX_UNITS.min((b.target - b.stock).max(0));
    if max_units == 0 {
        return "NOT_SHORT";
    }
    if units < 1 || units > max_units {
        return "BAD_QTY";
    }
    if pay_each < b.bid || pay_each > b.bid.max(b.mid) {
        return "BAD_PAY";
    }
    let floor = div(def.start_cash * PURSE_STOP_BUYING_BELOW_BPS, BPS);
    if units * pay_each > div(b.cash * JOB_MAX_ESCROW_BPS, BPS) || b.cash - units * pay_each < floor {
        return "TOO_DEAR";
    }
    "OK"
}

/// Apply an accepted quote. The Paper Taxman's cut leaves the merchant's purse too.
pub fn apply_quote(state: &mut MarketState, index: usize, sell: bool, qty: i128, total: i128, tax_paid: i128) {
    let sign: i128 = if sell { 1 } else { -1 };
    state.cash = ((state.cash as i128) - sign * total - tax_paid) as i64;
    state.stock[index] = ((state.stock[index] as i128) + sign * qty) as i64;
    state.flow[index] = ((state.flow[index] as i128) - sign * qty) as i64;
}

/// One market hour for one merchant: upkeep, caravans, fading demand memory, learning and closure.
pub fn tick_merchant(def: &MerchantDef, tokens: &[TokenInfo], state: &MarketState, tick: u64) -> MarketState {
    let t = &def.temperament;
    let mut next = state.clone();
    if next.closed && merchant_status(def, &next) == Status::Open {
        next.closed = false;
    }
    if next.closed {
        return next;
    }
    let mut cash = next.cash as i128;
    cash = 0.max(cash - div(def.start_cash * PURSE_UPKEEP_BPS, BPS));
    let adapt = (tick + 1) % ADAPT_EVERY_TICKS == 0;
    for (i, token) in tokens.iter().enumerate() {
        let gap = next.target[i] as i128 - next.stock[i] as i128;
        if gap != 0 {
            let mut mv = gap.signum() * 1.max(div(gap * t.reversion_bps, BPS).abs());
            if mv > 0 {
                let unit = div(token.base as i128 * CARAVAN_RESTOCK_COST_BPS, BPS);
                let floor = div(def.start_cash * PURSE_STOP_BUYING_BELOW_BPS, BPS);
                mv = 0.max(mv.min(div(cash - floor, unit.max(1))));
                cash -= mv * unit;
            } else {
                cash += -mv * div(token.base as i128 * CARAVAN_SURPLUS_VALUE_BPS, BPS);
            }
            next.stock[i] = (next.stock[i] as i128 + mv) as i64;
        }
        next.flow[i] = div(next.flow[i] as i128 * (BPS - t.flow_fade_bps), BPS) as i64;
        if adapt {
            let s = next.stock[i] as i128;
            let target = next.target[i] as i128;
            let base = state.base_target[i] as i128;
            let step = 1.max(div(target * ADAPT_STEP_BPS, BPS));
            let mut changed = target;
            if s * BPS < target * (BPS - ADAPT_BAND_BPS) {
                changed = target + step;
            } else if s * BPS > target * (BPS + ADAPT_BAND_BPS) {
                changed = target - step;
            }
            next.target[i] = clamp(changed, div(base * ADAPT_MIN_BPS, BPS), div(base * ADAPT_MAX_BPS, BPS)) as i64;
        }
    }
    next.cash = cash as i64;
    let day_ends = (tick + 1) % TICKS_PER_DAY == 0;
    if purse_state(def, cash) == Status::Closed || (day_ends && cash * BPS < def.start_cash * PURSE_CLOSE_AT_DAY_END_BELOW_BPS) {
        next.closed = true;
    }
    next
}

/// A merchant's agent may change only its targets (within the learning band) and today's specialty school.
pub fn apply_strategy(def: &MerchantDef, tokens: &[TokenInfo], state: &mut MarketState, target_bps: &[(String, i128)], specialty: Option<String>) {
    for (id, bps) in target_bps {
        if let Some(i) = tokens.iter().position(|t| &t.id == id) {
            state.target[i] = div(state.base_target[i] as i128 * clamp(*bps, ADAPT_MIN_BPS, ADAPT_MAX_BPS), BPS) as i64;
        }
    }
    let allowed = |s: &str| {
        EDICT_SCHOOLS.contains(&s) && def.families.iter().any(|(family, _)| family.strip_prefix("essence-") == Some(s))
    };
    state.specialty = specialty.filter(|s| allowed(s));
}

/// The goods a merchant trades (indices into `all`, registry order) and its opening books.
pub fn opening_state(def: &MerchantDef, all: &[TokenInfo]) -> (Vec<usize>, MarketState) {
    let mut goods = vec![];
    let mut target = vec![];
    for (i, token) in all.iter().enumerate() {
        let role = def.families.iter().find(|(family, _)| *family == token.family).map(|(_, r)| *r);
        let amount = match role {
            Some(r) if token.tier > 0 => Some(match r {
                Role::Specialty => TARGETS_SPECIALTY[token.tier as usize - 1],
                Role::Side => TARGETS_SIDE[token.tier as usize - 1],
            }),
            _ if def.consumables && token.consumable => Some(TARGET_CONSUMABLE),
            _ => None,
        };
        if let Some(n) = amount {
            goods.push(i);
            target.push(n as i64);
        }
    }
    let state = MarketState {
        cash: def.start_cash as i64,
        stock: target.clone(),
        target: target.clone(),
        base_target: target.clone(),
        flow: vec![0; target.len()],
        closed: false,
        specialty: None,
    };
    (goods, state)
}
