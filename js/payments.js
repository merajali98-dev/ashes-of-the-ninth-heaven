// Future payment boundary. No provider discovery, network requests, storage, or
// currency mutation happens in this module. Production is intentionally disabled.
const pack=(id,name,currency,amount,priceCents)=>Object.freeze({id,name,currency,amount,priceCents,usdLabel:formatUsd(priceCents),proposed:true});
export function formatUsd(cents) {
  if(!Number.isSafeInteger(cents)||cents<0)throw new TypeError('USD prices require nonnegative integer cents');
  return '$'+Math.floor(cents/100)+'.'+String(cents%100).padStart(2,'0');
}
export const PURCHASE_PACKS=Object.freeze([
  pack('jade-pouch','Jade Pouch','jade',100,100),
  pack('jade-casket','Jade Casket','jade',500,500),
  pack('jade-coffer','Jade Coffer','jade',1000,1000),
  pack('jade-vault','Jade Vault','jade',2500,2500),
  pack('jade-treasury','Jade Treasury','jade',5000,5000),
  pack('silk-spool','Star Silk Spool','star-silk',100,100),
  pack('silk-bolt','Star Silk Bolt','star-silk',500,500),
  pack('silk-chest','Star Silk Chest','star-silk',1000,1000),
]);
export const purchasePack=id=>PURCHASE_PACKS.find(item=>item.id===id)||null;
const clone=value=>value===null?null:JSON.parse(JSON.stringify(value));
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
const text=value=>typeof value==='string'&&value.length>=1&&value.length<=256&&!/[\s\x00-\x1f<>]/.test(value);
const statuses=new Set(['awaiting_payment','submitted','confirming','fulfilled','expired','cancelled','failed','refund_pending','refunded']);
const transitions={
  awaiting_payment:new Set(['awaiting_payment','submitted','confirming','fulfilled','expired','cancelled','failed']),
  submitted:new Set(['submitted','confirming','fulfilled','expired','failed']),
  confirming:new Set(['confirming','fulfilled','expired','failed']),
  fulfilled:new Set(['fulfilled','refund_pending','refunded']),
  refund_pending:new Set(['refund_pending','refunded','fulfilled']),
  refunded:new Set(['refunded']),expired:new Set(['expired']),cancelled:new Set(['cancelled']),failed:new Set(['failed']),
};
export function validTokenAmount(value,decimals) {
  if(!Number.isSafeInteger(decimals)||decimals<0||decimals>36||typeof value!=='string'||value.length>79)return false;
  if(!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value))return false;
  return (value.split('.')[1]?.length||0)<=decimals&&/[1-9]/.test(value);
}
function validPayment(value) {
  return plain(value)&&typeof value.network==='string'&&/^[a-z0-9-]{3,8}:[A-Za-z0-9_-]{1,64}$/.test(value.network)&&
    text(value.asset)&&text(value.recipient)&&validTokenAmount(value.tokenAmount,value.decimals);
}
function validQuote(value,now) {
  const item=purchasePack(value?.packId);
  return plain(value)&&identifier(value.id)&&item&&value.priceCents===item.priceCents&&value.currency===item.currency&&
    value.amount===item.amount&&Number.isSafeInteger(value.expiresAt)&&value.expiresAt>now&&value.expiresAt<=now+15*60*1000&&validPayment(value.payment);
}
function validReceipt(value,order,quote) {
  return plain(value)&&identifier(value.ledgerId)&&value.orderId===order.id&&value.currency===quote.currency&&
    value.amount===quote.amount&&Number.isSafeInteger(value.settledAt)&&value.settledAt>=0;
}
function validOrder(value,quote,key,previous) {
  return plain(value)&&identifier(value.id)&&value.quoteId===quote.id&&value.packId===quote.packId&&
    value.idempotencyKey===key&&statuses.has(value.status)&&(!previous||value.id===previous.id&&transitions[previous.status].has(value.status))&&
    (!['fulfilled','refund_pending','refunded'].includes(value.status)||validReceipt(value.receipt,value,quote));
}
function cleanQuote(value) {
  const {id,packId,priceCents,currency,amount,expiresAt}=value;
  const {network,asset,tokenAmount,decimals,recipient}=value.payment;
  return {id,packId,priceCents,currency,amount,expiresAt,payment:{network,asset,tokenAmount,decimals,recipient}};
}
function cleanOrder(value) {
  const result={id:value.id,quoteId:value.quoteId,packId:value.packId,idempotencyKey:value.idempotencyKey,status:value.status};
  if(value.receipt)result.receipt={ledgerId:value.receipt.ledgerId,orderId:value.receipt.orderId,currency:value.receipt.currency,amount:value.receipt.amount,settledAt:value.receipt.settledAt};
  return result;
}

/**
 * backend: quote({packId,signal}), createOrder({quoteId,idempotencyKey,signal}),
 *          getOrder({orderId,signal}), submitTransaction({orderId,transactionId,signal}).
 * wallet: connect({signal}) -> {account,network}, getSession({signal}), sendPayment({account,payment,signal})
 *         -> {transactionId}, disconnect(). Never requests seed phrases or approvals.
 * Implementations are injected only after authenticated server settlement exists.
 */
