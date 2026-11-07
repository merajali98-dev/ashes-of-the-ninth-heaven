use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, NearToken, PromiseResult, RuntimeFeesConfig};

const TICK: u64 = 60_000;
fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn at(predecessor: &str, ms: u64, yocto: u128) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(acc("items.test"))
        .predecessor_account_id(acc(predecessor))
        .block_timestamp(ms * 1_000_000)
        .attached_deposit(NearToken::from_yoctonear(yocto))
        .prepaid_gas(Gas::from_tgas(300))
        .build());
}

/// The 45 materials (economy.js prices, in cents) and two pills, in registry order.
fn market_tokens() -> Vec<TokenMeta> {
    let families = [("seal-jade", None), ("essence-iron", Some("iron")), ("essence-ember", Some("ember")), ("essence-tide", Some("tide")),
        ("essence-shade", Some("shade")), ("essence-lotus", Some("lotus")), ("essence-thunder", Some("thunder")), ("essence-star", Some("star")),
        ("essence-neutral", Some("neutral"))];
    let mut out = vec![];
    for (family, school) in families {
        for tier in 1..=5u8 {
            let price = if school.is_some() { [2, 3, 5, 8, 12][tier as usize - 1] } else { [1, 2, 3, 5, 8][tier as usize - 1] };
            out.push(TokenMeta { id: format!("mat:{family}-{tier}"), title: format!("{family} {tier}"), kind: "material".into(), family: family.into(),
                school: school.map(str::to_string), tier, base: price * 100, media: None, decimals: 0 });
        }
    }
    for (id, school) in [("roadside-bitter-pill", "neutral"), ("paper-talisman", "neutral")] {
        out.push(TokenMeta { id: format!("item:{id}"), title: id.into(), kind: "consumable".into(), family: "pill".into(),
            school: Some(school.into()), tier: 0, base: 1_400, media: None, decimals: 0 });
    }
    out.push(TokenMeta { id: "card:palm-strike".into(), title: "Palm Strike".into(), kind: "card".into(), family: "card".into(),
        school: None, tier: 0, base: 0, media: None, decimals: 0 });
    out
}

fn setup() -> Contract {
    at("owner.test", 0, 0);
    let mut c = Contract::new(acc("owner.test"), acc("minter.test"), acc("ministry.test"), TICK, Some("https://ashes.example/".into()));
    c.register_tokens(market_tokens());
    c.add_merchant(acc("m-lu-yan.test"), "lu-yan".into());
    c.add_merchant(acc("m-auntie-shi.test"), "auntie-shi".into());
    at("minter.test", 0, 0);
    c.game_mint_batch(vec![
        MintEntry { account_id: acc("alice.test"), token_id: "mat:essence-ember-1".into(), amount: U128(60) },
        MintEntry { account_id: acc("alice.test"), token_id: JADE.into(), amount: U128(50_000) },
    ], 1, Some("test grant".into()));
    c
}

fn bal(c: &Contract, who: &str, token: &str) -> u128 {
    c.mt_balance_of(acc(who), token.into()).0
}

#[test]
fn minter_batches_apply_exactly_once() {
    let mut c = setup();
    assert_eq!(bal(&c, "alice.test", "mat:essence-ember-1"), 60);
    at("minter.test", 0, 0);
    let repeat = c.game_mint_batch(vec![MintEntry { account_id: acc("alice.test"), token_id: "mat:essence-ember-1".into(), amount: U128(60) }], 1, None);
    assert!(!repeat, "a retried batch is ignored");
    assert_eq!(bal(&c, "alice.test", "mat:essence-ember-1"), 60);
    assert!(c.game_burn_batch(vec![MintEntry { account_id: acc("alice.test"), token_id: "mat:essence-ember-1".into(), amount: U128(10) }], 2, Some("forge".into())));
    assert_eq!(bal(&c, "alice.test", "mat:essence-ember-1"), 50);
    assert!(get_logs().iter().any(|l| l.contains("\"event\":\"mt_burn\"") && l.contains("\"standard\":\"nep245\"")));
}

#[test]
#[should_panic(expected = "SEQ_GAP")]
fn a_skipped_sequence_number_is_refused() {
    let mut c = setup();
    at("minter.test", 0, 0);
    c.game_mint_batch(vec![], 3, None);
}

#[test]
#[should_panic(expected = "only the minter")]
fn only_the_minter_mints() {
    let mut c = setup();
    at("alice.test", 0, 0);
    c.game_mint_batch(vec![], 2, None);
}

