# Remove Context Ability to be a Guard (DONE)

## Current Behavior

- Context can act as "guard" as in guard pattern. Parent context can replace entire interface so that user can provide prerequisite action and or information
- There are 2 currently implemented guards in context:
  - Database Context: ensures that database is setup before proceeding to child views
  - Onboarding Context: ensures that business information is setup before proceeding to child views

## Expected Behavior

- Context should only responsible for providing state/data, not handling any UI.
- Current UI guard implementation shall be moved to web/views.
- The current usage of context as guard is to setup database and setup business information.
- We shall implement <onboarding-view> to encompase all flows related to application setup:
  - Handle application introduction. Show welcome screen, some carousel sumarizing application features
  - Handle database setup flow
  - Handle business information setup flow
- The onboarding shall has its own route: /onboarding
- On main page, we shall redirect to /onboarding when any of the following conditions are met:
  - Database is not setup
  - Business information is not setup
- Once onboarding is completed, we then allow user to access other routes in the application.
- Routing in this application is done in very very pragmatic way using simple if-else conditions. This is done deliberately to avoid complexity and over-engineering.

This is rough plan of onboarding. Developer shall have overall understanding of the main goal from this point to implement the onboarding view properly.
