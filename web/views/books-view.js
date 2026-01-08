import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useReady } from '#web/contexts/ready-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useContext } from '#web/hooks/use-context.js';
import { useElement } from '#web/hooks/use-element.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { scrollIntoView } from '#web/tools/dom.js';

import '#web/components/material-symbols.js';
import '#web/components/router-link.js';
import '#web/views/desktop-view.js';
import '#web/views/journal-entries-view.js';
import '#web/views/chart-of-accounts-view.js';
import '#web/views/account-tags-view.js';
import '#web/views/financial-reports-view.js';
import '#web/views/fiscal-years-view.js';
import '#web/views/fixed-assets-view.js';

export class BooksViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const router = useContext(host, RouterContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const journalEntriesTabpanel = useElement(host, HTMLElement);
    const chartOfAccountsTabpanel = useElement(host, HTMLElement);
    const accountTagsTabpanel = useElement(host, HTMLElement);
    const reportsTabpanel = useElement(host, HTMLElement);
    const fiscalYearsTabpanel = useElement(host, HTMLElement);
    const fixedAssetsTabpanel = useElement(host, HTMLElement);
    const notfoundDialog = useElement(host, HTMLDialogElement);

    function syncRouteToTabpanel() {
      if (!(journalEntriesTabpanel.value instanceof HTMLElement)) return;
      if (!(chartOfAccountsTabpanel.value instanceof HTMLElement)) return;
      if (!(accountTagsTabpanel.value instanceof HTMLElement)) return;
      if (!(reportsTabpanel.value instanceof HTMLElement)) return;
      if (!(fiscalYearsTabpanel.value instanceof HTMLElement)) return;
      if (!(fixedAssetsTabpanel.value instanceof HTMLElement)) return;
      if (!(notfoundDialog.value instanceof HTMLDialogElement)) return;
      notfoundDialog.value.close();
      const pathname = router.route.pathname;
      if (pathname === '/books' || pathname === '/books/') { /** evaluate default path on mounted */ }
      else if (pathname.startsWith('/books/journal-entries')) scrollIntoView(journalEntriesTabpanel.value);
      else if (pathname.startsWith('/books/chart-of-accounts')) scrollIntoView(chartOfAccountsTabpanel.value);
      else if (pathname.startsWith('/books/account-tags')) scrollIntoView(accountTagsTabpanel.value);
      else if (pathname.startsWith('/books/reports')) scrollIntoView(reportsTabpanel.value);
      else if (pathname.startsWith('/books/fiscal-years')) scrollIntoView(fiscalYearsTabpanel.value);
      else if (pathname.startsWith('/books/fixed-assets')) scrollIntoView(fixedAssetsTabpanel.value);
      else {
        if (notfoundDialog.value.isConnected) notfoundDialog.value.showModal();
        else requestAnimationFrame(function waitForAnimationToShowModal() {
          if (notfoundDialog.value.isConnected) notfoundDialog.value.showModal();
          else console.warn('Cannot show notfound dialog because it is not connected to DOM');
        });
      }
    }

    useEffect(host, syncRouteToTabpanel);
    useReady(host, syncRouteToTabpanel); // sync on ready for initial scrollIntoView to works
    useMounted(host, function evaluateDefaultRoute() {
      const pathname = router.route?.pathname;
      if (pathname === '/books' || pathname === '/books/') {
        router.navigate({ pathname: '/books/journal-entries', replace: true });
      }
    });

    /** @param {Event} event */
    function handleTabpanelContainerScrollEnd(event) {
      const container = event.currentTarget;
      assertInstanceOf(HTMLElement, container);
      requestAnimationFrame(function makeSureScrollEndedByAnimationFrame() {
        requestIdleCallback(function makeSureScrollEndedByIdle() {
          const scrollLeft = container.scrollLeft;
          const containerWidth = container.clientWidth;
          const tabIndex = Math.round(scrollLeft / containerWidth);
          if (tabIndex === 0) router.navigate({ pathname: '/books/journal-entries', replace: true });
          else if (tabIndex === 1) router.navigate({ pathname: '/books/chart-of-accounts', replace: true });
          else if (tabIndex === 2) router.navigate({ pathname: '/books/account-tags', replace: true });
          else if (tabIndex === 3) router.navigate({ pathname: '/books/reports', replace: true });
          else if (tabIndex === 4) router.navigate({ pathname: '/books/fiscal-years', replace: true });
          else if (tabIndex === 5) router.navigate({ pathname: '/books/fixed-assets', replace: true });
          else router.navigate({ pathname: '/books/journal-entries', replace: true });
        });
      });
    }

    useEffect(host, function renderBooksView() {
      const pathname = router.route.pathname;
      render(html`
        <div style="height: 100%; display: flex; flex-direction: column; max-width: 1280px; margin: 0 auto;">
          <header class="app-bar" style="width: 100%; flex-shrink: 0;">
            <hgroup>
              <h1>${t('common', 'booksTitle')}</h1>
              <p>${t('common', 'booksDescription')}</p>
            </hgroup>
          </header>
          <nav
            role="tablist"
            aria-label="${t('common', 'booksSectionsAriaLabel')}"
            style="position: sticky; top: 0; z-index: 1; width: 100%; flex-shrink: 0;"
          >
            <router-link role="tab" id="journal-entries-tab" aria-controls="journal-entries-panel" href="/books/journal-entries" replace>
              <span class="content">
                <material-symbols name="receipt_long" size="24"></material-symbols>
                ${t('common', 'journalEntriesTabLabel')}
              </span>
            </router-link>
            <router-link role="tab" id="chart-of-accounts-tab" aria-controls="chart-of-accounts-panel" href="/books/chart-of-accounts" replace>
              <span class="content">
                <material-symbols name="account_tree" size="24"></material-symbols>
                ${t('common', 'chartOfAccountsTabLabel')}
              </span>
            </router-link>
            <router-link role="tab" id="account-tags-tab" aria-controls="account-tags-panel" href="/books/account-tags" replace>
              <span class="content">
                <material-symbols name="label" size="24"></material-symbols>
                ${t('common', 'accountTagsTabLabel')}
              </span>
            </router-link>
            <router-link role="tab" id="reports-tab" aria-controls="reports-panel" href="/books/reports" replace>
              <span class="content">
                <material-symbols name="assignment" size="24"></material-symbols>
                ${t('common', 'reportsTabLabel')}
              </span>
            </router-link>
            <router-link role="tab" id="fiscal-years-tab" aria-controls="fiscal-years-panel" href="/books/fiscal-years" replace>
              <span class="content">
                <material-symbols name="calendar_month" size="24"></material-symbols>
                ${t('common', 'fiscalYearsTabLabel')}
              </span>
            </router-link>
            <router-link role="tab" id="fixed-assets-tab" aria-controls="fixed-assets-panel" href="/books/fixed-assets" replace>
              <span class="content">
                <material-symbols name="real_estate_agent" size="24"></material-symbols>
                ${t('common', 'fixedAssetsTabLabel')}
              </span>
            </router-link>
          </nav>
          <main
            @scrollend=${handleTabpanelContainerScrollEnd}
            style="
              flex: 1;
              display: flex;
              flex-direction: row;
              width: 100%;
              max-width: 1280px;
              margin: 0 auto;
              overflow-x: auto;
              overflow-y: hidden;
              overscroll-behavior-x: contain;
              scroll-snap-type: x mandatory;
              scroll-behavior: smooth;
              scrollbar-width: none;
            "
          >
            <journal-entries-view
              ${journalEntriesTabpanel}
              id="journal-entries-panel"
              role="tabpanel"
              aria-labelledby="journal-entries-tab"
              aria-hidden="${pathname.startsWith('/books/journal-entries') ? 'false' : 'true'}"
              tabindex="${pathname.startsWith('/books/journal-entries') ? '0' : '-1'}"
              ?inert=${pathname.startsWith('/books/journal-entries') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></journal-entries-view>
            <chart-of-accounts-view
              ${chartOfAccountsTabpanel}
              id="chart-of-accounts-panel"
              role="tabpanel"
              aria-labelledby="chart-of-accounts-tab"
              aria-hidden="${pathname.startsWith('/books/chart-of-accounts') ? 'false' : 'true'}"
              tabindex="${pathname.startsWith('/books/chart-of-accounts') ? '0' : '-1'}"
              ?inert=${pathname.startsWith('/books/chart-of-accounts') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></chart-of-accounts-view>
            <account-tags-view
              ${accountTagsTabpanel}
              id="account-tags-panel"
              role="tabpanel"
              aria-labelledby="account-tags-tab"
              aria-hidden="${pathname.startsWith('/books/account-tags') ? 'false' : 'true'}"
              tabindex="${pathname.startsWith('/books/account-tags') ? '0' : '-1'}"
              ?inert=${pathname.startsWith('/books/account-tags') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></account-tags-view>
            <financial-reports-view
              ${reportsTabpanel}
              id="reports-panel"
              role="tabpanel"
              aria-labelledby="reports-tab"
              aria-hidden="${pathname.startsWith('/books/reports') ? 'false' : 'true'}"
              tabindex="${pathname.startsWith('/books/reports') ? '0' : '-1'}"
              ?inert=${pathname.startsWith('/books/reports') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></financial-reports-view>
            <fiscal-years-view
              ${fiscalYearsTabpanel}
              id="fiscal-years-panel"
              role="tabpanel"
              aria-labelledby="fiscal-years-tab"
              aria-hidden="${pathname.startsWith('/books/fiscal-years') ? 'false' : 'true'}"
              tabindex="${pathname.startsWith('/books/fiscal-years') ? '0' : '-1'}"
              ?inert=${pathname.startsWith('/books/fiscal-years') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></fiscal-years-view>
            <fixed-assets-view
              ${fixedAssetsTabpanel}
              id="fixed-assets-panel"
              role="tabpanel"
              aria-labelledby="fixed-assets-tab"
              aria-hidden="${pathname.startsWith('/books/fixed-assets') ? 'false' : 'true'}"
              tabindex="${pathname.startsWith('/books/fixed-assets') ? '0' : '-1'}"
              ?inert=${pathname.startsWith('/books/fixed-assets') === false}
              style="
                flex: 0 0 100%;
                width: 100%;
                min-width: 0;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                overflow-y: auto;
              "
            ></fixed-assets-view>
          </main>
        </div>
        <dialog ${notfoundDialog} id="notfound-dialog">
          <div class="container">
            <header>
              <h2>${t('common', 'pageNotFoundTitle')}</h2>
            </header>
            <section class="content">
              <p>${t('common', 'pageNotFoundMessage')}</p>
            </section>
            <menu>
              <router-link
                href="/books/journal-entries"
                replace
              >${t('common', 'goToJournalEntriesButtonLabel')}</router-link>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('books-view', BooksViewElement);