#[test]
fn standard_transfers_move_balances_and_emit_nep245_events() {
    let mut c = setup();
    at("alice.test", 0, 1);
    c.mt_transfer(acc("bob.test"), "mat:essence-ember-1".into(), U128(5), None, Some("gift".into()));
    assert_eq!(bal(&c, "bob.test", "mat:essence-ember-1"), 5);
    let log = get_logs().into_iter().find(|l| l.contains("mt_transfer")).unwrap();
    assert!(log.starts_with("EVENT_JSON:"));
    let v: Value = serde_json::from_str(&log["EVENT_JSON:".len()..]).unwrap();
    assert_eq!(v["standard"], "nep245");
    assert_eq!(v["version"], "1.0.0");
    assert_eq!(v["data"][0]["old_owner_id"], "alice.test");
    assert_eq!(v["data"][0]["amounts"][0], "5");
    assert_eq!(c.mt_supply("mat:essence-ember-1".into()).unwrap().0, 60 + 120 + 40 * 0, "alice's grant plus Lu Yan's tier-1 stock");
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn standard_transfers_need_one_yocto() {
    let mut c = setup();
    at("alice.test", 0, 0);
    c.mt_transfer(acc("bob.test"), "mat:essence-ember-1".into(), U128(5), None, None);
}

#[test]
#[should_panic(expected = "token_ids and amounts differ in length")]
fn batch_lengths_must_match() {
    let mut c = setup();
    at("alice.test", 0, 1);
    c.mt_batch_transfer(acc("bob.test"), vec!["jade".into()], vec![], None, None);
}

#[test]
fn merchants_open_with_their_stock_and_purse_as_balances() {
    let c = setup();
    assert_eq!(bal(&c, "m-lu-yan.test", JADE), 250_000);
    assert_eq!(bal(&c, "m-lu-yan.test", "mat:essence-ember-1"), 120);
    assert_eq!(bal(&c, "m-lu-yan.test", "mat:essence-neutral-1"), 40);
    assert_eq!(bal(&c, "m-lu-yan.test", "mat:seal-jade-1"), 0, "she doesn't deal in Seal Jade");
    assert_eq!(bal(&c, "m-auntie-shi.test", "item:paper-talisman"), 12);
    assert_eq!(c.market_merchants().len(), 2);
}

#[test]
fn selling_pays_exactly_the_pricing_quote_and_the_ministry_its_tax() {
    let mut c = setup();
    let quote = c.market_quote(acc("m-lu-yan.test"), "mat:essence-ember-1".into(), "sell".into(), U128(10), Some(acc("alice.test")));
    assert_eq!(quote.code, "OK");
    at("alice.test", 0, 0);
    let receipt = c.market_sell(acc("m-lu-yan.test"), "mat:essence-ember-1".into(), U128(10), U128(quote.total.0));
    assert_eq!(receipt.total.0, quote.total.0);
    assert_eq!(receipt.tax.0, quote.tax.0);
    assert_eq!(bal(&c, "alice.test", JADE), 50_000 + quote.total.0);
    assert_eq!(bal(&c, "alice.test", "mat:essence-ember-1"), 50);
    assert_eq!(bal(&c, "m-lu-yan.test", "mat:essence-ember-1"), 130);
    assert_eq!(bal(&c, "m-lu-yan.test", JADE), 250_000 - quote.total.0 - quote.tax.0);
    assert_eq!(bal(&c, "ministry.test", JADE), quote.tax.0);
    let logs = get_logs();
    assert!(logs.iter().filter(|l| l.contains("market_sell")).count() >= 2);
    let after = c.market_quote(acc("m-lu-yan.test"), "mat:essence-ember-1".into(), "sell".into(), U128(1), None);
    assert!(after.bid.0 < quote.bid.0, "selling moved her price down");
}

#[test]
#[should_panic(expected = "PRICE_MOVED")]
fn a_trade_never_fills_below_the_sellers_minimum() {
    let mut c = setup();
    let quote = c.market_quote(acc("m-lu-yan.test"), "mat:essence-ember-1".into(), "sell".into(), U128(10), Some(acc("alice.test")));
    at("alice.test", 0, 0);
    c.market_sell(acc("m-lu-yan.test"), "mat:essence-ember-1".into(), U128(10), U128(quote.total.0 + 1));
}

#[test]
fn buying_moves_goods_to_the_player_and_jade_to_the_merchant() {
    let mut c = setup();
    let quote = c.market_quote(acc("m-auntie-shi.test"), "item:paper-talisman".into(), "buy".into(), U128(2), Some(acc("alice.test")));
    at("alice.test", 0, 0);
    let receipt = c.market_buy(acc("m-auntie-shi.test"), "item:paper-talisman".into(), U128(2), U128(quote.total.0));
    assert_eq!(bal(&c, "alice.test", "item:paper-talisman"), 2);
    assert_eq!(bal(&c, "alice.test", JADE), 50_000 - receipt.total.0);
    assert_eq!(bal(&c, "m-auntie-shi.test", JADE), 300_000 + receipt.total.0 - receipt.tax.0);
}

#[test]
#[should_panic(expected = "OUT_OF_STOCK")]
fn a_merchant_cannot_sell_what_it_does_not_have() {
    let mut c = setup();
    at("alice.test", 0, 0);
    c.market_buy(acc("m-auntie-shi.test"), "item:paper-talisman".into(), U128(13), U128(u128::MAX));
}

#[test]
#[should_panic(expected = "NOT_TRADED")]
fn a_merchant_refuses_goods_it_does_not_deal_in() {
    let mut c = setup();
    at("alice.test", 0, 0);
    c.market_sell(acc("m-lu-yan.test"), "mat:seal-jade-1".into(), U128(1), U128(0));
}

#[test]
fn market_hours_pass_lazily_and_upkeep_is_burned() {
    let mut c = setup();
    let supply = c.mt_supply(JADE.into()).unwrap().0;
    at("anyone.test", 3 * TICK + 5, 0);
    assert_eq!(c.market_tick(), 3);
    assert_eq!(c.market_merchant(acc("m-lu-yan.test")).cash.0, 250_000 - 3 * 250, "three hours of upkeep, seen by the view");
    c.market_advance(vec![acc("m-lu-yan.test")]);
    assert_eq!(bal(&c, "m-lu-yan.test", JADE), 249_250);
    assert_eq!(c.mt_supply(JADE.into()).unwrap().0, supply - 750);
    assert!(get_logs().iter().any(|l| l.contains("mt_burn") && l.contains("m-lu-yan.test")));
}

#[test]
fn caught_up_books_match_the_pricing_module_hour_by_hour() {
    let mut c = setup();
    at("alice.test", 0, 0);
    c.market_sell(acc("m-lu-yan.test"), "mat:essence-ember-1".into(), U128(40), U128(0));
    let m = c.merchants.get(&acc("m-lu-yan.test")).unwrap().clone();
    let mut expected = m.state.clone();
    for tick in 0..30 {
        expected = pricing::tick_merchant(m.def(), &m.goods_info, &expected, tick);
    }
    at("anyone.test", 30 * TICK, 0);
    c.market_advance(vec![acc("m-lu-yan.test")]);
    assert_eq!(c.merchants.get(&acc("m-lu-yan.test")).unwrap().state, expected);
}

#[test]
fn patrons_share_at_most_49_percent_and_at_most_ten_may_invest() {
    let mut c = setup();
    at("minter.test", 0, 0);
    let mints = (0..11).map(|i| MintEntry { account_id: acc(&format!("p{i}.test")), token_id: JADE.into(), amount: U128(200_000) }).collect();
    c.game_mint_batch(mints, 2, None);
    at("p0.test", 0, 0);
    assert_eq!(c.patron_invest(acc("m-lu-yan.test"), U128(150_000)).0, 122_500, "only 49% of a 2,500-jade purse can be owned");
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        at("p1.test", 0, 0);
        c.patron_invest(acc("m-lu-yan.test"), U128(100));
    }));
    assert!(result.is_err(), "no room left for a new patron's stake");
}

