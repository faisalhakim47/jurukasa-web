# JuruKasa Web Application

JuruKasa is point-of-sales (POS) web application with following features:
- Implement Indonesian accounting standard
- Native web modern development architecture using latest web standard
- Single-user application with local database storage, act like desktop application

## Project Structure

- `index.html` the entrypoint of single page application
- `web/` contains the implementation of web application
- `web/schemas/` contains database schema definitions (main business logic implemented here)
- `web/components/` contains general web components
- `web/contexts/` contains application contexts following subset of context protocol by w3c's Web Components Community Group 
- `web/styles/` contains Material 3 Expressive CSS implementation
- `web/views/` contains routing of pages, partials, and/or sections
- `test/` contains test setup and general test

## Compatibility Target

Application shall be written targeting modern chromium-based browser version 140 or above as of year 2026.

## JavaScript Code Style

- Prioritize function definition using `function` keyword over arrow function (except for HTML templating, the code formatter will mess-up the formatting when using full function in a template string).
- Avoid using `this` keyword. `this` keyword only be used on specific case namely exposing context state in context provider component, that's it. Outside of that case, the use of `this` keyword is prohibited.
- `Function.prototype.bind()` usage is forbidden.

## Development Environment Setup

- Our development environment is mostly without build step. We use importmaps feature to point to library and internal modules. We use prebuild step only for external libraries such as `lit-html` and `@vue/reactivity`. Not all exports from those libraries are used, see the `web/vendor/` directory for more details. The vendor build script is `scripts/build.sh`.

## Test Overview

- Test suite uses playwright
- Test file is located in `test/` directory or alongside its implementation file with `.spec.js` suffix
- Run all tests by command `npx playwright test` (slow)
- Run a test by command `npx playwright test $SPEC_FILE_RELATIVE_PATH` (fast)
