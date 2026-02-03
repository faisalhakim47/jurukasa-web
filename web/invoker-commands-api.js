/**
 * According to web specification:
 * - The Popover API (popovertarget and popovertargetaction) support <button> and <input type="button"> elements.
 * - The Invoker Commands API (command and commandfor) support only <button> element.
 * 
 * For symmetry, we decide to diverge from the spec a little and apply Invoker Commands API to <input type="button"> element.
 */

window.addEventListener('click', function handleInvokerCommands() {
  const [root, source] = getActiveElementRecursively(document, document.activeElement);
  if (source instanceof HTMLInputElement && source.type === 'button') {
    const commandfor = source.getAttribute('commandfor');
    const command = source.getAttribute('command');
    if (commandfor && command) {
      const target = false ? null
        : root instanceof ShadowRoot ? root.getElementById(commandfor)
        : root instanceof Document ? root.getElementById(commandfor)
        : null;
      if (target instanceof Element) {
        target.dispatchEvent(new CommandEvent('command', {
          command,
          source,
        }));
      }
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