#[test]
#[should_panic(expected = "STRATEGY_ALREADY_SET_TODAY")]
fn a_merchant_agent_sets_strategy_once_a_day_within_limits() {
    let mut c = setup();
    at("m-lu-yan.test", TICK, 0);
    c.merchant_set_strategy(vec![("mat:essence-ember-1".into(), 60_000)], Some("ember".into()));
    let m = c.market_merchant(acc("m-lu-yan.test"));
    assert_eq!(m.specialty.as_deref(), Some("ember"));
    assert_eq!(m.goods.iter().find(|g| g.token_id == "mat:essence-ember-1").unwrap().target.0, 192, "clamped to 160% of 120");
    c.merchant_set_strategy(vec![], None);
}

#[test]
#[should_panic(expected = "UNKNOWN_MERCHANT")]
fn only_merchant_accounts_have_strategies() {
    let mut c = setup();
    at("alice.test", 0, 0);
    c.merchant_set_strategy(vec![], None);
}

#[test]
#[should_panic(expected = "PAUSED")]
fn pausing_stops_the_market() {
    let mut c = setup();
    at("owner.test", 0, 0);
    c.set_paused(true);
    at("alice.test", 0, 0);
    c.market_sell(acc("m-lu-yan.test"), "mat:essence-ember-1".into(), U128(1), U128(0));
}

