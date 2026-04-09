import accounting from '#web/lang/en/literal/accounting.js';
import accountingDatabase from '#web/lang/en/literal/accounting-database.js';

export const literal = {
  ...accounting,
  ...accountingDatabase,
};

/** @typedef {typeof literal} LiteralTranslation */

export default literal;
