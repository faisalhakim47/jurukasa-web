# Translation Guidelines

Our translation uses token-based structure to ensure consistency and ease of updates across different languages.

## Translation Structure

The translation files is located in `web/lang/{LANG_CODE}/index.js`. The index.js files export default objects with type `{ [baseKey: string]: { [textKey: string]: string } }`. Each baseKey represents a section/feature of the application, and each textKey represents token of a specific text string within that section/feature.

The translation uses `web/lang/en/index.js` as the base structure and reference for all other languages. When adding new text strings, always add them first to the English translation file before propagating to other languages. When other languages are missing, the system will fallback to English for those missing strings.

## Translation Tokens Naming Conventions

- The baseKey shall be camelCase of max two words that represents the section/feature of the application. For example: `common`, `dashboard`, `onboarding`, `precurement`, etc.
- The textKey shall be camelCase of descriptive representing the usage/purpose of the text combined with UI role/landmark indicating where the text string is being used. For example: `businessConfigFormTitle`, `businessNameLabel`, `businessConfigSubmitLabel`.
- It is important to note that the TranslationPack is strictly consists 2 levels of nesting: baseKey and textKey.

## Translation Usage

- We implement the translation as `useTranslator` hook. For convention, please define the translate function as `t` variable, like `const t = useTranslator(host);`.
- The translate function signature is `(baseKey: string, textKey: string, ...args: unknown[]) => string`.
- We implement `printf`-like placeholder syntax for dynamic text interpolation. Here are supported placeholders:
  - `%s` for string
  - `%d` for integer
  - `%.Nf` for localized decimal, with N decimal places
  - `%c` for localized currency
  - `$D` for localized date
  - `$T` for localized time


## Literal Translation

- Literal translation is special case where the text strings are not grouped into baseKey/textKey structure, but rather simple text strings that are used as-is throughout the application.
- Literal translation files are located in `web/lang/{LANG_CODE}/literal/index.js`.
- The use case of literal translation is to accommodate "external" text strings that are not part of the main application UI, such as accounting database names, country names, etc.
- We implement `useLiteral` helper hook to easily access the literal translation. For convention, please define the literal variable as `l`, like `const l = useLiteral(host);`. The usage is simply `l('Hello %s', 'world')`.
- The literal translation also supports `printf`-like placeholder syntax for dynamic text interpolation, same as the translate function.
