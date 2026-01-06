import { reactive } from '@vue/reactivity';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

/**
 * @param {HTMLElement} host
 */
export function useDialog(host) {
  const dialog = reactive({
    element: useElement(host, HTMLDialogElement),
    context: /** @type {HTMLElement} */ (null),
    open: false,
  });

  host.addEventListener('command', function handleCustomDialogCommands(event) {
    assertInstanceOf(CommandEvent, event);
    if (dialog.element.value instanceof HTMLDialogElement) {
      if (event.source instanceof HTMLElement) {
        if (event.source.getAttribute('commandfor') !== dialog.element.value.id) return; // Not for us
        // Use custom commands because the 'show-modal' and 'close' commands support targeting the native dialog element only
        // The native commands won't works targeting custom web components
        dialog.context = event.source;
        if (event.command === '--open') dialog.open = true;
        else if (event.command === '--close') dialog.open = false;
        else throw new Error(`useDialog: unsupported command "${event.command}". Supported commands are "--open" and "--close".`);
      }
      else if (event.source === undefined || event.source === null) throw new Error('useDialog: command source is required. Pass the button or input element that triggers the command as the event source.');
      else console.warn('useDialog: command source is not an HTMLElement instance. Ignoring the command source.');
      // We ignore this rule for now. We have use case to trigger the dialog from <tr>.
      // else { throw new Error('useDialog: command source must be an HTMLButtonElement or HTMLInputElement instance to align with web api specification.'); }
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
