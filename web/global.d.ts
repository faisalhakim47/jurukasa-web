import { ContextRequestEvent, AnyContext } from '#web/context.js';

declare global {
  interface ElementEventMap {
    /**
     * @see https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md
     *
     * A 'context-request' event can be emitted by any element which desires
     * a context value to be injected by an external provider.
     */
    'context-request': ContextRequestEvent<AnyContext>;
  }
}
