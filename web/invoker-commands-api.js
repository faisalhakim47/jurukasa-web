/**
 * According to web specification:
 * - The Popover API (popovertarget and popovertargetaction) support <button> and <input type="button"> elements.
 * - The Invoker Commands API (command and commandfor) support only <button> element.
 * 
 * For symmetry, we decide to diverge from the spec a little and apply Invoker Commands API to <input type="button"> element. Not only for consistency, but also for styling simplicity. We designed Outlined Text Field specifically for input, not button. Handling both input and button with semantical selector would be very tidious.
 */

window.addEventListener('click', function handleInvokerCommands() {
  const [root, source] = getActiveElementRecursively(document, document.activeElement);
  if (source instanceof HTMLInputElement && source.type === 'button') {
    const commandfor = source.getAttribute('commandfor')?.trim();
    const command = source.getAttribute('command')?.trim();
    if (commandfor && command) {
      /** @type {DocumentFragment} */
      const owner = false ? null
        : root instanceof ShadowRoot ? root
          : root instanceof Document ? root
            : null;
      const target = owner?.querySelector(commandfor);
      const invokerCommandEvent = new CommandEvent('command', { command, source });
      if (target instanceof Element) target.dispatchEvent(invokerCommandEvent);
      else console.warn('Invoker Commands API', 'Your target does not exists in the owner', commandfor, owner);
    }
  }
});

/**
 * @param {DocumentOrShadowRoot} root
 * @param {Element} target
 * @returns {[DocumentOrShadowRoot,Element]}
 */
function getActiveElementRecursively(root, target) {
  if (target instanceof Element && target.shadowRoot instanceof ShadowRoot) {
    return getActiveElementRecursively(target.shadowRoot, target.shadowRoot.activeElement);
  }
  return [root, target];
}
