import { defineWebComponent } from '#web/component.js';
import { useAttributeChangedCallback } from '#web/hooks/use-lifecycle.js';
import { provideContext } from '#web/hooks/use-context.js';
import { useExposed } from '#web/hooks/use-exposed.js';

export class TimeContextElement extends HTMLElement {
  static observedAttributes = ['time'];

  constructor() {
    super();

    const context = provideContext(this);
    let time = this.getAttribute('time');

    useAttributeChangedCallback(context, function (name, oldValue, newValue) {
      if (name === 'time') time = newValue;
    });

    this.newDate = function newDate() {
      return typeof time === 'string'
        ? new Date(time)
        : new Date();
    };

    /**
     * Returns the current timestamp in seconds (Unix epoch).
     * If a fixed time attribute is set, returns that time's timestamp.
     * @type {number}
     */
    this.unixSeconds = useExposed(context, function getNow() {
      const date = typeof time === 'string'
        ? new Date(time)
        : new Date();
      return Math.floor(date.getTime() / 1000);
    });
  }
}

defineWebComponent('time-context', TimeContextElement);
