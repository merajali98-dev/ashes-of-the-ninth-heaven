//! Ashes of the Ninth Heaven: every item, the jade currency and the merchant market in one NEP-245 contract.
//!
//! * Every card, material, item and `jade` is a token id here (NEP-245 multi token).
//! * Each merchant is a real account. Its NEP-245 balances are its stock and its jade purse.
//! * The market runs here: prices come from `pricing.rs`, whose parameters are generated from the game's one readable
//!   rules file (`js/market/merchant-rules.js`). Time advances lazily: each call catches a merchant up to the
//!   current market hour (upkeep, caravans, learning, closure and patron dividends).
//! * Players trade through deposit-free `market_*` methods, so a key limited to this contract can sign them and a
//!   relayer can pay the gas. Standard `mt_transfer*` methods require 1 yoctoNEAR, as NEP-245 specifies.
//! * The game's minter account mints commission rewards and burns forging inputs in sequence-numbered batches, so a
//!   retried batch can never apply twice.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::{IterableMap, LookupMap, Vector};
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};

pub mod pricing;
pub mod rules_gen;

use pricing::{MarketState, Status, TokenInfo};
use rules_gen::{BPS, DEED_MAX_PER_ACCOUNT, DEED_OWNER_SHARE_BPS, DEED_PRICE, MAX_CATCH_UP_TICKS, PATRON_MAX_PATRONS, PATRON_MAX_PUBLIC_BPS, TICKS_PER_DAY};

pub const JADE: &str = "jade";
const JADE_INDEX: u32 = 0;
const GAS_FOR_RESOLVE: Gas = Gas::from_tgas(20);
const GAS_RESERVE: Gas = Gas::from_tgas(10);

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Tokens,
    TokenIndex,
    Balances,
    Supply,
    Merchants,
    Seqs,
    Volume,
    // Added with player listings. Appended, so earlier keys keep their prefixes; these collections are opened on
    // demand (see `listings()`), so the stored contract struct is unchanged and the upgrade needs no migration.
    Listings,
    ListingCounts,
    // Added with Shop Deeds (NEP-171), opened on demand like the listings.
    Deeds,
}

const ALL_DEEDS: &[u8] = b"deeds:all";

/// A Shop Deed: an NFT that is a merchant's ownership. Its holder takes the owner's share of each profitable day into
/// `vault` (which travels with the deed), and decides the shop's strategy or appoints the merchant's agent to.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Deed {
    pub token_id: String,
    pub rules_id: String,
    pub merchant_id: AccountId,
    pub owner: AccountId,
    /// The holder's asking price, if listed. Deeds the Ministry holds always sell at DEED_PRICE.
    pub price: Option<U128>,
    pub vault: U128,
    /// True: the merchant's own agent decides the strategy. False: only the holder does.
    pub agent: bool,
    pub minted_ms: u64,
}

const MAX_OPEN_LISTINGS: usize = 400;
const MAX_LISTINGS_PER_SELLER: u32 = 20;
const OPEN_LISTINGS: &[u8] = b"listings:open";
const NEXT_LISTING: &[u8] = b"listings:next";

/// A player's listing: goods held by the contract in escrow, sold at the seller's price per unit.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Listing {
    pub id: u64,
    pub seller: AccountId,
    pub token_id: String,
    pub amount: U128,
    pub price_each: U128,
    pub created_ms: u64,
}

#[near(serializers = [json])]
pub struct ListingReceipt {
    pub listing_id: u64,
    pub token_id: String,
    pub amount: U128,
    pub total: U128,
    pub tax: U128,
}

/// A registered good. `base` is the usual price in jade cents (0 for goods merchants never trade).
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct TokenMeta {
    pub id: String,
    pub title: String,
    /// currency | material | consumable | card | item
    pub kind: String,
    pub family: String,
    pub school: Option<String>,
    pub tier: u8,
    pub base: i64,
    pub media: Option<String>,
    pub decimals: u8,
}

impl TokenMeta {
    fn info(&self) -> TokenInfo {
        TokenInfo { id: self.id.clone(), family: self.family.clone(), school: self.school.clone(), tier: self.tier,
            consumable: self.kind == "consumable", base: self.base }
    }
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Merchant {
    pub rules_id: String,
    /// Registry indices of the goods this merchant trades, aligned with `state` vectors and `goods_info`.
    pub goods: Vec<u32>,
    pub goods_info: Vec<TokenInfo>,
    pub state: MarketState,
    /// The first market hour not yet processed.
    pub next_tick: u64,
    pub day_start: i64,
    pub capital_in: i64,
    pub patrons: Vec<(AccountId, i64)>,
    pub strategy_day: Option<u64>,
}

impl Merchant {
    fn def(&self) -> &'static pricing::MerchantDef {
        pricing::merchant_def(&self.rules_id).expect("merchant rules missing")
    }
    fn position(&self, index: u32) -> Option<usize> {
        self.goods.iter().position(|&g| g == index)
    }
    fn stake(&self) -> i64 {
        self.patrons.iter().map(|(_, s)| s).sum()
    }
}

/// What catching a merchant up produced, for events and books.
#[derive(Default)]
struct CatchUp {
    stock_delta: Vec<i64>,
    cash_delta: i64,
    dividends: Vec<(AccountId, i64)>,
    deed_share: i64,
}

#[near(serializers = [json])]
pub struct MintEntry {
    pub account_id: AccountId,
    pub token_id: String,
    pub amount: U128,
}

#[near(serializers = [json])]
pub struct MarketReceipt {
    pub merchant_id: AccountId,
    pub token_id: String,
    pub amount: U128,
    pub total: U128,
    pub tax: U128,
    pub tick: u64,
}

#[near(serializers = [json])]
pub struct QuoteView {
    pub code: String,
    pub total: U128,
    pub tax: U128,
    pub units: Vec<U128>,
    pub bid: U128,
    pub ask: U128,
    pub mid: U128,
    pub status: String,
    pub tick: u64,
}

#[near(serializers = [json])]
pub struct GoodView {
    pub token_id: String,
    pub stock: U128,
    pub target: U128,
    pub base_target: U128,
    pub flow: i64,
}

#[near(serializers = [json])]
pub struct MerchantView {
    pub account_id: AccountId,
    pub rules_id: String,
    pub name: String,
    pub cash: U128,
    pub status: String,
    pub closed: bool,
    pub specialty: Option<String>,
    pub tick: u64,
    pub goods: Vec<GoodView>,
    pub patrons: Vec<(AccountId, U128)>,
}

#[near(serializers = [json])]
pub struct Token {
    pub token_id: String,
    pub owner_id: Option<AccountId>,
    pub base_metadata_id: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    minter_id: AccountId,
    ministry_id: AccountId,
    tokens: Vector<TokenMeta>,
    token_index: LookupMap<String, u32>,
    balances: LookupMap<(AccountId, u32), u128>,
    supply: LookupMap<u32, u128>,
    merchants: IterableMap<AccountId, Merchant>,
    seqs: LookupMap<AccountId, u64>,
    volume: LookupMap<(AccountId, AccountId), u128>,
    genesis_ms: u64,
    tick_ms: u64,
    testimony_bps: u32,
    base_uri: Option<String>,
    paused: bool,
}

