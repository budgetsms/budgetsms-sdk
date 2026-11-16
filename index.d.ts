export interface BudgetSmsOptions {
  username: string;
  userid: string | number;
  handle: string;
  /** Default https://api.budgetsms.net/ */
  baseUrl?: string;
  /** Default 20000 */
  timeoutMs?: number;
}

export interface SendOptions {
  /** Your own id that may be used only once; a second message with the same id is refused with error 2014. */
  customid?: string;
}

export interface SendResult {
  /** Message id; keep it to match the delivery report or to ask the status. */
  smsId: number;
  /** Total price of the message in euro. */
  price: number | null;
  /** Number of SMS parts. */
  parts: number | null;
  /** MCC + MNC of the receiver's network, for example "20408". */
  mccmnc: string | null;
  /** Remaining credit after this message. */
  credit: number | null;
}

export interface Lookup {
  mcc: string;
  mnc: string;
  mccmnc: string;
  /** Your price for one SMS part to that network. */
  price: number;
}

/** Price row of pricing(), keyed by operator id. Values are strings as delivered by the API. */
export interface PriceRow {
  countryprefix: string;
  countryname: string;
  mcc: string;
  operatorname: string;
  mnc: string;
  price: string;
  old_price: string;
  last_modified: string;
}

export const ERROR_MESSAGES: Record<number, string>;

export class BudgetSmsError extends Error {
  /** API error code such as "1001", or "transport" / "unexpected". */
  code: string;
  constructor(code: string | number, message?: string);
}

export class BudgetSms {
  static DEFAULT_BASE_URL: string;
  constructor(options: BudgetSmsOptions);
  sendSms(to: string, message: string, from: string, options?: SendOptions): Promise<SendResult>;
  testSms(to: string, message: string, from: string, options?: SendOptions): Promise<SendResult>;
  checkCredit(): Promise<number>;
  np(number: string): Promise<Lookup>;
  hlr(number: string, cacheDays?: number): Promise<Lookup>;
  dlrStatus(smsId: number): Promise<number>;
  pricing(): Promise<Record<string, PriceRow>>;
  call(endpoint: string, params?: Record<string, string | number>): Promise<string>;
}

export default BudgetSms;
