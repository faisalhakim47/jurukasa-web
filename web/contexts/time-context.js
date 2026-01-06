import { defineWebComponent } from '#web/component.js';
import { useAttributeChangedCallback } from '#web/hooks/use-lifecycle.js';
import { provideContext } from '#web/hooks/use-context.js';
import { useExposed } from '#web/hooks/use-exposed.js';

export class TimeContextElement extends HTMLElement {
  static observedAttributes = ['time'];

  constructor() {
    super();

    provideContext(this);

    const host = this;
    let time = this.getAttribute('time');

    useAttributeChangedCallback(host, function (name, oldValue, newValue) {
      if (name === 'time') time = newValue;
    });

    this.currentDate = function createDate() {
      return typeof time === 'string'
        ? new Date(time)
        : new Date();
    };

    /**
     * Returns the current timestamp in seconds (Unix epoch).
     * If a fixed time attribute is set, returns that time's timestamp.
     * @type {number}
     */
    this.now = useExposed(host, function getNow() {
      const date = typeof time === 'string'
        ? new Date(time)
        : new Date();
      return Math.floor(date.getTime() / 1000);
    });
  }
}

defineWebComponent('time-context', TimeContextElement);
