import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { DeviceContextElement } from '#web/contexts/device-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/views/onboarding-welcome-view.js';
import '#web/views/onboarding-database-view.js';
import '#web/views/onboarding-business-view.js';
import '#web/views/onboarding-chart-view.js';

/**
 * Onboarding View handles the complete application setup flow:
 * 1. Welcome screen with feature highlights (/onboarding/welcome)
 * 2. Database connection setup (/onboarding/database)
 * 3. Business information configuration (/onboarding/business)
 * 4. Chart of accounts selection (/onboarding/chart-of-accounts)
 * 
 * Each step is its own route to enable browser back/forward navigation.
 * 
 * State-Based Routing:
 * Instead of tracking how the user arrived (back button vs programmatic navigation),
 * we validate whether the current route is valid for the current onboarding state.
 * If the route is invalid, we redirect to the appropriate step. This allows natural
 * back navigation while ensuring users can't skip ahead of their progress.
 */
export class OnboardingViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const device = useContext(host, DeviceContextElement);
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    /**
     * Evaluates the current application state and redirects to the appropriate
     * onboarding step if needed. This ensures users always land on the correct
     * step based on their current configuration status.
     * 
     * State-based routing logic:
     * - If database unconfigured: user can be on welcome or database step
     * - If database connected but business not configured: user can be on any step up to business
     * - If business configured but no accounts: user can be on any onboarding step
     * - If accounts exist: onboarding complete, redirect to dashboard
     * 
     * This approach validates the current route against application state rather than
     * tracking navigation history, which is more robust and allows natural back navigation.
     */
    useEffect(host, function evaluateInitialStep() {
      const pathname = router.route?.pathname;

      // Helper to check if user is on a specific step
      const isOnWelcome = pathname === '/onboarding' 
        || pathname === '/onboarding/'
        || pathname.startsWith('/onboarding/welcome');
      const isOnDatabase = pathname.startsWith('/onboarding/database');
      const isOnBusiness = pathname.startsWith('/onboarding/business');
      const isOnChart = pathname.startsWith('/onboarding/chart-of-accounts');
      const isOnOnboarding = isOnWelcome || isOnDatabase || isOnBusiness || isOnChart;

      // If database is not configured, only allow welcome and database steps
      if (database.state === 'unconfigured') {
        if (isOnWelcome || isOnDatabase) {
          // Valid steps - but normalize base path to welcome
          if (pathname === '/onboarding' || pathname === '/onboarding/') {
            router.navigate({ pathname: '/onboarding/welcome', replace: true });
          }
        }
        else if (isOnOnboarding) {
          // User somehow got to business/chart without database - redirect to welcome
          router.navigate({ pathname: '/onboarding/welcome', replace: true });
        }
        return;
      }

      // Database is connected - check business configuration and accounts
      if (database.state === 'connected') {
        Promise.all([
          database.sql`SELECT value FROM config WHERE key = 'Business Name' LIMIT 1;`,
          database.sql`SELECT count(*) AS count FROM accounts;`
        ])
          .then(function handleStateCheck([businessResult, accountsResult]) {
            const businessRow = businessResult.rows[0];
            const isBusinessConfigured = String(businessRow?.value || '').trim().length > 0;
            const accountCount = Number(accountsResult.rows[0]?.count || 0);
            const isChartConfigured = accountCount > 0;

            // Onboarding complete - redirect to dashboard
            if (isChartConfigured) {
              router.navigate({ pathname: '/dashboard', replace: true });
              return;
            }

            // Database connected but business not configured
            if (!isBusinessConfigured) {
              // If user is on welcome or database step, navigate to business config
              // (This happens after successful database connection)
              if (isOnWelcome || isOnDatabase) {
                router.navigate({ pathname: '/onboarding/business' });
              }
              // Only block chart step for back navigation
              else if (isOnChart) {
                router.navigate({ pathname: '/onboarding/business', replace: true });
              }
              // isOnBusiness: already on correct step, no action needed
              return;
            }

            // Business configured but chart not set up - all onboarding routes are valid
            // User can go back to review/edit previous steps
          })
          .catch(function handleStateCheckError(error) {
            console.error('Failed to check configuration', error);
            // On error, only redirect if on chart step (which definitely requires prior steps)
            if (isOnChart) {
              router.navigate({ pathname: '/onboarding/business', replace: true });
            }
          });
      }
    });

    useEffect(host, function renderOnboardingView() {
      const pathname = router.route?.pathname || '/onboarding';
      const databaseState = database.state;

      // When database is connecting, show loading state to prevent UI flicker
      if (databaseState === 'connecting') {
        render(html`
          <div role="status" aria-live="polite" style="display: flex; align-items: center; justify-content: center; height: 100vh;">
            <span>${t('onboarding', 'loadingIndicatorLabel')}</span>
          </div>
        `);
        return;
      }

      // Default to welcome if on base onboarding path
      if (pathname === '/onboarding' || pathname === '/onboarding/') {
        render(html`<onboarding-welcome-view></onboarding-welcome-view>`);
        return;
      }

      // Route to specific step views based on pathname
      if (pathname.startsWith('/onboarding/welcome')) {
        render(html`<onboarding-welcome-view></onboarding-welcome-view>`);
      }
      else if (pathname.startsWith('/onboarding/database')) {
        render(html`<onboarding-database-view></onboarding-database-view>`);
      }
      else if (pathname.startsWith('/onboarding/business')) {
        render(html`<onboarding-business-view></onboarding-business-view>`);
      }
      else if (pathname.startsWith('/onboarding/chart-of-accounts')) {
        render(html`<onboarding-chart-view></onboarding-chart-view>`);
      }
      else {
        render(html`
          <div role="alert">
            <h1>${t('onboarding', 'unknownStepTitle')}</h1>
            <p>${t('onboarding', 'unknownStepMessage')}</p>
            <div>
              <a is="router-link" href="/onboarding">${t('onboarding', 'returnToWelcome')}</a>
            </div>
          </div>
        `);
      }
    });
  }
}

defineWebComponent('onboarding-view', OnboardingViewElement);
