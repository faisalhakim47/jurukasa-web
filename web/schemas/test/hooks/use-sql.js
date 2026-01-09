/** @import { ResultSet } from '@libsql/client' */

import { useLibSQLiteClient } from '#web/schemas/test/hooks/use-libsqlite-client.js';

export function useSql() {
  const db = useLibSQLiteClient();

  /**
   * @param {TemplateStringsArray} query
   * @param {Array<unknown>} params
   * @returns {Promise<ResultSet>}
   */
  return async function sql(query, ...params) {
    if (!Array.isArray(query)) throw new TypeError('Expected TemplateStringsArray as the first argument.');
    return db().execute({
      sql: query.join('?'),
      args: params.map(function (param) {
        if (param === null || param === undefined) return null;
        else if (typeof param === 'number' || typeof param === 'string' || typeof param === 'boolean') return param;
        else return JSON.stringify(param);
      }),
    });
  };
}