fn emit(standard: &str, version: &str, event: &str, data: Value) {
    env::log_str(&format!("EVENT_JSON:{}", json!({"standard": standard, "version": version, "event": event, "data": [data]})));
}
fn emit_mt(event: &str, data: Value) {
    emit("nep245", "1.0.0", event, data);
}
fn fail(code: &str) -> ! {
    env::panic_str(code)
}
fn status_name(s: Status) -> &'static str {
    match s {
        Status::Open => "open",
        Status::Struggling => "struggling",
        Status::Closed => "closed",
    }
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, minter_id: AccountId, ministry_id: AccountId, tick_ms: u64, base_uri: Option<String>) -> Self {
        require!(tick_ms >= 1_000, "tick_ms must be at least one second");
        let mut contract = Self {
            owner_id, minter_id, ministry_id,
            tokens: Vector::new(Key::Tokens),
            token_index: LookupMap::new(Key::TokenIndex),
            balances: LookupMap::new(Key::Balances),
            supply: LookupMap::new(Key::Supply),
            merchants: IterableMap::new(Key::Merchants),
            seqs: LookupMap::new(Key::Seqs),
            volume: LookupMap::new(Key::Volume),
            genesis_ms: env::block_timestamp_ms(),
            tick_ms,
            testimony_bps: 0,
            base_uri,
            paused: false,
        };
        contract.register(TokenMeta { id: JADE.into(), title: "Jade".into(), kind: "currency".into(), family: JADE.into(),
            school: None, tier: 0, base: 0, media: Some("favicon.svg".into()), decimals: 2 });
        contract
    }

    // ------------------------------------------------------------------ owner and minter

    /// Register goods, in order. Market goods (materials, then pills and talismans) must come first, in the same order
    /// as `js/market/tokens.js`, because merchants list their goods in registry order.
    pub fn register_tokens(&mut self, tokens: Vec<TokenMeta>) -> u32 {
        self.assert_owner();
        for token in tokens {
            if !self.token_index.contains_key(&token.id) {
                self.register(token);
            }
        }
        self.tokens.len()
    }

    /// Open a merchant's shop: its account, its rules from the generated rules file, and its opening stock and purse.
    pub fn add_merchant(&mut self, account_id: AccountId, rules_id: String) {
        self.assert_owner();
        require!(!self.merchants.contains_key(&account_id), "merchant already exists");
        require!(self.balances_of_player_empty(&account_id), "merchant account already holds goods");
        let def = pricing::merchant_def(&rules_id).unwrap_or_else(|| fail("unknown merchant rules"));
        let market: Vec<(u32, TokenInfo)> = (1..self.tokens.len())
            .map(|i| (i, self.tokens.get(i).unwrap()))
            .take_while(|(_, t)| t.kind == "material" || t.kind == "consumable")
            .map(|(i, t)| (i, t.info()))
            .collect();
        let infos: Vec<TokenInfo> = market.iter().map(|(_, t)| t.clone()).collect();
        let (positions, state) = pricing::opening_state(def, &infos);
        require!(!positions.is_empty(), "register market goods before opening shops");
        let goods: Vec<u32> = positions.iter().map(|&p| market[p].0).collect();
        let goods_info: Vec<TokenInfo> = positions.iter().map(|&p| infos[p].clone()).collect();
        let tick = self.current_tick();
        self.add_supply(JADE_INDEX, state.cash as i128);
        for (k, &g) in goods.iter().enumerate() {
            self.add_supply(g, state.stock[k] as i128);
        }
        emit_mt("mt_mint", json!({"owner_id": account_id, "token_ids": std::iter::once(JADE.to_string()).chain(goods_info.iter().map(|t| t.id.clone())).collect::<Vec<_>>(),
            "amounts": std::iter::once(state.cash.to_string()).chain(state.stock.iter().map(|s| s.to_string())).collect::<Vec<_>>(), "memo": "shop opening"}));
        self.merchants.insert(account_id, Merchant { rules_id, goods, goods_info, day_start: state.cash, state, next_tick: tick,
            capital_in: 0, patrons: vec![], strategy_day: None });
    }

    /// Commission rewards and other grants. `seq` must be the minter's next sequence number; a repeat is ignored.
    pub fn game_mint_batch(&mut self, mints: Vec<MintEntry>, seq: u64, memo: Option<String>) -> bool {
        require!(env::predecessor_account_id() == self.minter_id, "only the minter mints");
        if !self.next_seq(seq) {
            return false;
        }
        for m in mints {
            require!(!self.merchants.contains_key(&m.account_id), "merchant stock only changes through the market");
            let index = self.index_of(&m.token_id);
            self.set_balance(&m.account_id, index, self.balance(&m.account_id, index) + m.amount.0);
            self.add_supply(index, m.amount.0 as i128);
            emit_mt("mt_mint", json!({"owner_id": m.account_id, "token_ids": [m.token_id], "amounts": [m.amount], "memo": memo}));
        }
        true
    }

    /// Forging inputs and consumables used in battle. Same sequence rule as minting.
    pub fn game_burn_batch(&mut self, burns: Vec<MintEntry>, seq: u64, memo: Option<String>) -> bool {
        require!(env::predecessor_account_id() == self.minter_id, "only the minter burns");
        if !self.next_seq(seq) {
            return false;
        }
        for b in burns {
            require!(!self.merchants.contains_key(&b.account_id), "merchant stock only changes through the market");
            let index = self.index_of(&b.token_id);
            let have = self.balance(&b.account_id, index);
            require!(have >= b.amount.0, "burn exceeds balance");
            self.set_balance(&b.account_id, index, have - b.amount.0);
            self.add_supply(index, -(b.amount.0 as i128));
            emit_mt("mt_burn", json!({"owner_id": b.account_id, "authorized_id": self.minter_id, "token_ids": [b.token_id], "amounts": [b.amount], "memo": memo}));
        }
        true
    }

    /// Collective Testimony (players clearing the campaign together) lowers the Ministry's trade tax.
    pub fn set_testimony(&mut self, testimony_bps: u32) {
        let caller = env::predecessor_account_id();
        require!(caller == self.owner_id || caller == self.minter_id, "only the owner or minter");
        self.testimony_bps = testimony_bps.min(BPS as u32);
    }
    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.paused = paused;
    }
    pub fn set_minter(&mut self, minter_id: AccountId) {
        self.assert_owner();
        self.minter_id = minter_id;
    }
    pub fn set_base_uri(&mut self, base_uri: Option<String>) {
        self.assert_owner();
        self.base_uri = base_uri;
    }

    // ------------------------------------------------------------------ the market (deposit-free: limited keys may call)

    /// Sell goods to a merchant at the price `pricing.rs` sets. Fails with PRICE_MOVED below `min_total`.
    pub fn market_sell(&mut self, merchant_id: AccountId, token_id: String, amount: U128, min_total: U128) -> MarketReceipt {
        self.trade(merchant_id, token_id, amount, true, min_total.0)
    }

    /// Buy goods from a merchant. Fails with PRICE_MOVED above `max_total`.
    pub fn market_buy(&mut self, merchant_id: AccountId, token_id: String, amount: U128, max_total: U128) -> MarketReceipt {
        self.trade(merchant_id, token_id, amount, false, max_total.0)
    }

    /// Become a patron (up to 49% together, at most ten), or put jade toward rekindling a closed shop.
    pub fn patron_invest(&mut self, merchant_id: AccountId, amount: U128) -> U128 {
        require!(!self.paused, "PAUSED");
        let player = env::predecessor_account_id();
        let mut m = self.caught_up(&merchant_id);
        let def = m.def();
        let amount_i = amount.0 as i64;
        require!(amount_i > 0, "BAD_AMOUNT");
        let known = m.patrons.iter().any(|(a, _)| a == &player);
        if !known && m.patrons.len() >= PATRON_MAX_PATRONS {
            fail("TOO_MANY_PATRONS");
        }
        let room = (def.start_cash * PATRON_MAX_PUBLIC_BPS / BPS) as i64 - m.stake();
        if room <= 0 && !m.state.closed {
            fail("PATRONS_OWN_49_PERCENT");
        }
        let have = self.balance(&player, JADE_INDEX);
        require!(have >= amount.0, "NO_JADE");
        self.set_balance(&player, JADE_INDEX, have - amount.0);
        m.state.cash += amount_i;
        m.capital_in += amount_i;
        let mut staked = 0;
        if room > 0 {
            staked = amount_i.min(room);
            match m.patrons.iter_mut().find(|(a, _)| a == &player) {
                Some((_, s)) => *s += staked,
                None => m.patrons.push((player.clone(), staked)),
            }
        }
        emit_mt("mt_transfer", json!({"old_owner_id": player, "new_owner_id": merchant_id, "token_ids": [JADE], "amounts": [amount],
            "memo": if m.state.closed { "rekindle" } else { "patron" }}));
        self.merchants.insert(merchant_id, m);
        U128(staked as u128)
    }

    /// A merchant's own agent may adjust its targets (within the learning band) and specialty, once per market day.
    pub fn merchant_set_strategy(&mut self, target_bps: Vec<(String, u16)>, specialty: Option<String>) {
        let merchant_id = env::predecessor_account_id();
        if let Some(m) = self.merchants.get(&merchant_id) {
            if let Some(d) = self.deed_for(&m.rules_id.clone()) {
                require!(d.owner == self.ministry_id || d.agent, "DEED_HOLDER_DECIDES");
            }
        }
        self.set_strategy(merchant_id, target_bps, specialty);
    }

    fn set_strategy(&mut self, merchant_id: AccountId, target_bps: Vec<(String, u16)>, specialty: Option<String>) {
        let mut m = self.caught_up(&merchant_id);
        let day = self.current_tick() / TICKS_PER_DAY;
        require!(m.strategy_day != Some(day), "STRATEGY_ALREADY_SET_TODAY");
        let def = m.def();
        let goods = m.goods_info.clone();
        let targets: Vec<(String, i128)> = target_bps.iter().map(|(id, b)| (id.clone(), *b as i128)).collect();
        pricing::apply_strategy(def, &goods, &mut m.state, &targets, specialty);
        m.strategy_day = Some(day);
        emit("ashes", "1.0.0", "merchant_strategy", json!({"merchant_id": merchant_id, "day": day, "specialty": m.state.specialty,
            "targets": goods.iter().zip(m.state.target.iter()).map(|(t, v)| json!([t.id, v])).collect::<Vec<_>>()}));
        self.merchants.insert(merchant_id, m);
    }

    // ------------------------------------------------------------------ Shop Deeds (NEP-171)

    /// Mints one deed per merchant to the Ministry (owner only; deeds that exist are left alone).
    pub fn deed_mint_all(&mut self) -> Vec<String> {
        self.assert_owner();
        let mut all = Self::all_deeds();
        let mut deeds = Self::deed_store();
        let mut minted = vec![];
        for (merchant_id, m) in self.merchants.iter() {
            let token_id = format!("deed:{}", m.rules_id);
            if deeds.contains_key(&token_id) {
                continue;
            }
            deeds.insert(token_id.clone(), Deed { token_id: token_id.clone(), rules_id: m.rules_id.clone(), merchant_id: merchant_id.clone(),
                owner: self.ministry_id.clone(), price: None, vault: U128(0), agent: true, minted_ms: env::block_timestamp_ms() });
            all.push(token_id.clone());
            minted.push(token_id);
        }
        drop(deeds);
        Self::save_all_deeds(&all);
        if !minted.is_empty() {
            emit("nep171", "1.0.0", "nft_mint", json!({"owner_id": self.ministry_id, "token_ids": minted, "memo": "shop deeds"}));
        }
        minted
    }

    /// Buys a deed: from the Ministry at the fixed price (paid into the shop's purse as new capital), or from its holder at
    /// their listed price (paid to them, less the Ministry's trade tax). The vault comes with it.
    pub fn deed_buy(&mut self, token_id: String, max_price: U128) -> Deed {
        require!(!self.paused, "PAUSED");
        let buyer = env::predecessor_account_id();
        require!(!self.merchants.contains_key(&buyer), "merchants trade through their agents");
        let d = self.deed(&token_id);
        require!(d.owner != buyer, "ALREADY_YOURS");
        let from_ministry = d.owner == self.ministry_id;
        let price = if from_ministry { DEED_PRICE } else { d.price.unwrap_or_else(|| fail("NOT_FOR_SALE")).0 };
        require!(price <= max_price.0, "PRICE_MOVED");
        let jade = self.balance(&buyer, JADE_INDEX);
        require!(jade >= price, "NO_JADE");
        self.set_balance(&buyer, JADE_INDEX, jade - price);
        if from_ministry {
            let mut m = self.caught_up(&d.merchant_id);
            m.state.cash += price as i64;
            m.capital_in += price as i64;
            self.merchants.insert(d.merchant_id.clone(), m);
            emit_mt("mt_transfer", json!({"old_owner_id": buyer, "new_owner_id": d.merchant_id, "token_ids": [JADE], "amounts": [U128(price)], "memo": format!("{token_id} bought from the Ministry")}));
        } else {
            let tax = price * pricing::tax_bps(self.testimony_bps as i128) as u128 / BPS as u128;
            let seller = self.balance(&d.owner, JADE_INDEX);
            self.set_balance(&d.owner, JADE_INDEX, seller + price - tax);
            if tax > 0 {
                let ministry = self.ministry_id.clone();
                let have = self.balance(&ministry, JADE_INDEX);
                self.set_balance(&ministry, JADE_INDEX, have + tax);
                emit_mt("mt_transfer", json!({"old_owner_id": buyer, "new_owner_id": ministry, "token_ids": [JADE], "amounts": [U128(tax)], "memo": "ministry tax"}));
            }
            emit_mt("mt_transfer", json!({"old_owner_id": buyer, "new_owner_id": d.owner, "token_ids": [JADE], "amounts": [U128(price - tax)], "memo": format!("{token_id} bought")}));
        }
        self.move_deed(&token_id, &d.owner, &buyer, Some(format!("bought for {price}")))
    }

    /// The holder puts the deed up for sale at their price (deposit-free, so a game key can sign it), or takes it down.
    pub fn deed_list(&mut self, token_id: String, price: Option<U128>) {
        let d = self.deed_of_caller(&token_id);
        require!(price.map_or(true, |p| p.0 > 0 && p.0 <= 1_000_000_000), "BAD_PRICE");
        let mut deeds = Self::deed_store();
        deeds.insert(token_id, Deed { price, ..d });
    }

    /// The holder takes the deed's vault: the owner's share it has earned so far.
    pub fn deed_claim(&mut self, token_id: String) -> U128 {
        let d = self.deed_of_caller(&token_id);
        let merchant_id = d.merchant_id.clone();
        let fresh = self.caught_up(&merchant_id); // today's share first
        self.merchants.insert(merchant_id, fresh);
        let d = self.deed(&token_id);
        let amount = d.vault.0;
        if amount == 0 {
            return U128(0);
        }
        let escrow = env::current_account_id();
        let held = self.balance(&escrow, JADE_INDEX);
        self.set_balance(&escrow, JADE_INDEX, held - amount);
        let have = self.balance(&d.owner, JADE_INDEX);
        self.set_balance(&d.owner, JADE_INDEX, have + amount);
        emit_mt("mt_transfer", json!({"old_owner_id": escrow, "new_owner_id": d.owner, "token_ids": [JADE], "amounts": [U128(amount)], "memo": format!("{token_id} vault claimed")}));
        Self::deed_store().insert(token_id, Deed { vault: U128(0), ..d });
        U128(amount)
    }

    /// The holder runs the shop: the same once-a-day strategy, within the same limits, as the merchant's agent.
    pub fn deed_set_strategy(&mut self, token_id: String, target_bps: Vec<(String, u16)>, specialty: Option<String>) {
        let d = self.deed_of_caller(&token_id);
        self.set_strategy(d.merchant_id, target_bps, specialty);
    }

    /// The holder appoints the merchant's agent to decide (true) or keeps the decision for themself (false).
    pub fn deed_appoint_agent(&mut self, token_id: String, appoint: bool) {
        let d = self.deed_of_caller(&token_id);
        Self::deed_store().insert(token_id, Deed { agent: appoint, ..d });
    }

    pub fn deeds(&self) -> Vec<Value> {
        Self::all_deeds().iter().filter_map(|id| Self::deed_store().get(id).cloned()).map(|d| self.deed_view(&d)).collect()
    }

    /// NEP-171 transfer from a full-access wallet (1 yoctoNEAR). The vault and the control go with the deed.
    #[payable]
    pub fn nft_transfer(&mut self, receiver_id: AccountId, token_id: String, approval_id: Option<u64>, memo: Option<String>) {
        assert_one_yocto();
        require!(approval_id.is_none(), "approvals are not supported");
        let d = self.deed(&token_id);
        require!(d.owner == env::predecessor_account_id(), "NOT_YOURS");
        self.move_deed(&token_id, &d.owner, &receiver_id, memo);
    }

    #[payable]
    pub fn nft_transfer_call(&mut self, receiver_id: AccountId, token_id: String, approval_id: Option<u64>, memo: Option<String>, msg: String) -> PromiseOrValue<bool> {
        assert_one_yocto();
        require!(approval_id.is_none(), "approvals are not supported");
        let d = self.deed(&token_id);
        let sender = env::predecessor_account_id();
        require!(d.owner == sender, "NOT_YOURS");
        self.move_deed(&token_id, &sender, &receiver_id, memo);
        let spare = env::prepaid_gas().saturating_sub(env::used_gas()).saturating_sub(GAS_FOR_RESOLVE).saturating_sub(GAS_RESERVE);
        require!(spare.as_tgas() >= 5, "attach more gas for the receiver");
        Promise::new(receiver_id.clone())
            .function_call("nft_on_transfer", json!({"sender_id": sender, "previous_owner_id": sender, "token_id": token_id, "msg": msg}).to_string().into_bytes(),
                NearToken::from_yoctonear(0), spare)
            .then(Promise::new(env::current_account_id()).function_call("nft_resolve_transfer",
                json!({"previous_owner_id": sender, "receiver_id": receiver_id, "token_id": token_id}).to_string().into_bytes(),
                NearToken::from_yoctonear(0), GAS_FOR_RESOLVE))
            .into()
    }

    /// True if the receiver kept the deed. If it asked for it back (or failed), the deed returns to the sender.
    #[private]
    pub fn nft_resolve_transfer(&mut self, previous_owner_id: AccountId, receiver_id: AccountId, token_id: String,
        approved_account_ids: Option<std::collections::HashMap<AccountId, u64>>) -> bool {
        let _ = approved_account_ids;
        let give_back = match env::promise_result_checked(0, 16_384) {
            Ok(bytes) => serde_json::from_slice::<bool>(&bytes).unwrap_or(true),
            Err(_) => true,
        };
        let d = self.deed(&token_id);
        if give_back && d.owner == receiver_id {
            self.move_deed(&token_id, &receiver_id, &previous_owner_id, Some("returned".into()));
            return false;
        }
        true
    }

    pub fn nft_token(&self, token_id: String) -> Option<Value> {
        Self::deed_store().get(&token_id).map(|d| self.nft_json(d))
    }
    pub fn nft_total_supply(&self) -> U128 {
        U128(Self::all_deeds().len() as u128)
    }
    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Value> {
        Self::all_deeds().iter().skip(from_index.map_or(0, |i| i.0 as usize)).take(limit.unwrap_or(50) as usize)
            .filter_map(|id| Self::deed_store().get(id).map(|d| self.nft_json(d))).collect()
    }
    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        U128(self.deeds_held(&account_id) as u128)
    }
    pub fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Value> {
        Self::all_deeds().iter().filter_map(|id| Self::deed_store().get(id).cloned()).filter(|d| d.owner == account_id)
            .skip(from_index.map_or(0, |i| i.0 as usize)).take(limit.unwrap_or(50) as usize).map(|d| self.nft_json(&d)).collect()
    }
    pub fn nft_metadata(&self) -> Value {
        json!({"spec": "nft-1.0.0", "name": "Ashes Shop Deeds", "symbol": "DEED", "icon": null, "base_uri": self.base_uri, "reference": null, "reference_hash": null})
    }

    // ------------------------------------------------------------------ player listings

    /// Puts goods up for sale at your own price. They move into the contract's escrow until bought or cancelled.
    pub fn listing_create(&mut self, token_id: String, amount: U128, price_each: U128) -> u64 {
        require!(!self.paused, "PAUSED");
        let seller = env::predecessor_account_id();
        require!(!self.merchants.contains_key(&seller), "merchants trade through their agents");
        let index = self.index_of(&token_id);
        require!(index != JADE_INDEX, "jade is the currency, not a good");
        require!(amount.0 > 0 && amount.0 <= 10_000, "BAD_AMOUNT");
        require!(price_each.0 > 0 && price_each.0 <= 100_000_000, "BAD_PRICE");
        let mut open = Self::open_listings();
        require!(open.len() < MAX_OPEN_LISTINGS, "MARKET_FULL");
        let mut counts = Self::listing_counts();
        let mine = *counts.get(&seller).unwrap_or(&0);
        require!(mine < MAX_LISTINGS_PER_SELLER, "TOO_MANY_LISTINGS");
        let have = self.balance(&seller, index);
        require!(have >= amount.0, "NOT_HELD");
        self.set_balance(&seller, index, have - amount.0);
        let escrow = env::current_account_id();
        let held = self.balance(&escrow, index);
        self.set_balance(&escrow, index, held + amount.0);
        let id = env::storage_read(NEXT_LISTING).map_or(1, |b| u64::from_le_bytes(b.try_into().unwrap_or([0; 8])).max(1));
        env::storage_write(NEXT_LISTING, &(id + 1).to_le_bytes());
        Self::listing_store().insert(id, Listing { id, seller: seller.clone(), token_id: token_id.clone(), amount, price_each, created_ms: env::block_timestamp_ms() });
        open.push(id);
        Self::save_open_listings(&open);
        counts.insert(seller.clone(), mine + 1);
        emit_mt("mt_transfer", json!({"old_owner_id": seller, "new_owner_id": escrow, "token_ids": [token_id], "amounts": [amount], "memo": format!("listing #{id}")}));
        id
    }

    /// Buys from a player's listing. The seller is paid at once, less the Ministry's trade tax.
    pub fn listing_fill(&mut self, listing_id: u64, amount: U128, max_price_each: U128) -> ListingReceipt {
        require!(!self.paused, "PAUSED");
        let buyer = env::predecessor_account_id();
        require!(!self.merchants.contains_key(&buyer), "merchants trade through their agents");
        let mut listings = Self::listing_store();
        let mut l = listings.get(&listing_id).cloned().unwrap_or_else(|| fail("NO_LISTING"));
        require!(buyer != l.seller, "OWN_LISTING");
        require!(l.price_each.0 <= max_price_each.0, "PRICE_MOVED");
        require!(amount.0 > 0 && amount.0 <= l.amount.0, "NOT_ENOUGH");
        let total = amount.0 * l.price_each.0;
        let tax = total * pricing::tax_bps(self.testimony_bps as i128) as u128 / BPS as u128;
        let index = self.index_of(&l.token_id);
        let jade = self.balance(&buyer, JADE_INDEX);
        require!(jade >= total, "NO_JADE");
        self.set_balance(&buyer, JADE_INDEX, jade - total);
        let seller_jade = self.balance(&l.seller, JADE_INDEX);
        self.set_balance(&l.seller, JADE_INDEX, seller_jade + total - tax);
        if tax > 0 {
            let ministry = self.ministry_id.clone();
            let have = self.balance(&ministry, JADE_INDEX);
            self.set_balance(&ministry, JADE_INDEX, have + tax);
        }
        let escrow = env::current_account_id();
        let held = self.balance(&escrow, index);
        self.set_balance(&escrow, index, held - amount.0);
        let got = self.balance(&buyer, index);
        self.set_balance(&buyer, index, got + amount.0);
        l.amount = U128(l.amount.0 - amount.0);
        let memo = format!("listing #{listing_id}");
        emit_mt("mt_transfer", json!({"old_owner_id": escrow, "new_owner_id": buyer, "token_ids": [l.token_id], "amounts": [amount], "memo": memo}));
        emit_mt("mt_transfer", json!({"old_owner_id": buyer, "new_owner_id": l.seller, "token_ids": [JADE], "amounts": [U128(total - tax)], "memo": memo}));
        if tax > 0 {
            emit_mt("mt_transfer", json!({"old_owner_id": buyer, "new_owner_id": self.ministry_id, "token_ids": [JADE], "amounts": [U128(tax)], "memo": "ministry tax"}));
        }
        let token_id = l.token_id.clone();
        if l.amount.0 == 0 {
            listings.remove(&listing_id);
            drop(listings);
            self.close_listing(listing_id, &l.seller);
        } else {
            listings.insert(listing_id, l);
        }
        ListingReceipt { listing_id, token_id, amount, total: U128(total), tax: U128(tax) }
    }

    /// Takes a listing down; the goods come back from escrow.
    pub fn listing_cancel(&mut self, listing_id: u64) {
        let seller = env::predecessor_account_id();
        let mut listings = Self::listing_store();
        let l = listings.get(&listing_id).cloned().unwrap_or_else(|| fail("NO_LISTING"));
        require!(l.seller == seller, "NOT_YOURS");
        listings.remove(&listing_id);
        drop(listings);
        let index = self.index_of(&l.token_id);
        let escrow = env::current_account_id();
        let held = self.balance(&escrow, index);
        self.set_balance(&escrow, index, held - l.amount.0);
        let have = self.balance(&seller, index);
        self.set_balance(&seller, index, have + l.amount.0);
        self.close_listing(listing_id, &seller);
        emit_mt("mt_transfer", json!({"old_owner_id": escrow, "new_owner_id": seller, "token_ids": [l.token_id], "amounts": [l.amount], "memo": format!("listing #{listing_id} cancelled")}));
    }

    /// Open listings, oldest first.
    pub fn listings(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Listing> {
        let all = Self::listing_store();
        Self::open_listings().iter().skip(from_index.unwrap_or(0) as usize).take(limit.unwrap_or(100).min(200) as usize)
            .filter_map(|id| all.get(id).cloned()).collect()
    }
    pub fn listing(&self, listing_id: u64) -> Option<Listing> {
        Self::listing_store().get(&listing_id).cloned()
    }

    /// Anyone may bring merchants up to the current market hour (a keeper calls this so idle shops keep living).
    pub fn market_advance(&mut self, merchant_ids: Vec<AccountId>) {
        for id in merchant_ids {
            let m = self.caught_up(&id);
            self.merchants.insert(id, m);
        }
    }

    // ------------------------------------------------------------------ NEP-245 core

    #[payable]
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId, u64)>, memo: Option<String>) {
        assert_one_yocto();
        require!(approval.is_none(), "approvals are not supported");
        let sender = env::predecessor_account_id();
        self.move_tokens(&sender, &receiver_id, &[token_id], &[amount], memo);
    }

    #[payable]
    pub fn mt_batch_transfer(&mut self, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>,
        approvals: Option<Vec<Option<(AccountId, u64)>>>, memo: Option<String>) {
        assert_one_yocto();
        require!(token_ids.len() == amounts.len(), "token_ids and amounts differ in length");
        require!(approvals.map_or(true, |a| a.len() == token_ids.len() && a.iter().all(Option::is_none)), "approvals are not supported");
        let sender = env::predecessor_account_id();
        self.move_tokens(&sender, &receiver_id, &token_ids, &amounts, memo);
    }

    #[payable]
    pub fn mt_transfer_call(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId, u64)>,
        memo: Option<String>, msg: String) -> PromiseOrValue<Vec<U128>> {
        require!(approval.is_none(), "approvals are not supported");
        self.mt_batch_transfer_call(receiver_id, vec![token_id], vec![amount], None, memo, msg)
    }

    #[payable]
    pub fn mt_batch_transfer_call(&mut self, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>,
        approvals: Option<Vec<Option<(AccountId, u64)>>>, memo: Option<String>, msg: String) -> PromiseOrValue<Vec<U128>> {
        assert_one_yocto();
        require!(token_ids.len() == amounts.len(), "token_ids and amounts differ in length");
        require!(approvals.map_or(true, |a| a.len() == token_ids.len() && a.iter().all(Option::is_none)), "approvals are not supported");
        let sender = env::predecessor_account_id();
        self.move_tokens(&sender, &receiver_id, &token_ids, &amounts, memo);
        let spare = env::prepaid_gas().saturating_sub(env::used_gas()).saturating_sub(GAS_FOR_RESOLVE).saturating_sub(GAS_RESERVE);
        require!(spare.as_tgas() >= 5, "attach more gas for the receiver");
        let previous: Vec<AccountId> = token_ids.iter().map(|_| sender.clone()).collect();
        Promise::new(receiver_id.clone())
            .function_call("mt_on_transfer", json!({"sender_id": sender, "previous_owner_ids": previous, "token_ids": token_ids,
                "amounts": amounts, "msg": msg}).to_string().into_bytes(), NearToken::from_yoctonear(0), spare)
            .then(Promise::new(env::current_account_id()).function_call("mt_resolve_transfer",
                json!({"sender_id": sender, "receiver_id": receiver_id, "token_ids": token_ids, "amounts": amounts}).to_string().into_bytes(),
                NearToken::from_yoctonear(0), GAS_FOR_RESOLVE))
            .into()
    }

    /// Returns the amounts the receiver kept; whatever it returned (or everything, if it failed) goes back to the sender.
    #[private]
    pub fn mt_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>) -> Vec<U128> {
        let unused: Vec<u128> = env::promise_result_checked(0, 16_384).ok()
            .and_then(|bytes| serde_json::from_slice::<Vec<U128>>(&bytes).ok())
            .filter(|u| u.len() == amounts.len())
            .map(|u| u.iter().zip(&amounts).map(|(u, a)| u.0.min(a.0)).collect())
            .unwrap_or_else(|| amounts.iter().map(|a| a.0).collect());
        let mut kept = vec![];
        let (mut refund_ids, mut refund_amounts) = (vec![], vec![]);
        for (i, id) in token_ids.iter().enumerate() {
            let index = self.index_of(id);
            let refund = unused[i].min(self.balance_any(&receiver_id, index));
            if refund > 0 {
                self.debit(&receiver_id, index, refund);
                self.credit(&sender_id, index, refund);
                refund_ids.push(id.clone());
                refund_amounts.push(U128(refund));
            }
            kept.push(U128(amounts[i].0 - refund));
        }
        if !refund_ids.is_empty() {
            emit_mt("mt_transfer", json!({"old_owner_id": receiver_id, "new_owner_id": sender_id, "token_ids": refund_ids, "amounts": refund_amounts, "memo": "refund"}));
        }
        kept
    }

    pub fn mt_token(&self, token_ids: Vec<String>) -> Vec<Option<Token>> {
        token_ids.into_iter().map(|id| self.token_index.contains_key(&id).then(|| Token { base_metadata_id: id.clone(), token_id: id, owner_id: None })).collect()
    }
    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        U128(self.token_index.get(&token_id).map_or(0, |&i| self.balance_view(&account_id, i)))
    }
    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<String>) -> Vec<U128> {
        token_ids.into_iter().map(|id| self.mt_balance_of(account_id.clone(), id)).collect()
    }
    pub fn mt_supply(&self, token_id: String) -> Option<U128> {
        self.token_index.get(&token_id).map(|i| U128(*self.supply.get(i).unwrap_or(&0)))
    }
    pub fn mt_batch_supply(&self, token_ids: Vec<String>) -> Vec<Option<U128>> {
        token_ids.into_iter().map(|id| self.mt_supply(id)).collect()
    }

    // ------------------------------------------------------------------ NEP-245 metadata

    pub fn mt_metadata_contract(&self) -> Value {
        json!({"spec": "mt-1.0.0", "name": "Ashes of the Ninth Heaven"})
    }
    pub fn mt_metadata_token_all(&self, token_ids: Vec<String>) -> Vec<Value> {
        token_ids.iter().map(|id| json!({"base": self.base_meta(id), "token": self.token_meta(id)})).collect()
    }
    pub fn mt_metadata_token_by_token_id(&self, token_ids: Vec<String>) -> Vec<Value> {
        token_ids.iter().map(|id| self.token_meta(id)).collect()
    }
    pub fn mt_metadata_base_by_token_id(&self, token_ids: Vec<String>) -> Vec<Value> {
        token_ids.iter().map(|id| self.base_meta(id)).collect()
    }

    // ------------------------------------------------------------------ views for the game

    pub fn market_tick(&self) -> u64 {
        self.current_tick()
    }
    pub fn market_merchants(&self) -> Vec<AccountId> {
        self.merchants.keys().cloned().collect()
    }
    /// A merchant's books as of now (caught up in memory; nothing is written).
    pub fn market_merchant(&self, merchant_id: AccountId) -> MerchantView {
        let m = self.simulated(&merchant_id).0;
        let def = m.def();
        MerchantView {
            account_id: merchant_id, rules_id: m.rules_id.clone(), name: def.name.into(), cash: U128(m.state.cash.max(0) as u128),
            status: status_name(pricing::merchant_status(def, &m.state)).into(), closed: m.state.closed, specialty: m.state.specialty.clone(),
            tick: self.current_tick(),
            goods: m.goods_info.iter().enumerate().map(|(i, t)| GoodView { token_id: t.id.clone(), stock: U128(m.state.stock[i].max(0) as u128),
                target: U128(m.state.target[i] as u128), base_target: U128(m.state.base_target[i] as u128), flow: m.state.flow[i] }).collect(),
            patrons: m.patrons.iter().map(|(a, s)| (a.clone(), U128(*s as u128))).collect(),
        }
    }
    /// The exact on-chain quote for a trade right now. `side` is "sell" or "buy" from the player's point of view.
    pub fn market_quote(&self, merchant_id: AccountId, token_id: String, side: String, amount: U128, account_id: Option<AccountId>) -> QuoteView {
        let m = self.simulated(&merchant_id).0;
        let index = self.index_of(&token_id);
        let rep = account_id.map_or(0, |a| self.reputation(&a, &merchant_id, &m));
        let token = self.info_of(&m, index);
        let q = pricing::quote(m.def(), &token, &m.state, m.position(index), side == "sell", amount.0 as i128, self.current_tick(), rep, self.testimony_bps as i128);
        QuoteView { code: q.code.into(), total: U128(q.total as u128), tax: U128(q.tax_paid as u128), units: q.units.iter().map(|u| U128(*u as u128)).collect(),
            bid: U128(q.bid as u128), ask: U128(q.ask as u128), mid: U128(q.mid as u128), status: status_name(q.status).into(), tick: self.current_tick() }
    }
    pub fn seq_of(&self, account_id: AccountId) -> u64 {
        *self.seqs.get(&account_id).unwrap_or(&0)
    }
    pub fn tokens(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<TokenMeta> {
        let from = from_index.unwrap_or(0);
        (from..self.tokens.len().min(from + limit.unwrap_or(100))).filter_map(|i| self.tokens.get(i).cloned()).collect()
    }
    pub fn contract_info(&self) -> Value {
        json!({"owner_id": self.owner_id, "minter_id": self.minter_id, "ministry_id": self.ministry_id, "genesis_ms": self.genesis_ms,
            "tick_ms": self.tick_ms, "tick": self.current_tick(), "testimony_bps": self.testimony_bps, "tokens": self.tokens.len(),
            "merchants": self.merchants.len(), "paused": self.paused, "base_uri": self.base_uri})
    }
}

