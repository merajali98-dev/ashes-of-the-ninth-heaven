//! Replays the recorded JavaScript market week (`tests/fixtures/market-trace.json`, written by
//! `scripts/gen-market-trace.mjs`) through the contract's pricing module. Every quote's result, total and tax, and
//! every daily snapshot of every merchant's books, must match the JavaScript rules file exactly.
use items::pricing::{self, MarketState, TokenInfo};
use items::rules_gen::MERCHANTS;
use near_sdk::serde_json::{self, Value};
use std::collections::HashMap;

fn fixture() -> Value {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../tests/fixtures/market-trace.json");
    serde_json::from_str(&std::fs::read_to_string(path).expect("fixture missing: run node scripts/gen-market-trace.mjs")).unwrap()
}

fn token_of(v: &Value) -> TokenInfo {
    TokenInfo {
        id: v["id"].as_str().unwrap().to_string(),
        family: v["family"].as_str().unwrap().to_string(),
        school: v["school"].as_str().map(str::to_string),
        tier: v["tier"].as_u64().unwrap_or(0) as u8,
        consumable: v["kind"] == "consumable",
        base: v["base"].as_i64().unwrap(),
    }
}

struct Book {
    goods: Vec<TokenInfo>,
    state: MarketState,
}

fn get(map: &Value, id: &str) -> i64 {
    map.get(id).and_then(Value::as_i64).unwrap_or(0)
}

#[test]
fn the_contract_prices_every_recorded_trade_exactly_like_the_rules_file() {
    let fixture = fixture();
    let ops = fixture["ops"].as_array().unwrap();
    let genesis = &ops[0];
    assert_eq!(genesis["op"], "genesis");
    let all: Vec<TokenInfo> = genesis["tokens"].as_array().unwrap().iter().map(token_of).collect();
    let ids: Vec<&str> = genesis["merchants"].as_array().unwrap().iter().map(|v| v.as_str().unwrap()).collect();
    assert_eq!(ids, MERCHANTS.iter().map(|m| m.id).collect::<Vec<_>>(), "merchant roster matches the rules file");

    let mut books: HashMap<&str, Book> = HashMap::new();
    for def in MERCHANTS.iter() {
        let (goods, state) = pricing::opening_state(def, &all);
        books.insert(def.id, Book { goods: goods.iter().map(|&i| all[i].clone()).collect(), state });
    }

    let (mut trades, mut checks, mut refusals) = (0, 0, 0);
    for (step, op) in ops.iter().enumerate() {
        match op["op"].as_str().unwrap() {
            "trade" => {
                let m = op["m"].as_str().unwrap();
                let def = pricing::merchant_def(m).unwrap();
                let book = books.get_mut(m).unwrap();
                let token_id = op["token"].as_str().unwrap();
                let index = book.goods.iter().position(|t| t.id == token_id);
                let token = all.iter().find(|t| t.id == token_id).unwrap();
                let sell = op["side"] == "sell";
                let qty = op["qty"].as_i64().unwrap() as i128;
                let q = pricing::quote(def, token, &book.state, index, sell, qty, op["tick"].as_u64().unwrap(),
                    op["rep"].as_i64().unwrap() as i128, op["testimony"].as_i64().unwrap() as i128);
                assert_eq!(q.code, op["code"].as_str().unwrap(), "step {step}: result code");
                assert_eq!(q.total, op["total"].as_i64().unwrap() as i128, "step {step}: total");
                assert_eq!(q.tax_paid, op["taxPaid"].as_i64().unwrap() as i128, "step {step}: tax");
                if q.ok() {
                    pricing::apply_quote(&mut book.state, index.unwrap(), sell, qty, q.total, q.tax_paid);
                } else {
                    refusals += 1;
                }
                trades += 1;
            }
            "tick" => {
                let m = op["m"].as_str().unwrap();
                let def = pricing::merchant_def(m).unwrap();
                let book = books.get_mut(m).unwrap();
                book.state = pricing::tick_merchant(def, &book.goods, &book.state, op["tick"].as_u64().unwrap());
            }
            "adjust" => {
                let book = books.get_mut(op["m"].as_str().unwrap()).unwrap();
                book.state.cash += op["cash"].as_i64().unwrap_or(0);
                for (field, deltas) in [("stock", &op["stock"]), ("flow", &op["flow"])] {
                    if let Some(map) = deltas.as_object() {
                        for (id, delta) in map {
                            let i = book.goods.iter().position(|t| &t.id == id).unwrap();
                            let v = if field == "stock" { &mut book.state.stock[i] } else { &mut book.state.flow[i] };
                            *v += delta.as_i64().unwrap();
                        }
                    }
                }
            }
            "check" => {
                for (m, expected) in op["markets"].as_object().unwrap() {
                    let book = &books[m.as_str()];
                    let tick = op["tick"].as_u64().unwrap();
                    assert_eq!(book.state.cash, expected["cash"].as_i64().unwrap(), "tick {tick}: {m} cash");
                    assert_eq!(book.state.closed, expected["closed"].as_bool().unwrap(), "tick {tick}: {m} closed");
                    assert_eq!(book.state.specialty.as_deref(), expected["specialty"].as_str(), "tick {tick}: {m} specialty");
                    for (i, token) in book.goods.iter().enumerate() {
                        assert_eq!(book.state.stock[i], get(&expected["stock"], &token.id), "tick {tick}: {m} stock {}", token.id);
                        assert_eq!(book.state.target[i], get(&expected["target"], &token.id), "tick {tick}: {m} target {}", token.id);
                        assert_eq!(book.state.base_target[i], get(&expected["baseTarget"], &token.id), "tick {tick}: {m} base {}", token.id);
                        assert_eq!(book.state.flow[i], get(&expected["flow"], &token.id), "tick {tick}: {m} flow {}", token.id);
                    }
                }
                checks += 1;
            }
            "genesis" => {}
            other => panic!("unknown op {other}"),
        }
    }
    assert_eq!(checks, 7);
    assert!(trades > 1_000 && refusals > 100, "trades {trades}, refusals {refusals}");
}
