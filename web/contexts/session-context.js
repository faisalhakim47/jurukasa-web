import { computed, reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { provideContext, useContext } from '#web/hooks/use-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useAttribute } from '#web/hooks/use-attribute.js';

/** @import { DatabaseConfig } from '#web/contexts/database-context.js' */

const PERSISTED_SESSIONS_KEY = 'jurukasa-sessions';
const ACTIVE_SESSION_KEY = 'jurukasa-active-session';

/**
 * @typedef {object} Session
 * @property {string} id
 * @property {DatabaseConfig} database
 * @property {number} createTime
 */

/**
 * @typedef {object} SessionContextState
 * @property {Session[]} sessions
 * @property {string|null} activeSessionId
 */

export class SessionContextElement extends HTMLElement {
  static get observedAttributes() {
    return ['active-session-id'];
  }

  constructor() {
    super();

    const context = provideContext(this);
    const time = useContext(context, TimeContextElement);

    const activeSessionIdAttr = useAttribute(context, 'active-session-id');

    const state = reactive(/** @type {SessionContextState} */ ({
      sessions: JSON.parse(localStorage.getItem(PERSISTED_SESSIONS_KEY) || '[]'),
      activeSessionId: JSON.parse(sessionStorage.getItem(ACTIVE_SESSION_KEY) || 'null'),
    }));

    const activeSession = computed(function getActiveSession() {
      try {
        if (typeof activeSessionIdAttr.value === 'string' && activeSessionIdAttr.value) {
          state.activeSessionId = activeSessionIdAttr.value;
          sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(activeSessionIdAttr.value));
        }
      }
      catch { /** ignore */ }
      return state.sessions.find(function byId(session) {
        return session.id === state.activeSessionId;
      });
    });

    this.sessions = useExposed(context, function getSessions() {
      return state.sessions;
    });

    this.activeSession = useExposed(context, function getActiveSession() {
      return activeSession.value;
    });

    /**
     * @param {DatabaseConfig} databaseConfig
     * @returns {Session}
     */
    function createSession(databaseConfig) {
      const sessionId = crypto.randomUUID();
      state.sessions.push({
        id: sessionId,
        database: databaseConfig,
        createTime: time.newDate().getTime(),
      });
      state.activeSessionId = sessionId;
      localStorage.setItem(PERSISTED_SESSIONS_KEY, JSON.stringify(state.sessions));
      sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(activeSession.value));
      return state.sessions.at(-1);
    }
    this.createSession = createSession;

    /**
     * @param {string} sessionId
     */
    function selectSession(sessionId) {
      state.activeSessionId = sessionId;
      sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(activeSession.value));
    }
    this.selectSession = selectSession;

    function closeSession() {
      state.activeSessionId = null;
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    }
    this.closeSession = closeSession;
  }
}

defineWebComponent('session-context', SessionContextElement);
