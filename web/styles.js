// @ts-nocheck

/* Foundation */
import { default as resetCss } from '#web/styles/reset.css' with { type: 'css' };
import { default as globalCss } from '#web/styles/design-tokens.css' with { type: 'css' };
import { default as typographyCss } from '#web/styles/typography.css' with { type: 'css' };

/* Components */
import { default as appBarCss } from '#web/styles/app-bar.css' with { type: 'css' };
import { default as buttonCommonCss } from '#web/styles/button/common.css' with { type: 'css' };
import { default as cardsCss } from '#web/styles/cards.css' with { type: 'css' };
import { default as dialogCss } from '#web/styles/dialog.css' with { type: 'css' };
import { default as iconCss } from '#web/styles/icon.css' with { type: 'css' };
import { default as listCss } from '#web/styles/list.css' with { type: 'css' };
import { default as menuCss } from '#web/styles/menu.css' with { type: 'css' };
import { default as navigationRailCss } from '#web/styles/navigation/rail.css' with { type: 'css' };
import { default as outlinedTextFieldCss } from '#web/styles/text-field/outlined.css' with { type: 'css' };
import { default as progressLinearCss } from '#web/styles/progress/linear.css' with { type: 'css' };
import { default as scrollbarCss } from '#web/styles/scrollbar.css' with { type: 'css' };
import { default as tableCss } from '#web/styles/table.css' with { type: 'css' };
import { default as tabsCss } from '#web/styles/tabs.css' with { type: 'css' };

export const webStyleSheets = [
  appBarCss,
  buttonCommonCss,
  cardsCss,
  dialogCss,
  globalCss,
  iconCss,
  listCss,
  menuCss,
  navigationRailCss,
  outlinedTextFieldCss,
  progressLinearCss,
  resetCss,
  scrollbarCss,
  tableCss,
  tabsCss,
  typographyCss,
];