// ---------------------------------------------------------------------- internals
impl Contract {
    fn deed_store() -> LookupMap<String, Deed> {
        LookupMap::new(Key::Deeds)
    }
    fn all_deeds() -> Vec<String> {
        env::storage_read(ALL_DEEDS).map(|b| near_sdk::borsh::from_slice(&b).unwrap_or_default()).unwrap_or_default()
    }
    fn save_all_deeds(all: &Vec<String>) {
        env::storage_write(ALL_DEEDS, &near_sdk::borsh::to_vec(all).unwrap());
    }
    fn deed_for(&self, rules_id: &str) -> Option<Deed> {
        Self::deed_store().get(&format!("deed:{rules_id}")).cloned()
    }
    fn deed(&self, token_id: &str) -> Deed {
        Self::deed_store().get(token_id).cloned().unwrap_or_else(|| fail("NO_DEED"))
    }
    fn deed_of_caller(&self, token_id: &str) -> Deed {
        let d = self.deed(token_id);
        require!(d.owner == env::predecessor_account_id(), "NOT_YOURS");
        d
    }
    fn deeds_held(&self, account: &AccountId) -> usize {
        Self::all_deeds().iter().filter(|id| Self::deed_store().get(*id).map_or(false, |d| &d.owner == account)).count()
    }
    fn move_deed(&mut self, token_id: &str, from: &AccountId, to: &AccountId, memo: Option<String>) -> Deed {
        require!(!self.merchants.contains_key(to), "a shop cannot own its own deed");
        require!(to == &self.ministry_id || self.deeds_held(to) < DEED_MAX_PER_ACCOUNT, "TOO_MANY_DEEDS");
        let d = self.deed(token_id);
        require!(&d.owner == from, "NOT_YOURS");
        // A new holder starts with the merchant's agent appointed and nothing listed; the vault stays with the deed.
        let next = Deed { owner: to.clone(), price: None, agent: true, ..d };
        Self::deed_store().insert(token_id.to_string(), next.clone());
        emit("nep171", "1.0.0", "nft_transfer", json!({"old_owner_id": from, "new_owner_id": to, "token_ids": [token_id], "memo": memo}));
        next
    }
    fn deed_view(&self, d: &Deed) -> Value {
        let for_sale = if d.owner == self.ministry_id { Some(U128(DEED_PRICE)) } else { d.price };
        json!({"token_id": d.token_id, "rules_id": d.rules_id, "merchant_id": d.merchant_id, "owner_id": d.owner, "for_sale": for_sale,
            "vault": d.vault, "agent": d.agent, "owner_share_bps": DEED_OWNER_SHARE_BPS, "held_by_ministry": d.owner == self.ministry_id})
    }
    fn nft_json(&self, d: &Deed) -> Value {
        let m = self.merchants.get(&d.merchant_id);
        let name = m.map(|m| m.def().name.to_string()).unwrap_or_else(|| d.rules_id.clone());
        json!({"token_id": d.token_id, "owner_id": d.owner, "approved_account_ids": {},
            "metadata": {"title": format!("Deed to {name}'s shop"), "description": format!("Whoever holds this deed owns {name}'s shop: it takes {}% of each profitable market day into its vault, and runs the shop's strategy or appoints the merchant's agent.", DEED_OWNER_SHARE_BPS / 100),
                "media": self.base_uri.as_ref().map(|b| format!("{b}deeds/{}.svg", d.rules_id)), "media_hash": null, "copies": 1,
                "issued_at": d.minted_ms.to_string(), "extra": self.deed_view(d).to_string(), "reference": null, "reference_hash": null}})
    }
    fn listing_store() -> LookupMap<u64, Listing> {
        LookupMap::new(Key::Listings)
    }
    fn listing_counts() -> LookupMap<AccountId, u32> {
        LookupMap::new(Key::ListingCounts)
    }
    fn open_listings() -> Vec<u64> {
        env::storage_read(OPEN_LISTINGS).map(|b| near_sdk::borsh::from_slice(&b).unwrap_or_default()).unwrap_or_default()
    }
    fn save_open_listings(open: &Vec<u64>) {
        env::storage_write(OPEN_LISTINGS, &near_sdk::borsh::to_vec(open).unwrap());
    }
    fn close_listing(&mut self, listing_id: u64, seller: &AccountId) {
        let mut open = Self::open_listings();
        open.retain(|id| *id != listing_id);
        Self::save_open_listings(&open);
        let mut counts = Self::listing_counts();
        let mine = *counts.get(seller).unwrap_or(&1);
        if mine <= 1 { counts.remove(seller); } else { counts.insert(seller.clone(), mine - 1); }
    }
    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "only the owner");
    }
    fn register(&mut self, token: TokenMeta) {
        require!(!token.id.is_empty() && token.id.len() <= 96, "bad token id");
        self.token_index.insert(token.id.clone(), self.tokens.len());
        self.tokens.push(token);
    }
    fn index_of(&self, token_id: &str) -> u32 {
        *self.token_index.get(token_id).unwrap_or_else(|| fail("UNKNOWN_TOKEN"))
    }
    fn info_of(&self, m: &Merchant, index: u32) -> TokenInfo {
        m.position(index).map(|p| m.goods_info[p].clone()).unwrap_or_else(|| self.tokens.get(index).unwrap().info())
    }
    fn current_tick(&self) -> u64 {
        env::block_timestamp_ms().saturating_sub(self.genesis_ms) / self.tick_ms
    }
    fn next_seq(&mut self, seq: u64) -> bool {
        let caller = env::predecessor_account_id();
        let last = *self.seqs.get(&caller).unwrap_or(&0);
        if seq <= last {
            return false;
        }
        require!(seq == last + 1, "SEQ_GAP");
        self.seqs.insert(caller, seq);
        true
    }
    fn add_supply(&mut self, index: u32, delta: i128) {
        let now = *self.supply.get(&index).unwrap_or(&0) as i128;
        self.supply.insert(index, (now + delta).max(0) as u128);
    }
    fn balance(&self, account: &AccountId, index: u32) -> u128 {
        *self.balances.get(&(account.clone(), index)).unwrap_or(&0)
    }
    fn set_balance(&mut self, account: &AccountId, index: u32, amount: u128) {
        if amount == 0 {
            self.balances.remove(&(account.clone(), index));
        } else {
            self.balances.insert((account.clone(), index), amount);
        }
    }
    fn balances_of_player_empty(&self, account: &AccountId) -> bool {
        self.balance(account, JADE_INDEX) == 0
    }
    /// Balance for a view: a merchant's books are caught up in memory first.
    fn balance_view(&self, account: &AccountId, index: u32) -> u128 {
        if self.merchants.contains_key(account) {
            let m = self.simulated(account).0;
            return Self::merchant_holding(&m, index);
        }
        self.balance(account, index)
    }
    fn merchant_holding(m: &Merchant, index: u32) -> u128 {
        if index == JADE_INDEX {
            return m.state.cash.max(0) as u128;
        }
        m.position(index).map_or(0, |p| m.state.stock[p].max(0) as u128)
    }
    fn balance_any(&mut self, account: &AccountId, index: u32) -> u128 {
        if self.merchants.contains_key(account) {
            let m = self.caught_up(account);
            let held = Self::merchant_holding(&m, index);
            self.merchants.insert(account.clone(), m);
            return held;
        }
        self.balance(account, index)
    }
    fn debit(&mut self, account: &AccountId, index: u32, amount: u128) {
        if let Some(mut m) = self.merchants.get(account).cloned() {
            if index == JADE_INDEX {
                require!(m.state.cash as u128 >= amount, "insufficient balance");
                m.state.cash -= amount as i64;
            } else {
                let p = m.position(index).unwrap_or_else(|| fail("insufficient balance"));
                require!(m.state.stock[p] as u128 >= amount, "insufficient balance");
                m.state.stock[p] -= amount as i64;
            }
            self.merchants.insert(account.clone(), m);
            return;
        }
        let have = self.balance(account, index);
        require!(have >= amount, "insufficient balance");
        self.set_balance(account, index, have - amount);
    }
    fn credit(&mut self, account: &AccountId, index: u32, amount: u128) {
        if let Some(mut m) = self.merchants.get(account).cloned() {
            if index == JADE_INDEX {
                m.state.cash += amount as i64;
            } else {
                let p = m.position(index).unwrap_or_else(|| fail("this merchant does not deal in that good"));
                m.state.stock[p] += amount as i64;
            }
            self.merchants.insert(account.clone(), m);
            return;
        }
        let have = self.balance(account, index);
        self.set_balance(account, index, have + amount);
    }
    fn move_tokens(&mut self, sender: &AccountId, receiver: &AccountId, token_ids: &[String], amounts: &[U128], memo: Option<String>) {
        require!(sender != receiver, "sender and receiver are the same");
        require!(!token_ids.is_empty(), "nothing to transfer");
        for account in [sender, receiver] {
            if self.merchants.contains_key(account) {
                let m = self.caught_up(account);
                self.merchants.insert(account.clone(), m);
            }
        }
        for (id, amount) in token_ids.iter().zip(amounts) {
            require!(amount.0 > 0, "amount must be positive");
            let index = self.index_of(id);
            self.debit(sender, index, amount.0);
            self.credit(receiver, index, amount.0);
        }
        emit_mt("mt_transfer", json!({"old_owner_id": sender, "new_owner_id": receiver, "token_ids": token_ids, "amounts": amounts, "memo": memo}));
    }

    fn reputation(&self, player: &AccountId, merchant_id: &AccountId, m: &Merchant) -> i128 {
        let volume = *self.volume.get(&(player.clone(), merchant_id.clone())).unwrap_or(&0) as i128;
        BPS.min(volume * BPS * 10 / m.def().start_cash)
    }

    /// Process every market hour the merchant has missed (at most a market week), in memory.
    fn simulated(&self, merchant_id: &AccountId) -> (Merchant, CatchUp) {
        let mut m = self.merchants.get(merchant_id).cloned().unwrap_or_else(|| fail("UNKNOWN_MERCHANT"));
        let now = self.current_tick();
        let mut out = CatchUp { stock_delta: vec![0; m.goods.len()], ..Default::default() };
        if m.next_tick >= now {
            return (m, out);
        }
        let def = m.def();
        let start = m.next_tick.max(now.saturating_sub(MAX_CATCH_UP_TICKS));
        let before = m.state.clone();
        let mut dividends: Vec<(AccountId, i64)> = vec![];
        let deed_holder = self.deed_for(&m.rules_id).filter(|d| d.owner != self.ministry_id).map(|d| d.owner);
        let mut deed_share = 0i64;
        for tick in start..now {
            m.state = pricing::tick_merchant(def, &m.goods_info, &m.state, tick);
            if (tick + 1) % TICKS_PER_DAY == 0 {
                let stake = m.stake();
                let profit = m.state.cash - m.day_start - m.capital_in;
                if stake > 0 && profit > 0 && !m.state.closed {
                    let share = PATRON_MAX_PUBLIC_BPS.min(stake as i128 * BPS / def.start_cash);
                    let mut paid = 0i64;
                    for (patron, amount) in &m.patrons {
                        let cut = ((profit as i128 * share / BPS) * *amount as i128 / stake as i128) as i64;
                        if cut > 0 {
                            dividends.push((patron.clone(), cut));
                            paid += cut;
                        }
                    }
                    m.state.cash -= paid;
                }
                if deed_holder.is_some() && profit > 0 && !m.state.closed {
                    let cut = (profit as i128 * DEED_OWNER_SHARE_BPS / BPS) as i64;
                    m.state.cash -= cut;
                    deed_share += cut;
                }
                m.day_start = m.state.cash;
                m.capital_in = 0;
            }
        }
        m.next_tick = now;
        let paid: i64 = dividends.iter().map(|(_, c)| c).sum();
        out.cash_delta = m.state.cash - before.cash + paid + deed_share;
        out.deed_share = deed_share;
        out.stock_delta = m.state.stock.iter().zip(&before.stock).map(|(a, b)| a - b).collect();
        out.dividends = dividends;
        (m, out)
    }

    /// Catch a merchant up for real: write supply, pay patrons and emit the events.
    fn caught_up(&mut self, merchant_id: &AccountId) -> Merchant {
        let (m, out) = self.simulated(merchant_id);
        let (mut minted, mut minted_n, mut burned, mut burned_n) = (vec![], vec![], vec![], vec![]);
        let mut book = |id: &str, delta: i64| {
            if delta > 0 {
                minted.push(id.to_string());
                minted_n.push(delta.to_string());
            } else if delta < 0 {
                burned.push(id.to_string());
                burned_n.push((-delta).to_string());
            }
        };
        book(JADE, out.cash_delta);
        for (i, d) in out.stock_delta.iter().enumerate() {
            book(&m.goods_info[i].id, *d);
        }
        self.add_supply(JADE_INDEX, out.cash_delta as i128);
        for (i, d) in out.stock_delta.iter().enumerate() {
            self.add_supply(m.goods[i], *d as i128);
        }
        if !minted.is_empty() {
            emit_mt("mt_mint", json!({"owner_id": merchant_id, "token_ids": minted, "amounts": minted_n, "memo": "caravans"}));
        }
        if !burned.is_empty() {
            emit_mt("mt_burn", json!({"owner_id": merchant_id, "token_ids": burned, "amounts": burned_n, "memo": "upkeep and caravans"}));
        }
        if out.deed_share > 0 {
            let key = format!("deed:{}", m.rules_id);
            let mut deeds = Self::deed_store();
            if let Some(mut d) = deeds.get(&key).cloned() {
                d.vault = U128(d.vault.0 + out.deed_share as u128);
                deeds.insert(key.clone(), d);
                drop(deeds);
                let escrow = env::current_account_id();
                let held = self.balance(&escrow, JADE_INDEX);
                self.set_balance(&escrow, JADE_INDEX, held + out.deed_share as u128);
                emit_mt("mt_transfer", json!({"old_owner_id": merchant_id, "new_owner_id": escrow, "token_ids": [JADE], "amounts": [out.deed_share.to_string()], "memo": format!("owner's share to {key}")}));
            }
        }
        for (patron, cut) in &out.dividends {
            let have = self.balance(patron, JADE_INDEX);
            self.set_balance(patron, JADE_INDEX, have + *cut as u128);
            emit_mt("mt_transfer", json!({"old_owner_id": merchant_id, "new_owner_id": patron, "token_ids": [JADE], "amounts": [cut.to_string()], "memo": "dividend"}));
        }
        m
    }

    fn trade(&mut self, merchant_id: AccountId, token_id: String, amount: U128, sell: bool, limit: u128) -> MarketReceipt {
        require!(!self.paused, "PAUSED");
        let player = env::predecessor_account_id();
        require!(player != merchant_id && !self.merchants.contains_key(&player), "merchants trade through their agents");
        let mut m = self.caught_up(&merchant_id);
        let index = self.index_of(&token_id);
        require!(index != JADE_INDEX, "jade is the currency, not a good");
        let tick = self.current_tick();
        let token = self.info_of(&m, index);
        let rep = self.reputation(&player, &merchant_id, &m);
        let q = pricing::quote(m.def(), &token, &m.state, m.position(index), sell, amount.0 as i128, tick, rep, self.testimony_bps as i128);
        if !q.ok() {
            fail(q.code);
        }
        let (total, tax) = (q.total as u128, q.tax_paid as u128);
        if (sell && total < limit) || (!sell && total > limit) {
            fail("PRICE_MOVED");
        }
        let p = m.position(index).unwrap();
        if sell {
            let have = self.balance(&player, index);
            require!(have >= amount.0, "NOT_HELD");
            self.set_balance(&player, index, have - amount.0);
            let jade = self.balance(&player, JADE_INDEX);
            self.set_balance(&player, JADE_INDEX, jade + total);
        } else {
            let jade = self.balance(&player, JADE_INDEX);
            require!(jade >= total, "NO_JADE");
            self.set_balance(&player, JADE_INDEX, jade - total);
            let have = self.balance(&player, index);
            self.set_balance(&player, index, have + amount.0);
        }
        pricing::apply_quote(&mut m.state, p, sell, amount.0 as i128, q.total, q.tax_paid);
        if tax > 0 {
            let ministry = self.ministry_id.clone();
            let have = self.balance(&ministry, JADE_INDEX);
            self.set_balance(&ministry, JADE_INDEX, have + tax);
        }
        let key = (player.clone(), merchant_id.clone());
        let volume = *self.volume.get(&key).unwrap_or(&0);
        self.volume.insert(key, volume + total);
        let memo = if sell { "market_sell" } else { "market_buy" };
        let (from, to) = if sell { (&player, &merchant_id) } else { (&merchant_id, &player) };
        emit_mt("mt_transfer", json!({"old_owner_id": from, "new_owner_id": to, "token_ids": [token_id], "amounts": [amount], "memo": memo}));
        emit_mt("mt_transfer", json!({"old_owner_id": to, "new_owner_id": from, "token_ids": [JADE], "amounts": [U128(if sell { total } else { total - tax })], "memo": memo}));
        if tax > 0 {
            let payer = if sell { &merchant_id } else { &player };
            emit_mt("mt_transfer", json!({"old_owner_id": payer, "new_owner_id": self.ministry_id, "token_ids": [JADE], "amounts": [U128(tax)], "memo": "ministry tax"}));
        }
        self.merchants.insert(merchant_id.clone(), m);
        MarketReceipt { merchant_id, token_id, amount, total: U128(total), tax: U128(tax), tick }
    }

    fn base_meta(&self, id: &str) -> Value {
        let t = self.tokens.get(self.index_of(id)).unwrap();
        json!({"name": t.title, "id": t.id, "symbol": if t.id == JADE { Some("JADE") } else { None }, "icon": null,
            "decimals": t.decimals.to_string(), "base_uri": self.base_uri, "reference": null, "copies": null, "reference_hash": null})
    }
    fn token_meta(&self, id: &str) -> Value {
        let t = self.tokens.get(self.index_of(id)).unwrap();
        json!({"title": t.title, "description": format!("{} · {}", t.kind, t.family), "media": t.media, "media_hash": null,
            "issued_at": null, "expires_at": null, "starts_at": null, "updated_at": null,
            "extra": json!({"kind": t.kind, "family": t.family, "school": t.school, "tier": t.tier, "base": t.base}).to_string(),
            "reference": null, "reference_hash": null})
    }
}

#[cfg(test)]
mod tests;
