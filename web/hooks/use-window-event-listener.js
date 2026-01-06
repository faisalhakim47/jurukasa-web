import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';

/** @type {Map<keyof WindowEventMap, Promise<WindowEventMap[keyof WindowEventMap]>>} */
const earlyWindowEvents = new Map();

earlyWindowEvents.set('load', new Promise(function (resolve) {
  window.addEventListener('load', function (event) {
    resolve(event);
  }, { once: true });
}));

earlyWindowEvents.set('pageshow', new Promise(function (resolve) {
  window.addEventListener('pageshow', function (event) {
    resolve(event);
  }, { once: true });
}));

/**
 * @template {keyof WindowEventMap} K
 * @param {HTMLElement} host
 * @param {K} eventName
 * @param {(event: WindowEventMap[K]) => void} callback
 */
export function useWindowEventListener(host, eventName, callback) {
  useConnectedCallback(host, function attachWindowEventListener() {
    if (earlyWindowEvents.has(eventName)) {
      earlyWindowEvents.get(eventName).then(callback);
    }
    else {
      window.addEventListener(eventName, callback);
      return function detachWindowEventListener() {
        window.removeEventListener(eventName, callback);
      };
    }
  });
}