#[test]
#[should_panic(expected = "this merchant does not deal in that good")]
fn merchants_only_hold_goods_they_trade() {
    let mut c = setup();
    at("minter.test", 0, 0);
    c.game_mint_batch(vec![MintEntry { account_id: acc("alice.test"), token_id: "card:palm-strike".into(), amount: U128(1) }], 2, None);
    at("alice.test", 0, 1);
    c.mt_transfer(acc("m-lu-yan.test"), "mat:essence-ember-1".into(), U128(1), None, None);
    assert_eq!(bal(&c, "m-lu-yan.test", "mat:essence-ember-1"), 121, "a gift of a good she trades joins her stock");
    c.mt_transfer(acc("m-lu-yan.test"), "card:palm-strike".into(), U128(1), None, None);
}

#[test]
fn transfer_call_refunds_what_the_receiver_returns() {
    let mut c = setup();
    at("alice.test", 0, 1);
    c.mt_transfer(acc("shop.test"), "mat:essence-ember-1".into(), U128(5), None, None);
    testing_env!(
        VMContextBuilder::new().current_account_id(acc("items.test")).predecessor_account_id(acc("items.test")).build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(serde_json::to_vec(&vec![U128(3)]).unwrap())]
    );
    let kept = c.mt_resolve_transfer(acc("alice.test"), acc("shop.test"), vec!["mat:essence-ember-1".into()], vec![U128(5)]);
    assert_eq!(kept[0].0, 2);
    assert_eq!(bal(&c, "shop.test", "mat:essence-ember-1"), 2);
    assert_eq!(bal(&c, "alice.test", "mat:essence-ember-1"), 58);
}

#[test]
fn metadata_follows_the_nep245_extension() {
    let c = setup();
    assert_eq!(c.mt_metadata_contract()["spec"], "mt-1.0.0");
    let all = c.mt_metadata_token_all(vec![JADE.into(), "mat:essence-ember-1".into()]);
    assert_eq!(all[0]["base"]["decimals"], "2");
    assert_eq!(all[0]["base"]["symbol"], "JADE");
    assert_eq!(all[1]["base"]["base_uri"], "https://ashes.example/");
    assert!(c.mt_token(vec!["nope".into()])[0].is_none());
    assert_eq!(c.mt_token(vec![JADE.into()])[0].as_ref().unwrap().token_id, JADE);
}

// ---------------------------------------------------------------- player listings

#[test]
fn a_listing_escrows_goods_and_a_buyer_pays_the_seller_less_the_ministry_tax() {
    let mut c = setup();
    at("minter.test", 0, 0);
    c.game_mint_batch(vec![MintEntry { account_id: acc("bob.test"), token_id: JADE.into(), amount: U128(10_000) }], 2, None);
    at("alice.test", 1_000, 0);
    let id = c.listing_create("mat:essence-ember-1".into(), U128(10), U128(250));
    assert_eq!(bal(&c, "alice.test", "mat:essence-ember-1"), 50);
    assert_eq!(bal(&c, "items.test", "mat:essence-ember-1"), 10, "held in escrow by the contract");
    assert_eq!(c.listings(None, None).len(), 1);

    at("bob.test", 2_000, 0);
    let r = c.listing_fill(id, U128(4), U128(250));
    assert_eq!(r.total.0, 1_000);
    let tax = 1_000 * pricing::tax_bps(0) as u128 / BPS as u128;
    assert_eq!(r.tax.0, tax);
    assert_eq!(bal(&c, "bob.test", "mat:essence-ember-1"), 4);
    assert_eq!(bal(&c, "bob.test", JADE), 9_000);
    assert_eq!(bal(&c, "alice.test", JADE), 50_000 + 1_000 - tax);
    assert_eq!(bal(&c, "ministry.test", JADE), tax);
    assert_eq!(c.listing(id).unwrap().amount.0, 6, "a partial fill leaves the rest listed");
    assert!(get_logs().iter().any(|l| l.contains("listing #1")));

    c.listing_fill(id, U128(6), U128(300));
    assert!(c.listing(id).is_none(), "a sold-out listing is closed");
    assert!(c.listings(None, None).is_empty());
    assert_eq!(bal(&c, "items.test", "mat:essence-ember-1"), 0);
}

