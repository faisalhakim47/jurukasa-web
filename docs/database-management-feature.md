# Database Management Feature (DONE)

- JuruKasa shall provide user interface to configure multiple databases.
- The database configuration shall be in Database tab on Setting menu.
- User shall be able to add new Database. The add new database mechanism shall be:
  - Database configuration shall provide button "+ New Database"
  - User click the "+ New Database" button
  - App reset the state of database configuration. Note: global app state is stored in route state, to reset it, navigate with replace mode
  - App navigate to a onboarding database setup step (with reset state).
  - The database setup shall be implemented separately to onboarding feature.
  - On database setup there shall be back/cancel button that will restore route state before reset.
  - User shall configure database similar to the onboarding feature.
  - User click next
  - App display business configuration step similar to onboarding feature
  - User configure bisiness information
  - User click next
  - App display option of predefined chart of accounts similar to on boarding feature
  - User select an option
  - User click finish
  - App redirect to dashboard as usual
- Database configuration shall display list of databases with columns: Provider (Local, Turso), Name, Actions
- The actions shall include:
  - Info, will display summary of the database
  - Use, will use the database
  - Export, will export database file

This is outline of Datbase Management feature. Developer shall have general outline of application and able to implement feature acordingly.
