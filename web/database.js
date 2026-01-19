/**
 * @typedef {object} SQLResult
 * @property {Array<{[column: string]: unknown}>} rows
 * @property {number} rowsAffected
 * @property {number} lastInsertRowid
 */

/**
 * Execute a SQLite query using tagged function template literals
 * Warning! The query implementor is responsible making sure proper use of template interpolations:
 * - The interpolated values shall be a SQL value in the query parameters.
 * - The interpolated values shall NOT be a SQL identifier or SQL keyword.
 * 
 * @typedef {function(TemplateStringsArray, ...unknown): Promise<SQLResult>} SQLFunction
 */

/**
 * @typedef {object} TransactionClient
 * @property {SQLFunction} sql
 * @property {function(string): Promise<void>} [executeMultiple] this is optional interface for provider that supports it
 * @property {function(): Promise<void>} commit
 * @property {function(): Promise<void>} rollback
 */

/**
 * @typedef {'read'|'write'} TransactionMode
 */

/**
 * @typedef {object} DatabaseClient
 * @property {function():Promise<void>} connect
 * @property {SQLFunction} sql
 * @property {function(string): Promise<void>} [executeMultiple] this is optional interface for provider that supports it
 * @property {function(TransactionMode): Promise<TransactionClient>} transaction
 */

/**
 * preprocess sql query parameters
 * @param {Array<unknown>} params
 */
export function unknownToSQLArgs(params) {
  return params.map(function correction(param) {
    if (param === null || param === undefined) return null;
    else if (typeof param === 'number') {
      if (Number.isNaN(param)) throw new TypeError('SQL query parameter cannot be NaN');
      else if (!Number.isFinite(param)) throw new TypeError('SQL query parameter cannot be Infinity');
      else return param;
    }
    else if (typeof param === 'number' || typeof param === 'string' || typeof param === 'boolean') return param;
    else return JSON.stringify(param);
  });
}