#[test]
#[should_panic(expected = "PRICE_MOVED")]
fn a_buyer_never_pays_more_than_their_limit() {
    let mut c = setup();
    at("alice.test", 0, 0);
    let id = c.listing_create("mat:essence-ember-1".into(), U128(5), U128(300));
    at("bob.test", 0, 0);
    c.listing_fill(id, U128(1), U128(299));
}

#[test]
#[should_panic(expected = "OWN_LISTING")]
fn a_seller_cannot_buy_their_own_listing() {
    let mut c = setup();
    at("alice.test", 0, 0);
    let id = c.listing_create("mat:essence-ember-1".into(), U128(5), U128(300));
    c.listing_fill(id, U128(1), U128(300));
}

#[test]
#[should_panic(expected = "NOT_HELD")]
fn you_can_only_list_what_you_hold() {
    let mut c = setup();
    at("alice.test", 0, 0);
    c.listing_create("mat:essence-ember-1".into(), U128(61), U128(300));
}

#[test]
fn the_seller_cancels_and_the_goods_come_back() {
    let mut c = setup();
    at("alice.test", 0, 0);
    let id = c.listing_create("mat:essence-ember-1".into(), U128(5), U128(300));
    c.listing_cancel(id);
    assert_eq!(bal(&c, "alice.test", "mat:essence-ember-1"), 60);
    assert!(c.listing(id).is_none());
    assert!(c.listings(None, None).is_empty());
}

#[test]
#[should_panic(expected = "NOT_YOURS")]
fn only_the_seller_cancels() {
    let mut c = setup();
    at("alice.test", 0, 0);
    let id = c.listing_create("mat:essence-ember-1".into(), U128(5), U128(300));
    at("bob.test", 0, 0);
    c.listing_cancel(id);
}

#[test]
#[should_panic(expected = "merchants trade through their agents")]
fn merchants_do_not_list() {
    let mut c = setup();
    at("m-lu-yan.test", 0, 0);
    c.listing_create("mat:essence-ember-1".into(), U128(1), U128(300));
}

// ---------------------------------------------------------------- Shop Deeds (NEP-171)

fn with_deeds() -> Contract {
    let mut c = setup();
    at("owner.test", 0, 0);
    let minted = c.deed_mint_all();
    assert_eq!(minted.len(), 2);
    assert_eq!(c.deed_mint_all().len(), 0, "minting twice changes nothing");
    at("minter.test", 0, 0);
    c.game_mint_batch(vec![MintEntry { account_id: acc("bob.test"), token_id: JADE.into(), amount: U128(400_000) }], 2, None);
    c
}

#[test]
fn the_ministry_sells_a_deed_once_and_the_price_becomes_the_shops_capital() {
    let mut c = with_deeds();
    let purse = bal(&c, "m-lu-yan.test", JADE);
    at("alice.test", 1_000, 0);
    let d = c.deed_buy("deed:lu-yan".into(), U128(DEED_PRICE));
    assert_eq!(d.owner, acc("alice.test"));
    assert_eq!(bal(&c, "alice.test", JADE), 50_000 - DEED_PRICE);
    assert_eq!(bal(&c, "m-lu-yan.test", JADE), purse + DEED_PRICE, "paid into the shop's purse");
    let token = c.nft_token("deed:lu-yan".into()).unwrap();
    assert_eq!(token["owner_id"], "alice.test");
    assert_eq!(c.nft_supply_for_owner(acc("alice.test")).0, 1);
    assert_eq!(c.nft_total_supply().0, 2);
    assert!(get_logs().iter().any(|l| l.contains("\"standard\":\"nep171\"") && l.contains("nft_transfer")));
}

