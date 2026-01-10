# Add Support to More Database Providers

## Current Behavior

- The application currently only supports remote-only turso sqlite database.
- The database interface is neatly abstracted in <database-context> for the web app, @test/tools/database.js for playwright tests, and @web/schemas/test/hooks/* for unit tests of the schemas.
- The playwright tests spawn an isolated local turso dev server for each test case.
- User setup database provider on onboarding view by submitting the turso database url and its token.

## Desired Behavior

### Context Refactoring

- The application shall support local sqlite database that stored in web browser, remote turso sqlite database, and remote cloudflare D1 sqlite database.
- The abstraction layers shall be implemented in <database-context> without affecting the rest of the application.
- Implement test for <database-context> when using local sqlite database and remote turso sqlite database providers. Skip cloudflare D1 sqlite database tests.

### Test Refactoring

- The rest of the playwright tests shall be refactored to use local sqlite database instead of local turso dev server.
- Skip unit tests refactoring, there should not be any issue because all database uses the same SQLite interface.

### Onboarding View Changes

The onboarding database setup shall be revised. Here are the UX characteristics:
- On database setup there shall be 3 list items representing each database provider.
- Each list item shall have a radio button to select the database provider.
- When list item is selected, there shall be a form expanded below it to fill the required information for that database provider.
- for local sqlite database provider, there is no additional information required.
- for remote turso sqlite database provider, the form shall have 2 input fields to fill the database url and its token.
- for remote cloudflare D1 sqlite database provider, the form shall have 2 input fields to fill the account id and the database name.


## Notes

These are rough plan of onboarding. Developer shall have overall understanding of the main goal from this point to implement the onboarding view properly.
