import { stdout } from 'node:process';

import type { ConsoleMessage, Page, Request } from '@playwright/test';

/**
 * capture very simplified HTML content of the page
 * removing all styles, scripts, meta, links, and empty nodes
 * keeping only the essential structure, text content, and accessibility features
 * synchronizing input values and checked states
 */
export async function capturePageHTML(page: Page) {
  await page.waitForTimeout(1000);
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch (error) {
    // If networkidle times out, just continue - the page might have ongoing network activity
    console.debug('NetworkIdle timeout, continuing with page capture...');
  }
  const compactedHtmlContent = await page.evaluate(function () {
    const html = document.documentElement.cloneNode(true);
    const treeWalker = document.createTreeWalker(html, NodeFilter.SHOW_ELEMENT);
    const toBeRemovedNodes: Array<Node> = [];
    const toBeEmptyNodes: Array<Node> = [];
    const toBeSyncedNodes: Array<Node> = [];
    const toBeAssesedNodes: Array<Node> = [];
    let node: Node | null;
    while ((node = treeWalker.nextNode())) {
      if (node instanceof HTMLHeadElement) toBeRemovedNodes.push(node);
      else if (node instanceof HTMLInputElement) toBeSyncedNodes.push(node);
      else if (node instanceof HTMLLinkElement) toBeRemovedNodes.push(node);
      else if (node instanceof HTMLMetaElement) toBeRemovedNodes.push(node);
      else if (node instanceof HTMLScriptElement) toBeRemovedNodes.push(node);
      else if (node instanceof HTMLSelectElement) toBeSyncedNodes.push(node);
      else if (node instanceof HTMLStyleElement) toBeRemovedNodes.push(node);
      else if (node instanceof HTMLTextAreaElement) toBeSyncedNodes.push(node);
      else if (node instanceof SVGElement) toBeEmptyNodes.push(node);
      else if (node instanceof HTMLElement && node.getAttribute('aria-hidden') === 'true')
        toBeRemovedNodes.push(node);
      else toBeAssesedNodes.push(node);
    }
    for (const node of toBeRemovedNodes) {
      node.parentElement?.removeChild(node);
    }
    for (const node of toBeEmptyNodes) {
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }
    for (const node of toBeSyncedNodes) {
      if (node instanceof HTMLInputElement) {
        if (node.type === 'checkbox' || node.type === 'radio') {
          if (node.checked) {
            node.setAttribute('checked', 'checked');
          } else {
            node.removeAttribute('checked');
          }
        } else {
          node.setAttribute('value', node.value);
        }
      }
    }
    for (const node of toBeAssesedNodes) {
      if (node instanceof HTMLElement) {
        const classAttr = node.getAttributeNode('class');
        const styleAttr = node.getAttributeNode('style');
        if (classAttr) node.removeAttributeNode(classAttr);
        if (styleAttr) node.removeAttributeNode(styleAttr);
      }
    }
    const recursiveWrapperDivRemover = function (nodes: Array<Node>) {
      const importantNodes = [] as Array<Node>;
      let wrapperDetected = false;
      for (const node of nodes) {
        const nodeHasText = Array.from(node.childNodes).some(function (child) {
          return (
            child.nodeType === Node.TEXT_NODE &&
            child.textContent &&
            child.textContent.trim() !== ''
          );
        });
        if (
          node instanceof HTMLDivElement &&
          node.parentElement instanceof HTMLElement &&
          (node.children.length === 1 || (node.children.length === 0 && nodeHasText === false)) &&
          node.attributes.length === 0
        ) {
          wrapperDetected = true;
          const parent = node.parentElement;
          const child = node.children.item(0);
          if (child) {
            node.removeChild(child);
            parent.appendChild(child);
          }
          parent.removeChild(node);
        } else {
          importantNodes.push(node);
        }
      }
      if (wrapperDetected) {
        recursiveWrapperDivRemover(importantNodes);
      }
    };
    recursiveWrapperDivRemover(toBeAssesedNodes);
    return html instanceof HTMLElement ? html.outerHTML : html.textContent || '';
  });
  const currentUrl = page.url();
  stdout.write(`\n<CapturedHTMLContent url="${currentUrl}">\n`);
  stdout.write(compactedHtmlContent);
  stdout.write('\n</CapturedHTMLContent>\n');
}

export function capturePageHTMLOnError(
  testBody: (testArgs: { page: Page }) => Promise<void>,
): (testArgs: { page: Page }) => Promise<void> {
  return async function ({ page }: { page: Page }) {
    try {
      return await testBody({ page });
    } catch (error) {
      await capturePageHTML(page);
      throw error;
    }
  };
}

const pageConsoleDebugAndApiReqMap = new WeakMap<
  Page,
  { requestFinishedListener: Function; consoleListner: Function }
>();

export async function startCapturePageConsoleDebugAndApiRequests(page: Page) {
  if (pageConsoleDebugAndApiReqMap.has(page)) return;

  const requestFinishedListener = async function (request: Request) {
    const url = request.url();
    if (!url.startsWith('http://localhost') || !url.includes('/api/')) return;
    const response = await request.response();
    const reqBody = request.postData();
    let resBody: string | null = null;
    if (response) {
      try {
        resBody = await response.text();
      } catch (error) {
        // Ignore protocol errors when response body is no longer available
        resBody = null;
      }
    }
    stdout.write(`> ${request.method()} ${request.url()}\n`);
    if (reqBody) {
      stdout.write(`>\n`);
      stdout.write(`${reqBody}\n`);
    }
    if (response) {
      stdout.write(`< ${response.status()} ${response.statusText()}\n`);
      if (resBody) {
        stdout.write(`<\n`);
        stdout.write(`${resBody}\n`);
      }
    }
  };

  const consoleListner = function (msg: ConsoleMessage) {
    const msgType = msg.type();
    const msgText = msg.text();
    if (msgType === 'debug') {
      stdout.write(`\n[console.debug] ${msgText}`);
    }
  };

  page.on('requestfinished', requestFinishedListener);
  page.on('console', consoleListner);

  pageConsoleDebugAndApiReqMap.set(page, { requestFinishedListener, consoleListner });
}

export async function stopCapturePageConsoleDebugAndApiRequests(page: Page) {
  const listeners = pageConsoleDebugAndApiReqMap.get(page);
  if (!listeners) return;
  page.off('requestfinished', listeners.requestFinishedListener as (request: Request) => void);
  page.off('console', listeners.consoleListner as (msg: ConsoleMessage) => void);
  pageConsoleDebugAndApiReqMap.delete(page);
}
