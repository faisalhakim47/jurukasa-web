# Context Protocol

This is a subset of the w3c's Web Components Community Group Context Protocol.
Read the `https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md` web page for complete specification.

## Changes

- The KeyType is narrowed down to be a Element's constructor function
- The ValueKey is narrowed down to be an instance of the KeyType's element
- The __context__ property in Context type is removed for simplicity because the KeyType and ValueType types are tied
- The subscribe mechanism is replaced with a reactive object by `@vue/reactivity`
- Context is strictly for providing state/data, not for rendering any UI (guard patterns should be implemented in views)

## Context Writing Guidelines

- Context is written as a Web Component
- Context setup must begin with `provideContext` hook
- Context public methods and properties must be defined in the constructor function instead of class prototype. This is for consistency and to make sure that all methods are "portable" standalone functions that do not depend on class prototype chain.
- Context can also provide helper hooks for easier consumption
- Context should only render a `<slot></slot>` element to pass through child content
