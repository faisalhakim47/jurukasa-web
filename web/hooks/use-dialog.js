import { reactive } from '@vue/reactivity';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

const CustomDialogFlag = Symbol('CustomDialogFlag');

/**
 * This hook provide mechanism to create a custom dialog web component.
 * Use useDialog only when the main purpose of the component is to be a dialog. Auxiliary dialogs must use useElement instead.
 * The strategy to implement custom dialog is by wrapping native <dialog> element in a web component.
 * In a component there can only be one useDialog instance to control single wrapped <dialog> element.
 * If you need multiple dialog elements in a component, use `useElement` to control them manually.
 * The primary dialog will be controlled by this hook and will be open by invoked command --open.
 * The secondary dialogs can be controlled manually by getting the element reference using `useElement`.
 * 
 * @param {HTMLElement} host
 */
export function useDialog(host) {
  if (CustomDialogFlag in host) throw new Error('useDialog: only one useDialog instance is allowed per host element. Read web/hooks/use-dialog.js for more information.');
  else host[CustomDialogFlag] = true;

  const dialog = reactive({
    element: useElement(host, HTMLDialogElement),
    context: /** @type {HTMLElement} */ (null),
    open: false,
  });

  host.addEventListener('command', function handleCustomDialogCommands(event) {
    assertInstanceOf(CommandEvent, event);
    // console.debug('useDialog: command event received by', host.constructor.name, event.command);
    if (dialog.element.value instanceof HTMLDialogElement) {
      if (event.source instanceof HTMLElement) {
        // console.debug('useDialog: commandfor', event.source.getAttribute('commandfor'), host.id);
        if (event.source.getAttribute('commandfor') !== host.id) return; // Not for us
        // Use custom commands because the 'show-modal' and 'close' commands support targeting the native dialog element only
        // The native commands won't works targeting custom web components. The solution is to use custom commands that is prefixed with '--'.
        dialog.context = event.source;
        if (event.command === '--open') dialog.open = true;
        else if (event.command === '--close') dialog.open = false;
        else throw new Error(`useDialog: unsupported command "${event.command}". Supported commands are "--open" and "--close".`);
        event.stopImmediatePropagation();
      }
      else if (event.source === undefined || event.source === null) throw new Error('useDialog: command source is required. Pass the button or input element that triggers the command as the event source.');
      else { throw new Error('useDialog: command source must be an HTMLButtonElement or HTMLInputElement instance to align with web api specification.'); }
    }
    else throw new Error('useDialog: dialog element is not an HTMLDialogElement instance. Attach the element directive to a <dialog> element.');
  });

  useEffect(host, function syncDialogDownState() {
    if (dialog.element.value instanceof HTMLDialogElement) {
      if (dialog.open) dialog.element.value?.showModal();
      else dialog.element.value?.close();
    }
  });

  useEffect(host, function syncDialogUpEvent() {
    const dialogElement = dialog.element.value;
    if (dialogElement instanceof HTMLDialogElement) {
      function handleClose() { dialog.open = false; }
      dialogElement.addEventListener('close', handleClose);
      return function cleanup() {
        dialogElement.removeEventListener('close', handleClose);
      };
    }
  });

  return dialog;
}
