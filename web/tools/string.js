/**
 * @param {string} indentedString 
 */
export function removeIndentation(indentedString) {
  const lines = indentedString
    .split('\n')
    .map(function trimEnd(line) {
      return line.trimEnd();
    })
    .filter(function nonEmpty(line) {
      return line.length > 0;
    });
  const firstLine = lines[0] ?? '';
  const indentationSize = firstLine.length - firstLine.trimStart().length;
  if (indentationSize === 0) return indentedString;
  return lines
    .map(function removeIndent(line) {
      return line.slice(indentationSize);
    })
    .join('\n');
}
