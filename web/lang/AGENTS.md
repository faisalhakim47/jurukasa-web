# Translation Guidelines

Our translation uses token-based structure to ensure consistency and ease of updates across different languages.

## Translation Structure

The translation files is located in `web/lang/{LANG_CODE}/index.js`. The index.js files export default objects with type `{ [baseKey: string]: { [textKey: string]: string } }`. Each baseKey represents a section/feature of the application, and each textKey represents token of a specific text string within that section/feature.

The translation uses `web/lang/en/index.js` as the base structure and reference for all other languages. When adding new text strings, always add them first to the English translation file before propagating to other languages. When other languages are missing, the system will fallback to English for those missing strings.

## Translation Tokens Naming Conventions

- The baseKey shall be camelCase of max two words that represents the section/feature of the application. For example: `common`, `dashboard`, `onboarding`, `precurement`, etc.
- The textKey shall be camelCase of descriptive representing the usage/purpose of the text combined with UI role/landmark indicating where the text string is being used. For example: `businessConfigFormTitle`, `businessNameLabel`, `businessConfigSubmitLabel`.
