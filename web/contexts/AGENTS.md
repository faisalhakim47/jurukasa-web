# Context Protocol

This is a subset of the w3c's Web Components Community Group Context Protocol.
Read the `https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md` web page for complete specification.

## Changes

- The KeyType is narrowed down to be a Element's constructor function
- The ValueKey is narrowed down to be an instance of the KeyType's element
- The __context__ property in Context type is removed for simplicity because the KeyType and ValueType types are tied
- The subscribe mechanism is replaced with a reactive object by `@vue/reactivity`
- Context can act as "guard" as in guard pattern. Parent context can replace entire interface so that user can provide prerequisite action and or information

## Context Writing Guidelines

- Context is written as a Web Component
- Context setup must begin with `provideContext` hook
- Context public methods and properties must be defined in the constructor function instead of class prototype. This is for consistency and to make sure that all methods are "portable" standalone functions that do not depend on class prototype chain.
- Context can also provide helper hooks for easier consumption
