// =============================================================
// Odoo type primitives
// =============================================================

/** Odoo IDs son siempre integers positivos. */
export type OdooId = number;

/**
 * many2one en Odoo se serializa como `[id, display_name]` cuando hay valor,
 * o `false` cuando es null. Acá modelamos el caso "leído" sin display_name.
 */
export type OdooMany2One = OdooId | false;

/**
 * Tuple commands para campos x2many de Odoo.
 * El más común que usamos es [6, 0, [ids]] = "reemplazar todos los IDs".
 */
export type OdooMany2ManyCommand = [number, number, number[]];


// =============================================================
// JSON-RPC envelope
// =============================================================

export interface OdooError {
  code: number;
  message: string;
  data?: {
    name?: string;
    message?: string;
    debug?: string;
    arguments?: unknown[];
  };
}

export interface OdooJsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: OdooError;
}


// =============================================================
// Modelos Odoo que tocamos
// =============================================================
// Sólo los campos que pedimos vía `fields`. Si en el futuro pedimos más,
// extender estos types — NO usar `any`.

export interface OdooCompany {
  id: OdooId;
  name: string;
}

export interface OdooJournal {
  id: OdooId;
  name: string;
  code: string;
  type: string; // 'sale' | 'purchase' | 'cash' | 'bank' | 'general'
  /** [id, name] cuando es company-specific, false cuando es compartido. */
  company_id: [OdooId, string] | false;
}

export interface OdooTax {
  id: OdooId;
  name: string;
  amount: number;
  type_tax_use: string; // 'sale' | 'purchase' | 'none'
  /** [id, name] cuando es company-specific, false cuando es compartido. */
  company_id: [OdooId, string] | false;
}

export interface OdooPartnerLite {
  id: OdooId;
  name: string;
}

export interface OdooProductLite {
  id: OdooId;
  name: string;
  default_code: string | false;
}

export interface OdooMoveTotal {
  id: OdooId;
  amount_total: number;
}

export interface OdooUserInfo {
  id: OdooId;
  name: string;
  login: string;
  company_id: [OdooId, string] | false;
  company_ids: OdooId[];
}
