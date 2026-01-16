import '#web/contexts/database-context.js';
import '#web/contexts/device-context.js';
import '#web/contexts/font-context.js';
import '#web/contexts/i18n-context.js';
import '#web/contexts/ready-context.js';
import '#web/contexts/router-context.js';
import '#web/contexts/time-context.js';
import '#web/views/main-view.js';

import { webStyleSheets } from '#web/styles.js';
document.adoptedStyleSheets = webStyleSheets;