export function createPaymentAdapter({enabled=false,backend,wallet,now=()=>Date.now()}={}) {
  const configured=enabled===true&&['quote','createOrder','getOrder','submitTransaction'].every(method=>typeof backend?.[method]==='function')&&
    ['connect','getSession','sendPayment','disconnect'].every(method=>typeof wallet?.[method]==='function');
  let state={available:configured,stage:configured?'idle':'unavailable',wallet:null,quote:null,order:null,transactionId:null,error:null};
  let epoch=0,busy=false,disconnecting=false,controller=null;
  const orders=new Map(),quoteKeys=new Map(),attemptedPayments=new Set();
  const getState=()=>clone(state);
  const fail=reason=>({ok:false,reason,state:getState()});
  async function run(operation) {
    if(!configured)return fail('Wallet purchases are not available yet.');
    if(busy||disconnecting)return fail('Another payment action is already in progress.');
    const revision=epoch;busy=true;controller=new AbortController();const signal=controller.signal;
    state.error=null;
    try {
      const result=await operation(signal,()=>revision===epoch&&!signal.aborted);
      if(revision!==epoch||signal.aborted)return fail('The payment action was cancelled.');
      return result||{ok:true,state:getState()};
    }catch(error) {
      if(revision!==epoch||signal.aborted)return fail('The payment action was cancelled.');
      state.error='The payment service could not complete this action. Check order status before retrying.';
      return fail(state.error);
    }finally{if(revision===epoch){busy=false;controller=null}}
  }
  function acceptOrder(value,key) {
    if(!validOrder(value,state.quote,key,state.order))throw new Error('Invalid order response');
    state.order=cleanOrder(value);state.stage=value.status;
    orders.set(key,{quote:clone(state.quote),order:clone(state.order)});
  }
  function cancel() {
    epoch++;controller?.abort();controller=null;busy=false;state.error=null;
    // Cancels local work only. An existing chain transfer/order is still real.
    state.stage=state.order?.status||(configured?'idle':'unavailable');
    return {ok:true,state:getState()};
  }
  return Object.freeze({
    getState,
    quote(packId) {
      return run(async(signal,current)=>{
        if(!purchasePack(packId))return fail('Choose a valid currency pack.');
        if(state.order&&!['expired','cancelled','failed','refunded','fulfilled'].includes(state.order.status))return fail('Resolve the current order before requesting another quote.');
        const value=await backend.quote({packId,signal});if(!current())return;
        if(!validQuote(value,now())||value.packId!==packId)throw new Error('Invalid quote response');
        state={...state,stage:'quote_ready',quote:cleanQuote(value),order:null,transactionId:null};
      });
    },
    createOrder(options={}) {
      return run(async(signal,current)=>{
        const {quoteId,idempotencyKey}=plain(options)?options:{};
        if(!identifier(idempotencyKey)||quoteId!==state.quote?.id)return fail('A valid quote and stable order key are required.');
        if(quoteKeys.has(quoteId)&&quoteKeys.get(quoteId)!==idempotencyKey)return fail('Retry this quote with its original order key.');
        const cached=orders.get(idempotencyKey);
        if(cached) {
          if(cached.quote.id!==quoteId)return fail('This order key belongs to a different quote.');
          state.quote=clone(cached.quote);state.order=clone(cached.order);state.stage=state.order.status;return;
        }
        if(state.order)return fail('An order already exists for this quote.');
        if(state.quote.expiresAt<=now())return fail('This quote expired. Request a new price.');
        quoteKeys.set(quoteId,idempotencyKey);
        const value=await backend.createOrder({quoteId,idempotencyKey,signal});if(!current())return;
        acceptOrder(value,idempotencyKey);
      });
    },
    connectWallet() {
      return run(async(signal,current)=>{
        if(!state.order||state.order.status!=='awaiting_payment')return fail('Review and create an order first.');
        const value=await wallet.connect({signal});if(!current())return;
        if(!plain(value)||!text(value.account)||value.network!==state.quote.payment.network)return fail('Select the network shown in the order.');
        state.wallet={account:value.account,network:value.network};
      });
    },
    submitPayment() {
      return run(async(signal,current)=>{
        if(!state.wallet||state.order?.status!=='awaiting_payment')return fail('An unpaid order and matching wallet are required.');
        if(state.transactionId||attemptedPayments.has(state.order.id))return fail('Payment was already attempted. Refresh its status; do not send again.');
        if(state.quote.expiresAt<=now())return fail('This quote expired. Do not send payment.');
        const session=await wallet.getSession({signal});if(!current())return;
        if(session?.account!==state.wallet.account||session?.network!==state.quote.payment.network){state.wallet=null;return fail('Wallet account or network changed. Review the order and reconnect.');}
        if(state.quote.expiresAt<=now())return fail('This quote expired. Do not send payment.');
        // Wallet cancellation/transport errors can occur after broadcast. Refuse
        // a second send even if the first result never reaches this page.
        attemptedPayments.add(state.order.id);
        const value=await wallet.sendPayment({account:state.wallet.account,payment:clone(state.quote.payment),signal});if(!current())return;
        if(!identifier(value?.transactionId))throw new Error('Invalid transaction identifier');
        // A broadcast is not settlement. Retain its identifier even if notification
        // fails so this session never sends the same order a second time.
        state.transactionId=value.transactionId;state.stage='submitted';
        const order=await backend.submitTransaction({orderId:state.order.id,transactionId:value.transactionId,signal});if(!current())return;
        if(order?.status==='awaiting_payment')throw new Error('Notification not recorded');
        acceptOrder(order,state.order.idempotencyKey);
      });
    },
    refreshOrder() {
      return run(async(signal,current)=>{
        if(!state.order)return fail('There is no order to check.');
        const value=await backend.getOrder({orderId:state.order.id,signal});if(!current())return;
        acceptOrder(value,state.order.idempotencyKey);
      });
    },
    cancel,
    invalidateWallet() {
      cancel();state.wallet=null;
      return {ok:true,state:getState()};
    },
    async disconnect() {
      if(disconnecting)return fail('Wallet disconnection is already in progress.');
      cancel();state.wallet=null;
      if(configured){disconnecting=true;try{await wallet.disconnect()}catch{}finally{disconnecting=false}}
      return {ok:true,state:getState()};
    },
  });
}
