const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('currency formatting changes presentation only', async () => {
 const store = new Map(); global.localStorage = { getItem:key=>store.get(key), setItem:(key,value)=>store.set(key,value) };
 const source=fs.readFileSync(require('node:path').join(__dirname,'../src/currency.js'),'utf8');
 const money=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.equal(money.getDisplayCurrency(),'ZAR'); assert.match(money.formatMoney(1234.56),/^R/);
 const amount=1234.56; money.saveDisplayCurrency('LSL');
 assert.equal(money.formatMoney(amount),'M 1,234.56'); assert.equal(amount,1234.56);
 assert.equal(money.formatMoney(-20),'M -20.00'); assert.equal(money.formatMoney(0),'M 0.00');
 assert.equal(store.get(money.CURRENCY_KEY),'LSL'); money.saveDisplayCurrency('USD'); assert.equal(money.getDisplayCurrency(),'LSL');
 money.saveDisplayCurrency('ZAR');assert.match(money.formatMoney(amount),/^R/);assert.equal(money.formatMoney(NaN),'—');
});
