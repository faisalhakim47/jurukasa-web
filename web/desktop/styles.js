// @ts-nocheck

/* Foundation */
import { default as resetCss } from '#web/desktop/styles/reset.css' with { type: 'css' };
import { default as globalCss } from '#web/desktop/styles/design-tokens.css' with { type: 'css' };
import { default as typographyCss } from '#web/desktop/styles/typography.css' with { type: 'css' };

/* Components */
import { default as appBarCss } from '#web/desktop/styles/app-bar.css' with { type: 'css' };
import { default as buttonCommonCss } from '#web/desktop/styles/button/common.css' with { type: 'css' };
import { default as cardsCss } from '#web/desktop/styles/cards.css' with { type: 'css' };
import { default as chipCss } from '#web/desktop/styles/chip.css' with { type: 'css' };
import { default as dialogCss } from '#web/desktop/styles/dialog.css' with { type: 'css' };
import { default as iconCss } from '#web/desktop/styles/icon.css' with { type: 'css' };
import { default as listCss } from '#web/desktop/styles/list.css' with { type: 'css' };
import { default as menuCss } from '#web/desktop/styles/menu.css' with { type: 'css' };
import { default as navigationRailCss } from '#web/desktop/styles/navigation/rail.css' with { type: 'css' };
import { default as outlinedTextFieldCss } from '#web/desktop/styles/text-field/outlined.css' with { type: 'css' };
import { default as progressIndicatorCss } from '#web/desktop/styles/progress-indicator.css' with { type: 'css' };
import { default as scrollbarCss } from '#web/desktop/styles/scrollbar.css' with { type: 'css' };
import { default as tableCss } from '#web/desktop/styles/table.css' with { type: 'css' };
import { default as tabsCss } from '#web/desktop/styles/tabs.css' with { type: 'css' };

export const webStyleSheets = [
  appBarCss,
  buttonCommonCss,
  cardsCss,
  chipCss,
  dialogCss,
  globalCss,
  iconCss,
  listCss,
  menuCss,
  navigationRailCss,
  outlinedTextFieldCss,
  progressIndicatorCss,
  resetCss,
  scrollbarCss,
  tableCss,
  tabsCss,
  typographyCss,
];
