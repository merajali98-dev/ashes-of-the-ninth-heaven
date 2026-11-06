import test from 'node:test';
import assert from 'node:assert/strict';
import {PURCHASE_PACKS,purchasePack,formatUsd,validTokenAmount,createPaymentAdapter} from '../js/payments.js';
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}};
function harness() {
  let clock=1000000;const calls=[];
  const quote={id:'quote-1',packId:'jade-pouch',priceCents:100,currency:'jade',amount:100,expiresAt:clock+60000,
    payment:{network:'eip155:8453',asset:'USDC',tokenAmount:'1.000000',decimals:6,recipient:'recipient-test-only'}};
  const order={id:'order-1',quoteId:quote.id,packId:quote.packId,idempotencyKey:'key-1',status:'awaiting_payment'};
  const session={account:'account-test-only',network:quote.payment.network};
  const receipt={ledgerId:'ledger-1',orderId:order.id,currency:'jade',amount:100,settledAt:clock};
  const backend={
    quote:async value=>{calls.push(['quote',value]);return structuredClone(quote)},
    createOrder:async value=>{calls.push(['order',value]);return structuredClone(order)},
    getOrder:async value=>{calls.push(['status',value]);return structuredClone(order)},
    submitTransaction:async value=>{calls.push(['submit',value]);return{...order,status:'submitted'}},
  };
  const wallet={connect:async()=>{calls.push(['connect']);return{...session}},getSession:async()=>({...session}),sendPayment:async value=>{calls.push(['send',value]);return{transactionId:'tx-1'}},disconnect:async()=>calls.push(['disconnect'])};
  const create=()=>createPaymentAdapter({enabled:true,backend,wallet,now:()=>clock});
  const prepare=async adapter=>{assert.equal((await adapter.quote('jade-pouch')).ok,true);assert.equal((await adapter.createOrder({quoteId:'quote-1',idempotencyKey:'key-1'})).ok,true);};
  return{calls,quote,order,session,receipt,backend,wallet,create,prepare,advance:value=>clock+=value};
}
test('future checkout is disabled without explicit complete dependencies and performs no calls',async()=>{
  const h=harness();for(const adapter of [createPaymentAdapter(),createPaymentAdapter({backend:h.backend,wallet:h.wallet}),createPaymentAdapter({enabled:true,backend:h.backend,wallet:{...h.wallet,getSession:null}})]) {
    assert.equal(adapter.getState().available,false);
    for(const result of [await adapter.quote('jade-pouch'),await adapter.createOrder(),await adapter.createOrder(null),await adapter.createOrder('bad'),await adapter.connectWallet(),await adapter.submitPayment(),await adapter.refreshOrder()])assert.equal(result.ok,false);
    adapter.cancel();await adapter.disconnect();assert.equal(adapter.getState().wallet,null);
  }assert.equal(h.calls.length,0);
});
test('transparent proposed packs preserve integer cents and a constant rate without bulk incentives',()=>{
  assert.equal(PURCHASE_PACKS.filter(item=>item.currency==='jade').length,5);
  for(const item of PURCHASE_PACKS){assert.equal(item.proposed,true);assert.equal(item.amount,item.priceCents);assert.equal(purchasePack(item.id),item);assert.equal(item.usdLabel,formatUsd(item.priceCents));}
  assert.equal(purchasePack('__proto__'),null);assert.equal(formatUsd(123),'$1.23');
  for(const value of [-1,.1,NaN,Infinity,'100'])assert.throws(()=>formatUsd(value));
  assert.ok(Object.isFrozen(PURCHASE_PACKS)&&PURCHASE_PACKS.every(Object.isFrozen));
});
test('token quantities use bounded decimal strings and reject floating-point/exponent/zero payments',()=>{
  for(const [amount,decimals] of [['1',0],['0.000001',6],['100.00',2]])assert.equal(validTokenAmount(amount,decimals),true);
  for(const [amount,decimals] of [[1,6],['1e6',6],['-1',6],['0',6],['0.0',6],['01',6],['.1',6],['1.',6],['1.001',2],['1',37],['1',-1],['9'.repeat(80),6]])assert.equal(validTokenAmount(amount,decimals),false);
});
test('a transaction broadcast never fulfills an order; only a matching server ledger receipt can do so',async()=>{
  const h=harness(),adapter=h.create();await h.prepare(adapter);assert.equal((await adapter.connectWallet()).ok,true);
  assert.equal((await adapter.submitPayment()).ok,true);assert.equal(adapter.getState().order.status,'submitted');assert.equal(adapter.getState().order.receipt,undefined);
  h.order.status='fulfilled';assert.equal((await adapter.refreshOrder()).ok,false,'missing receipt rejected');
  assert.equal(adapter.getState().order.status,'submitted');h.order.receipt={...h.receipt,amount:101};assert.equal((await adapter.refreshOrder()).ok,false);
  h.order.receipt=h.receipt;assert.equal((await adapter.refreshOrder()).ok,true);assert.equal(adapter.getState().order.receipt.ledgerId,'ledger-1');
  const copy=adapter.getState();copy.order.receipt.amount=999;assert.equal(adapter.getState().order.receipt.amount,100);
  h.order.status='awaiting_payment';assert.equal((await adapter.refreshOrder()).ok,false,'terminal state cannot regress');
});
test('quote values, lifetime, and order binding are validated before any wallet send',async()=>{
  for(const mutate of [q=>q.priceCents=1,q=>q.amount=999,q=>q.currency='star-silk',q=>q.expiresAt=1000000,q=>q.expiresAt=1000000+900001,q=>q.payment.tokenAmount='1e3',q=>q.payment.recipient='',q=>q.packId='silk-spool']) {
    const h=harness();mutate(h.quote);assert.equal((await h.create().quote('jade-pouch')).ok,false);assert.equal(h.calls.some(([type])=>type==='send'),false);
  }
  const h=harness(),adapter=h.create();await adapter.quote('jade-pouch');h.order.quoteId='other';assert.equal((await adapter.createOrder({quoteId:'quote-1',idempotencyKey:'key-1'})).ok,false);
  assert.equal(adapter.getState().order,null);
});
test('create retries use the original idempotency key, including after ambiguous backend failure',async()=>{
  const h=harness(),adapter=h.create();await adapter.quote('jade-pouch');const create=h.backend.createOrder;h.backend.createOrder=async()=>{throw new Error('transport')};
  assert.equal((await adapter.createOrder({quoteId:'quote-1',idempotencyKey:'key-1'})).ok,false);
  assert.equal((await adapter.createOrder({quoteId:'quote-1',idempotencyKey:'key-2'})).ok,false);
  h.backend.createOrder=create;assert.equal((await adapter.createOrder({quoteId:'quote-1',idempotencyKey:'key-1'})).ok,true);
  assert.equal((await adapter.createOrder({quoteId:'quote-1',idempotencyKey:'key-1'})).ok,true);
  assert.equal(h.calls.filter(([type])=>type==='order').length,1);
});
test('cancelled async quotes cannot overwrite a later checkout and concurrent actions are rejected',async()=>{
  const h=harness(),adapter=h.create(),pending=deferred();h.backend.quote=()=>pending.promise;
  const result=adapter.quote('jade-pouch');assert.equal((await adapter.quote('jade-pouch')).ok,false);
  adapter.cancel();h.backend.quote=async()=>h.quote;assert.equal((await adapter.quote('jade-pouch')).ok,true);
  pending.resolve({...h.quote,id:'stale'});assert.equal((await result).ok,false);assert.equal(adapter.getState().quote.id,'quote-1');
});
test('account/network changes and quote expiry prevent sending; invalidation preserves reconciliation order',async()=>{
  const h=harness(),adapter=h.create();await h.prepare(adapter);await adapter.connectWallet();h.session.network='eip155:1';
  assert.equal((await adapter.submitPayment()).ok,false);assert.equal(adapter.getState().wallet,null);assert.equal(h.calls.filter(([type])=>type==='send').length,0);
  h.session.network=h.quote.payment.network;await adapter.connectWallet();h.advance(60001);assert.equal((await adapter.submitPayment()).ok,false);
  adapter.invalidateWallet();assert.equal(adapter.getState().wallet,null);assert.equal(adapter.getState().order.id,'order-1');
});
test('ambiguous wallet sends and cancellation never permit automatic double payment',async()=>{
  const h=harness(),adapter=h.create(),pending=deferred();await h.prepare(adapter);await adapter.connectWallet();h.wallet.sendPayment=()=>{h.calls.push(['send']);return pending.promise};
  const sending=adapter.submitPayment();await new Promise(resolve=>setTimeout(resolve,0));adapter.cancel();pending.resolve({transactionId:'tx-1'});
  assert.equal((await sending).ok,false);assert.equal((await adapter.submitPayment()).ok,false);assert.equal(h.calls.filter(([type])=>type==='send').length,1);
  assert.equal((await adapter.refreshOrder()).ok,true);
});
test('a failed transaction notification retains the broadcast reference and never sends again',async()=>{
  const h=harness(),adapter=h.create();await h.prepare(adapter);await adapter.connectWallet();h.backend.submitTransaction=async()=>{throw new Error('offline')};
  assert.equal((await adapter.submitPayment()).ok,false);assert.equal(adapter.getState().transactionId,'tx-1');assert.equal((await adapter.submitPayment()).ok,false);
  assert.equal(h.calls.filter(([type])=>type==='send').length,1);
});
test('provider disconnect is serialized and callback-style cancellation does not need a receiver',async()=>{
  const h=harness(),adapter=h.create(),pending=deferred();await h.prepare(adapter);await adapter.connectWallet();
  h.wallet.disconnect=()=>pending.promise;const {disconnect,invalidateWallet,cancel}=adapter;
  const disconnecting=disconnect();cancel();invalidateWallet();assert.equal((await adapter.connectWallet()).ok,false);
  pending.resolve();assert.equal((await disconnecting).ok,true);assert.equal((await adapter.connectWallet()).ok,true);
});
