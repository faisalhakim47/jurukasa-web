# Session Management Refactor Implementation Plan

## Overview

Refactor session management to use `sessionStorage` instead of localStorage + route state. This provides proper tab-scoped session isolation and cleaner separation of concerns.

## Session Data Model

```js
// sessionStorage key: 'jurukasa-sessions'
{
  sessions: [
    { id: 'uuid', database: { provider, name, url, authToken }, createTime: ms },
    ...
  ],
  activeSessionId: 'uuid' | null
}
```

- One session represents one database connection
- Sessions are stored in sessionStorage (shared between tab and its opener)
- No auto-restore on new tab - user must explicitly select a session

## Core Principles

1. **Session context is the source of truth** for database configuration
2. **Database context is read-only** - cannot modify database config
3. All config changes flow through session context only

## Implementation Tasks

### Phase 1: Core Session Context

#### Task 1: Create `web/contexts/session-context.js`

Create new context element `session-context` that manages sessions using sessionStorage.

**Responsibilities:**
- Read/write sessions from/to sessionStorage (`jurukasa-sessions` key)
- Manage `activeSessionId`
- Provide reactive state for `sessions` array and `activeSession`

**Exposed API:**
- `session.sessions` - reactive array of all sessions
- `session.activeSession` - computed: currently active session object
- `session.createSession(databaseConfig)` - creates new session and makes it active
- `session.selectSession(sessionId)` - switches active session
- `session.closeSession()` - clears active session

**Behavior:**
- On init, load sessions from sessionStorage
- When `activeSession` changes, dispatch custom event for database-context to react

#### Task 2: Update `web/contexts/router-context.js`

Remove all database-related state from route management.

**Changes:**
- Remove `database` property from `Route` typedef
- Remove `getPersistedRouteState()` function
- Remove `persistRouteState()` function
- Remove `localStorage` persistence logic
- Simplify `route` reactive object to only `pathname` and `search`

#### Task 3: Update `web/contexts/database-context.js`

Make database context read-only - it receives config from session context.

**Changes:**
- Remove `localStorage.getItem('databases')` logic
- Remove `getDatabases()`, `addDatabase()`, `removeDatabaseByName()` functions
- Remove public `connect(config)` method
- Add `useContext(this, SessionContextElement)` to read active session
- Add reactive effect: when `session.activeSession` changes, auto-connect to that database
- Keep `sql()` and `transaction()` methods for query execution

**Data Flow:**
```
session.selectSession(id) → session.activeSession updates → database-context detects change → auto-connect
```

### Phase 2: Session Selector UI

#### Task 4: Create `web/desktop/views/session-selector-view.js`

New view for selecting available sessions on new tab.

**UI:**
- Header: "Select Session" / localization key needed
- List of sessions (if any): shows database name, provider icon
- Each item clickable → calls `session.selectSession(id)`
- Empty state: "No sessions available" + "Go to Onboarding" button → navigates to `/onboarding/welcome`
- "Create New Session" button (alternative to empty state) → `/onboarding/welcome`

#### Task 5: Update `web/desktop/views/main-view.js`

Integrate session selector into routing.

**Changes:**
- Import session-context
- Add condition: if `!session.activeSession` and not on session-selector/onboarding, redirect to `/session-selector`
- Add route: `/session-selector` → renders `<session-selector-view>`

### Phase 3: Update Database Views

#### Task 6: Update `web/desktop/views/database-setup-view.js`

On successful database creation, create session instead of storing to localStorage.

**Changes:**
- On form submit success:
  - Call `session.createSession(databaseConfig)` instead of localStorage
  - Remove `sessionStorage.setItem('previousRouteState', ...)` logic
- Update import to include session-context

#### Task 7: Update `web/desktop/views/database-management-view.js`

Use session context for session management.

**Changes:**
- Read session list from `session.sessions` instead of `database.getDatabases()`
- "Switch" action: calls `session.selectSession(id)`
- "Close/Remove" action: calls `session.closeSession()`
- Remove any localStorage-related code

### Phase 4: Verification

#### Task 8: Run Schema Tests

```bash
node --test ./web/schemas/*.test.js
```

#### Task 9: Run Playwright Tests

```bash
CONSOLE_OUTPUT=1 npx playwright test
```

## User Flow After Refactor

1. **User opens new tab** → No active session → Redirect to `/session-selector`
2. **Session selector shows**:
   - If sessions exist → list of sessions to choose from
   - If no sessions → "Go to Onboarding" button
3. **User clicks session** → `session.selectSession(id)` → database auto-connects → navigate to app
4. **User completes onboarding** → `session.createSession(dbConfig)` auto-selected → navigate to app
5. **User opens database management** → Switch/close sessions via session context

## Localization Keys Needed

Add to `web/lang/en/literal/index.js` or appropriate location:
- `sessionSelectorTitle` - "Select Session"
- `sessionSelectorNoSessions` - "No sessions available"
- `sessionSelectorGoToOnboarding` - "Go to Onboarding"
- `sessionSelectorCreateNew` - "Create New Session"

## Out of Scope

- Settings page refactoring (deferred to future)
- Additional session metadata beyond database config
- Session export/import functionality