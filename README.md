# BudgetSMS Node.js client

Official Node.js client for the [BudgetSMS HTTP API](https://www.budgetsms.net/sms-http-api/): send SMS to 900+ operators worldwide, test calls without sending, check your credit, look up the network of a number (NP and HLR), fetch delivery statuses and your pricing.

- Node.js 18 or newer, no dependencies (built-in `fetch`)
- ES module with TypeScript types

## Install

```bash
npm install budgetsms
```

## Use

```js
import { BudgetSms, BudgetSmsError } from 'budgetsms';

const sms = new BudgetSms({ username: 'USERNAME', userid: 'USERID', handle: 'HANDLE' });   // control panel, API details

try {
  const result = await sms.sendSms('31612345678', 'Your verification code is 482913', 'MyCompany');
  console.log(`sent, message id ${result.smsId}, price ${result.price} for ${result.parts} part(s), credit left ${result.credit}`);
} catch (e) {
  if (e instanceof BudgetSmsError) console.log(e.code, e.message);   // "1001", "BudgetSMS error 1001: Not enough credit"
  else throw e;
}
```

While developing, use `testSms()` with the same arguments. It is a simulator: your credentials are checked and the result has the same shape, but nothing is sent or charged, the message id and price are random, and about one in five calls rejects with a random `2xxx` error so you can test your error handling. Real prices come from `pricing()`.

```js
const test = await sms.testSms('31612345678', 'Hello', 'MyCompany');

const credit = await sms.checkCredit();              // 123.455

const network = await sms.np('31612345678');         // { mcc: '204', mnc: '08', mccmnc: '20408', price: 0.064 }

const hlr = await sms.hlr('31612345678', 3);         // like np, plus reachability; a cached result up to 3 days old costs half

const status = await sms.dlrStatus(result.smsId);    // 1 = delivered, see https://www.budgetsms.net/sms-http-api/dlr-status/

for (const [operatorId, row] of Object.entries(await sms.pricing())) {
  console.log(row.countryname, row.operatorname, row.price);
}
```

Numbers are written in international format without a leading `+` or `00`: `31612345678`. The sender is an alphanumeric name of at most 11 characters or a number of at most 16 digits; some countries require registration of alphanumeric senders, see the country pages on [budgetsms.net](https://www.budgetsms.net/sms-gateway-pricing/).

## Delivery reports

Prefer [Push DLR](https://www.budgetsms.net/sms-http-api/push-dlr/): enter a URL in the control panel and BudgetSMS calls it with `id`, `status` and `date` on every status change. With Express:

```js
app.get('/dlr', (req, res) => {
  const { id, status, date } = req.query;   // status 1 = delivered
  res.send('OK');
});
```

## License

MIT
