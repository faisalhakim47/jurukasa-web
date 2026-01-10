import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';
import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { provideContext, useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useExposed } from '#web/hooks/use-exposed.js';

/**
 * OnboardingContext provides state about the application's onboarding status.
 */
export class OnboardingContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const database = useContext(host, DatabaseContextElement);

    const onboarding = reactive({
      state: /** @type {'init'|'needs-database'|'needs-business-config'|'needs-chart-of-accounts'|'complete'} */ ('init'),
    });

    this.state = useExposed(host, function readOnboardingState() {
      return onboarding.state;
    });

    this.isComplete = useExposed(host, function readOnboardingComplete() {
      return onboarding.state === 'complete';
    });

    this.needsOnboarding = useExposed(host, function readNeedsOnboarding() {
      return onboarding.state === 'needs-database'
        || onboarding.state === 'needs-business-config'
        || onboarding.state === 'needs-chart-of-accounts';
    });

    useBusyStateUntil(host, function evaluateReady() {
      return onboarding.state !== 'init';
    });

    /**
     * Force re-evaluation of onboarding state
     * This should be called after database changes that affect onboarding status
     */
    this.refresh = async function refresh() {
      if (database.state === 'unconfigured') {
        onboarding.state = 'needs-database';
      }
      else if (database.state === 'connected') {
        try {
          const result = await database.sql`SELECT value FROM config WHERE key = 'Business Name' LIMIT 1;`;
          const row = result.rows[0];
          const isBusinessConfigured = String(row?.value || '').trim().length > 0;

          if (isBusinessConfigured) {
            const accountsResult = await database.sql`SELECT count(*) as count FROM accounts`;
            const count = Number(accountsResult.rows[0]?.count || 0);
            if (count > 0) onboarding.state = 'complete';
            else onboarding.state = 'needs-chart-of-accounts';
          }
          else onboarding.state = 'needs-business-config';
        }
        catch (error) {
          console.error('Failed to check configuration', error);
          onboarding.state = 'needs-business-config';
        }
      }
    };

    useEffect(host, function evaluateOnboardingState() {
      if (onboarding.state === 'complete') { /* nothing to do */ }
      else if (database.isReady && database.state === 'unconfigured') {
        onboarding.state = 'needs-database';
      }
      else if (database.isReady && database.state === 'connected') {
        database.sql`SELECT value FROM config WHERE key = 'Business Name' LIMIT 1;`
          .then(function (result) {
            const row = result.rows[0];
            const isBusinessConfigured = String(row?.value || '').trim().length > 0;

            if (isBusinessConfigured) {
              database.sql`SELECT count(*) as count FROM accounts`
                .then(function (result) {
                  const count = Number(result.rows[0]?.count || 0);
                  if (count > 0) onboarding.state = 'complete';
                  else onboarding.state = 'needs-chart-of-accounts';
                });
            }
            else onboarding.state = 'needs-business-config';
          })
          .catch(function (error) {
            console.error('Failed to check configuration', error);
            onboarding.state = 'needs-business-config';
          });
      }
    });
  }
}

defineWebComponent('onboarding-context', OnboardingContextElement);
