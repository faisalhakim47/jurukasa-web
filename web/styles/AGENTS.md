# JuruKasa Web Styles Guidelines

The JuruKasa web application implements latest Material 3 Expressive by Google as of December 2025. The Material 3 design system is implemented in plain modern CSS. The CSS is implemented using semantical structure with very minimum classes, the classes is only for variant modifiers.

The `web/styles/` directory shall only contains globally reusable styles. The feature-specific style shall be implemented as inline style attribute.

## CSS Writing Guidelines

- The CSS is written in semantically meaningful way, using HTML5 elements and attributes.
- The general term to describe our naming methodology is "Semantic CSS".
- The CSS is relly heavily on structural elements. For example `nav>router-link>material-symbols` instead of `.main-nav-icon`.
- Use any accessibility attributes to indicate roles, UI states, properties, etc.
- Use very minimum classes, only for variant modifiers. Select semantical HTML tags first.
- Selector priority:
  1. Semantic HTML5 elements like `<button>`, `<ul>`, `<nav>`, etc.
  2. Accessibility attributes like `[role="tablist"]`, `[aria-selected="true"]`, etc.
  3. Modifier classes like `.outlined`, `.elevated`, etc.
- Use terms and naming based on official Material 3 Expressive specification.
