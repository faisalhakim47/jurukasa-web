# Schema Overview

The `web/schemas/*.sql` are SQLite migration files that define the database schema for the JuruKasa application.

## Schema Migration Writing Rules

- Schema shall be designed to be executed only once (no idempotent execution).
- Naming convention:
  - Use lowercase with hyphens for file names (e.g., `001-accounting.sql`).
  - Use snake_case for table and column names (e.g., `account_id`).
  - Use plural nouns for table names (e.g., `accounts`).
  - Use `_time` suffix for timestamp columns (e.g., `create_time`).
- Timestamp columns shall be `INTEGER` type to store Unix epoch time in milliseconds. Remember, in milliseconds, not seconds.
- Run schema tests using command: `npm run test:db` or `node --test ./web/schemas/*.test.js`.

## Schema Test Suite

- The database has its own test suite separate from the application test suite.
- The database test suite use `node:test` module.
- Each schema file shall have a corresponding test file named `<schema-file-name>.test.js` (e.g., `001-accounting.test.js`).

## Schema Test Writing Rules

- Each data preparation must be very explicit and deterministic.
- All date/time values must be absolute and deterministic (e.g., `new Date(2024, 5, 10, 0, 0, 0, 0)`).
- Test are forbidden to use conditional assertions. All preconditions and postconditions must be deterministic.
