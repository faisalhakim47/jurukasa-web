# Session Management Refactor Plan

## Current State

There are multiple ways to provide session context to current web application:
- meta head element, this act more like env variable of the web page.
- route state, when navigation happen it provide additional metadata via state data on push state. (this is the main user session management mechanism).
- local storage, this is used to persist the route state to be use on reload.

## Problem

The session management is tightly coupled with the route management, this is a good thing, we are doing it on purpose so that each tab can have different session. But current implementation is not very clean, there are multiple conflicting responsibilities on the route management. For example for database context, we implement database configuration as part of session data but the configuration is async data. Currently the configuration state and the connection state it self is not synchronized properly, the configuration can be out of sync with what is actually connected. This is not a problem with the architecture it self but more on the implementation, we need to refactor the session management to be more clean and robust.

## Solution

Rewrite entire session management to use Session Storage (https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) instead. The session storage is built exactly for this purpose, it provide a simple key value storage that is scoped to the tab and its subsequent opener.

We need to remove the local storage usage, we don't implement auto-restore session on new tab. User must select the session they want to use on new tab, this is to prevent confusion and potential security issue when user open new tab and it automatically restore the session from other tab.

Currently there is no security mechanism what so ever, this is full offline app. So the selection will just be a list of available session configurations that user can choose from, if no session exist the onboarding welcome page will be shown.

The session data mainly consist of database configuration and other things.

Prefered solutions:
- implement a centralized session context above everything that need session data.
- implement a session selector view that allow user to select from available session configurations on new tab.
