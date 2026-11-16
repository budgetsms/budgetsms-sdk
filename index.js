/**
 * Client for the BudgetSMS HTTP API (https://www.budgetsms.net/sms-http-api/).
 * Every call is one HTTPS GET request answered with "OK <result>" or "ERR <code>"; this client returns typed values
 * and throws a BudgetSmsError with the error code on "ERR". Node.js 18 or newer (built-in fetch).
 */

export const ERROR_MESSAGES = {
  1001: 'Not enough credit', 1002: 'Wrong credentials', 1003: 'Account not active', 1004: 'IP address not allowed for this account',
  1005: 'No handle provided', 1006: 'No userid provided', 1007: 'No username provided',
  2001: 'Message text is empty', 2002: 'Numeric sender id longer than 16 digits', 2003: 'Alphanumeric sender id longer than 11 characters',
  2004: 'Sender id empty or invalid', 2005: 'Destination number too short', 2006: 'Destination not numeric', 2007: 'Destination empty',
  2008: 'Message text not OK (encoding)', 2009: 'Parameter issue', 2010: 'Destination formatted invalidly', 2011: 'Destination invalid',
  2012: 'Message text too long', 2013: 'Message invalid', 2014: 'Custom id used before', 2015: 'Charset problem', 2016: 'Invalid UTF-8',
  2017: 'Invalid sms id', 3001: 'No route to destination', 3002: 'No routes set up', 3003: 'Invalid destination',
  4001: 'System error related to custom id', 4002: 'Temporary system error, retry in a few minutes', 4003: 'Lookup failed at the carrier, nothing charged',
  4004: 'Temporary system error', 4005: 'Permanent system error', 4006: 'Gateway not reachable', 4007: 'System error',
  5001: 'Send error', 5002: 'Wrong SMS type', 5003: 'Wrong operator', 6001: 'Unknown error',
  7001: 'No HLR provider present', 7002: 'Unexpected result from HLR provider', 7003: 'Bad number format',
  7901: 'Unexpected error', 7902: 'HLR provider error', 7903: 'HLR provider error',
};

/** Thrown when the API answers "ERR <code>" (code in .code) or cannot be reached (code "transport"). */
export class BudgetSmsError extends Error {
  constructor(code, message) {
    super(message || `BudgetSMS error ${code}${ERROR_MESSAGES[code] ? ': ' + ERROR_MESSAGES[code] : ''}`);
    this.name = 'BudgetSmsError';
    this.code = String(code);
  }
}

export class BudgetSms {
  static DEFAULT_BASE_URL = 'https://api.budgetsms.net/';

  /**
   * @param {{username: string, userid: string|number, handle: string, baseUrl?: string, timeoutMs?: number}} options
   */
  constructor({ username, userid, handle, baseUrl = BudgetSms.DEFAULT_BASE_URL, timeoutMs = 20000 }) {
    if (!username || !userid || !handle) throw new Error('username, userid and handle are required');
    this.auth = { username, userid: String(userid), handle };
    this.baseUrl = baseUrl.replace(/\/?$/, '/');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Sends an SMS. Receiver in international format without + or 00 (31612345678); sender an alphanumeric name of at
   * most 11 characters or a number of at most 16 digits.
   * @returns {Promise<{smsId: number, price: number|null, parts: number|null, mccmnc: string|null, credit: number|null}>}
   */
  sendSms(to, message, from, options = {}) {
    return this.#submit('sendsms', to, message, from, options);
  }

  /**
   * Simulator for sendSms: same parameters and result shape, no SMS is sent and nothing is charged. The API checks your
   * credentials and returns a random message id and price; about one in five calls rejects with a random 2xxx
   * BudgetSmsError on purpose so error handling can be tested. The destination is not validated.
   */
  testSms(to, message, from, options = {}) {
    return this.#submit('testsms', to, message, from, options);
  }

  /** Current credit of the account in euro. */
  async checkCredit() {
    return parseFloat(await this.call('checkcredit'));
  }

  /** Number portability lookup: the network a number currently belongs to, also when ported. Charged at your NP price. */
  async np(number) {
    return BudgetSms.#lookup(await this.call('np', { to: number }));
  }

  /** HLR lookup: like np, and also whether the handset is reachable. A cached result (at most cacheDays old, 0-7) costs half. */
  async hlr(number, cacheDays = 0) {
    return BudgetSms.#lookup(await this.call('hlr', cacheDays > 0 ? { to: number, cache: cacheDays } : { to: number }));
  }

  /** Delivery status of a message: 1 = delivered, see https://www.budgetsms.net/sms-http-api/dlr-status/ */
  async dlrStatus(smsId) {
    return parseInt(await this.call('checksms', { smsid: smsId }), 10);
  }

  /** Your price per SMS part for every operator, keyed by operator id. */
  async pricing() {
    const body = await this.#request('getpricing', {});
    if (body.startsWith('ERR')) throw BudgetSms.#error(body);
    return JSON.parse(body);
  }

  /** Calls any endpoint and resolves with the text after "OK ". Rejects with BudgetSmsError on "ERR <code>". */
  async call(endpoint, params = {}) {
    const body = await this.#request(endpoint, params);
    if (!body.startsWith('OK')) throw BudgetSms.#error(body);
    return body.slice(2).trim();
  }

  async #submit(endpoint, to, message, from, options) {
    const params = { from, to, msg: message, price: 1, mccmnc: 1, credit: 1 };
    if (options.customid) params.customid = options.customid;
    const [smsId, price, parts, mccmnc, credit] = (await this.call(endpoint, params)).split(/\s+/);
    return {
      smsId: parseInt(smsId, 10),
      price: price !== undefined ? parseFloat(price) : null,
      parts: parts !== undefined ? parseInt(parts, 10) : null,
      mccmnc: mccmnc ?? null,
      credit: credit !== undefined ? parseFloat(credit) : null,
    };
  }

  async #request(endpoint, params) {
    const url = new URL(this.baseUrl + endpoint + '/');
    for (const [key, value] of Object.entries({ ...this.auth, ...params })) url.searchParams.set(key, String(value));
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs), headers: { 'User-Agent': 'budgetsms-sdk/1.0.0' } });
    } catch (e) {
      throw new BudgetSmsError('transport', `BudgetSMS unreachable: ${e.message}`);
    }
    return (await response.text()).trim();
  }

  static #lookup(afterOk) {
    const [mcc = '', mnc = '', price = '0'] = afterOk.split(/\s+/);
    return { mcc, mnc, mccmnc: mcc + mnc, price: parseFloat(price) };
  }

  static #error(body) {
    const code = body.startsWith('ERR ') ? body.slice(4).trim() : 'unexpected';
    return new BudgetSmsError(code, code === 'unexpected' ? `Unexpected response: ${body}` : undefined);
  }
}

export default BudgetSms;