#[test]
fn the_holder_earns_the_owners_share_into_the_deeds_vault_and_it_moves_with_the_deed() {
    let mut c = with_deeds();
    at("alice.test", 0, 0);
    c.deed_buy("deed:lu-yan".into(), U128(DEED_PRICE));
    // A busy day: bob buys a lot from Lu Yan, so her day is profitable.
    at("bob.test", 10 * TICK, 0);
    for _ in 0..10 {
        c.market_buy(acc("m-lu-yan.test"), "mat:essence-ember-1".into(), U128(10), U128(400_000));
    }
    at("bob.test", 25 * TICK, 0);
    c.market_advance(vec![acc("m-lu-yan.test")]);
    let vault = c.deeds().iter().find(|d| d["token_id"] == "deed:lu-yan").unwrap()["vault"].as_str().unwrap().parse::<u128>().unwrap();
    assert!(vault > 0, "a profitable day pays the deed");
    assert_eq!(bal(&c, "items.test", JADE), vault, "the vault is held by the contract");

    // Sold to bob with a real wallet transfer: the unclaimed vault goes with it; alice can no longer claim.
    at("alice.test", 26 * TICK, 1);
    c.nft_transfer(acc("bob.test"), "deed:lu-yan".into(), None, None);
    let stolen = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        at("alice.test", 26 * TICK, 0);
        let mut copy = with_deeds();
        copy.deed_claim("deed:lu-yan".into());
    }));
    assert!(stolen.is_err());
    at("bob.test", 26 * TICK, 0);
    let before = bal(&c, "bob.test", JADE);
    let claimed = c.deed_claim("deed:lu-yan".into()).0;
    assert!(claimed >= vault);
    assert_eq!(bal(&c, "bob.test", JADE), before + claimed);
    assert_eq!(bal(&c, "items.test", JADE), 0);
}

#[test]
#[should_panic(expected = "NOT_YOURS")]
fn a_former_holder_cannot_claim() {
    let mut c = with_deeds();
    at("alice.test", 0, 0);
    c.deed_buy("deed:lu-yan".into(), U128(DEED_PRICE));
    at("alice.test", 0, 1);
    c.nft_transfer(acc("bob.test"), "deed:lu-yan".into(), None, None);
    at("alice.test", 0, 0);
    c.deed_claim("deed:lu-yan".into());
}

#[test]
fn a_holder_who_runs_the_shop_overrules_the_agent_and_can_hand_it_back() {
    let mut c = with_deeds();
    at("alice.test", 0, 0);
    c.deed_buy("deed:lu-yan".into(), U128(DEED_PRICE));
    c.deed_appoint_agent("deed:lu-yan".into(), false);
    let agent = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let mut copy = with_deeds();
        at("alice.test", 0, 0);
        copy.deed_buy("deed:lu-yan".into(), U128(DEED_PRICE));
        copy.deed_appoint_agent("deed:lu-yan".into(), false);
        at("m-lu-yan.test", 0, 0);
        copy.merchant_set_strategy(vec![("mat:essence-ember-1".into(), 12_000)], None);
    }));
    assert!(agent.is_err(), "the agent may not decide while the holder runs the shop");
    at("alice.test", 0, 0);
    c.deed_set_strategy("deed:lu-yan".into(), vec![("mat:essence-ember-1".into(), 13_000)], Some("ember".into()));
    let books = c.market_merchant(acc("m-lu-yan.test"));
    assert_eq!(books.specialty.as_deref(), Some("ember"));
}

#[test]
fn a_holder_resells_at_their_price_and_the_ministry_takes_its_tax() {
    let mut c = with_deeds();
    at("alice.test", 0, 0);
    c.deed_buy("deed:lu-yan".into(), U128(DEED_PRICE));
    c.deed_list("deed:lu-yan".into(), Some(U128(30_000)));
    let alice = bal(&c, "alice.test", JADE);
    at("bob.test", 0, 0);
    c.deed_buy("deed:lu-yan".into(), U128(30_000));
    let tax = 30_000 * pricing::tax_bps(0) as u128 / BPS as u128;
    assert_eq!(bal(&c, "alice.test", JADE), alice + 30_000 - tax);
    assert_eq!(c.nft_token("deed:lu-yan".into()).unwrap()["owner_id"], "bob.test");
}

#[test]
#[should_panic(expected = "NOT_FOR_SALE")]
fn an_unlisted_deed_cannot_be_bought_from_its_holder() {
    let mut c = with_deeds();
    at("alice.test", 0, 0);
    c.deed_buy("deed:lu-yan".into(), U128(DEED_PRICE));
    at("bob.test", 0, 0);
    c.deed_buy("deed:lu-yan".into(), U128(1_000_000));
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn the_standard_transfer_needs_one_yocto() {
    let mut c = with_deeds();
    at("alice.test", 0, 0);
    c.deed_buy("deed:lu-yan".into(), U128(DEED_PRICE));
    c.nft_transfer(acc("bob.test"), "deed:lu-yan".into(), None, None);
}
