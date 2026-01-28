/** @import { Page } from '@playwright/test' */
/** @import { Protocol } from '../../../node_modules/playwright-core/types/protocol.d.ts' */

/**
 * @param {Page} page
 */
export async function getReadableFullAXTree(page) {
  const cdpClient = await page.context().newCDPSession(page);
  await cdpClient.send('Accessibility.enable');
  const fullAXTree = await cdpClient.send('Accessibility.getFullAXTree');
  const readableFullAXTree = formatAXTree(fullAXTree);
  return readableFullAXTree;
}

/**
 * @param {Protocol.Accessibility.getFullAXTreeReturnValue} tree
 */
export function formatAXTree(tree) {
  const nodeIndex = new Map();
  let rootNode = /** @type {Protocol.Accessibility.AXNode} */ (null);
  for (const node of tree.nodes) {
    nodeIndex.set(node.nodeId, node);
    const nodeId = parseInt(node.nodeId, 10);
    const rootNodeId = typeof rootNode?.nodeId === 'string' ? parseInt(rootNode?.nodeId, 10) : null;
    if (rootNodeId === null) rootNode = node;
    else if (nodeId < 0) { /** I don't know what this node is, no time to dig */ }
    else if (nodeId < rootNodeId) rootNode = node;
  }
  const lines = recursiveFormatAXTreeNode(0, rootNode, nodeIndex);
  const cleanedLines = cleanEmptyGeneric(lines);
  const axTree = cleanedLines
    .map(function formatLine([indent, role, name, desc, props]) {
      return [
        ' '.repeat(indent),
        `- ${role}`,
        name ? ` "${name}"` : '',
        props.length === 0 ? '' : ` ${props.join('')}`,
        desc ? `: ${desc}` : '',
      ].join('');
    })
    .join('\n');
  return axTree;
}

/** @typedef {[number, string, string, string, Array<string>]} NodeLine */

/**
 * @param {number} indent
 * @param {Protocol.Accessibility.AXNode} node
 * @param {Map<string, Protocol.Accessibility.AXNode>} nodeIndex
 * @returns {Array<NodeLine>}
 */
function recursiveFormatAXTreeNode(indent, node, nodeIndex) {
  if (!node?.role) return [];
  let role = String(node.role?.value ?? '');
  let name = String(node.name?.value ?? '');
  let desc = String(node.description?.value ?? '');
  let props = node.properties
    ?.map(function formatProp(prop) {
      if (prop.value?.type === 'boolean' && prop.value?.value) return `[${prop.name}]`;
      if (prop.value?.type === 'booleanOrUndefined' && prop.value?.value) return `[${prop.name}]`;
      if (prop.value?.type === 'integer') return `[${prop.name}=${prop?.value?.value ?? ''}]`;
      if (prop.value?.type === 'token') return `[${prop.name}="${prop?.value?.value ?? ''}"]`;
      return null;
    })
    .filter(function nonNull(prop) {
      return prop !== null;
    })
    ?? [];

  if (role === '') role = 'generic';
  if (role === 'none') role = 'generic';

  if (role === 'generic') {
    if (node.childIds.length === 0) return [];
    else if (node.childIds.length === 1) {
      return recursiveFormatAXTreeNode(indent, nodeIndex.get(node.childIds[0]), nodeIndex);
    }
    const parentNode = nodeIndex.get(node.parentId);
    if (parentNode.childIds.length === 1) {
      let result = [];
      for (const childId of node.childIds) {
        const childNode = nodeIndex.get(childId);
        result.push(...recursiveFormatAXTreeNode(indent, childNode, nodeIndex));
      }
      return result;
    }
  }

  if (role === 'InlineTextBox') return [];
  // if (role === 'LabelText' && name === '') return [];
  // if (role === 'StaticText') return [];

  // if (role === 'paragraph') {
  //   if (node.childIds.length === 0) return [];
  //   else for (const childId of node.childIds) {
  //     const child = nodeIndex.get(childId);
  //     if (child.role?.value === 'StaticText') {
  //       name = name ? `${name} ${child.name?.value}` : child.name?.value;
  //     }
  //   }
  // }

  /** @type {Array<NodeLine>} */
  let lines = [[indent, role, name, desc, props]];
  for (const childId of node.childIds) {
    const childNode = nodeIndex.get(childId);
    lines.push(...recursiveFormatAXTreeNode(indent + 2, childNode, nodeIndex));
  }

  return lines;
}

/**
 * @param {Array<NodeLine>} lines
 * @returns {Array<NodeLine>}
 */
function cleanEmptyGeneric(lines) {
  /** @type {Set<number>} */
  const toBeRemovedIndices = new Set();
  const lastLineIndex = lines.length - 1;
  lineLoop:
  for (const [index, [indent, role]] of lines.entries()) {
    if (role === 'generic') {
      if (index === lastLineIndex) {
        toBeRemovedIndices.add(index);
        break lineLoop;
      }

      const nextIndex = index + 1;
      const nextIndent = lines[nextIndex]?.[0] ?? 0;
      const hasNoChild = indent >= nextIndent;
      if (hasNoChild) {
        toBeRemovedIndices.add(index);
        break lineLoop;
      }

      let hasPrevSibling = false;
      prevChildLoop:
      for (let prevIndex = index - 1; prevIndex >= 0; prevIndex--) {
        const [prevIndent] = lines[prevIndex];
        if (indent === prevIndent) {
          hasPrevSibling = true;
          break prevChildLoop;
        }
        if (indent > prevIndent) break prevChildLoop;
      }
      let hasNextSibling = false;
      let lastChildIndex = lastLineIndex;
      nextChildLoop:
      for (let childIndex = nextIndex; childIndex <= lastLineIndex; childIndex++) {
        const [childIndent] = lines[childIndex];
        if (indent === childIndent) {
          hasNextSibling = true;
          break nextChildLoop;
        }
        if (indent > childIndent) {
          lastChildIndex = childIndex;
          break nextChildLoop;
        }
      }
      // const onlyChild = !(hasPrevSibling || hasNextSibling);
      // if (onlyChild) {
      //   toBeRemovedIndices.add(index);
      //   for (let childIndex = nextIndex; childIndex <= lastChildIndex; childIndex++) {
      //     lines[childIndex][0] -= 2;
      //   }
      //   break lineLoop;
      // }
    }
  }
  for (const index of toBeRemovedIndices) lines.splice(index, 1);
  if (toBeRemovedIndices.size === 0) return lines;
  return cleanEmptyGeneric(lines);
}

