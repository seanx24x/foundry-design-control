import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultFixtureRoot = fileURLToPath(new URL('.', import.meta.url));

function fail(message) {
  throw new Error(`Invalid Foundry source annotation: ${message}`);
}

function sourceTags(html) {
  return [...html.matchAll(/<[^>]*data-foundry-source="([^"]+)"[^>]*>/gs)].map((match) => {
    const beforeTag = html.slice(0, match.index);
    const lastNewline = beforeTag.lastIndexOf('\n');
    return {
      tag: match[0],
      source: match[1],
      id: match[0].match(/data-foundry-id="([^"]+)"/)?.[1] ?? 'unlabelled element',
      anchor: match[0].match(/data-foundry-source-anchor="([^"]+)"/)?.[1],
      openingLine: beforeTag.split('\n').length,
      openingColumn: match.index - lastNewline - 1,
    };
  });
}

export function validateSourceAnnotations(fixtureRoot = defaultFixtureRoot) {
  const root = resolve(fixtureRoot);
  const htmlPath = resolve(root, 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  const annotations = sourceTags(html);
  if (!annotations.length) fail('index.html contains no mapped elements.');

  const ids = new Set();
  for (const annotation of annotations) {
    if (ids.has(annotation.id)) fail(`duplicate data-foundry-id "${annotation.id}".`);
    ids.add(annotation.id);

    const match = annotation.source.match(/^([^:]+):(\d+):(\d+)$/);
    if (!match) fail(`${annotation.id} must use fixture-relative file:line:column syntax.`);
    const [, sourcePath, lineText, columnText] = match;
    if (isAbsolute(sourcePath) || /^[A-Za-z]:[\\/]/.test(sourcePath)) {
      fail(`${annotation.id} uses an absolute path: ${sourcePath}.`);
    }
    if (sourcePath.split(/[\\/]/).includes('..')) {
      fail(`${annotation.id} escapes the fixture with parent traversal: ${sourcePath}.`);
    }

    const targetPath = resolve(root, sourcePath);
    const relativeTarget = relative(root, targetPath);
    if (
      relativeTarget === '..' ||
      relativeTarget.startsWith(`..${sep}`) ||
      isAbsolute(relativeTarget)
    ) {
      fail(`${annotation.id} resolves outside the fixture: ${sourcePath}.`);
    }
    if (!existsSync(targetPath)) fail(`${annotation.id} points to missing file ${sourcePath}.`);

    const lineNumber = Number(lineText);
    const columnNumber = Number(columnText);
    const lines = readFileSync(targetPath, 'utf8').split(/\r?\n/);
    const targetLine = lines[lineNumber - 1];
    if (targetLine === undefined) {
      fail(`${annotation.id} points past the end of ${sourcePath}:${lineNumber}.`);
    }
    if (columnNumber < 0 || columnNumber > targetLine.length) {
      fail(`${annotation.id} has a stale column in ${sourcePath}:${lineNumber}:${columnNumber}.`);
    }

    if (sourcePath === 'index.html') {
      if (lineNumber !== annotation.openingLine || columnNumber !== annotation.openingColumn) {
        fail(
          `${annotation.id} is stale at ${annotation.source}; its opening tag is at index.html:${annotation.openingLine}:${annotation.openingColumn}.`,
        );
      }
      continue;
    }

    if (!annotation.anchor) {
      fail(`${annotation.id} needs data-foundry-source-anchor for non-HTML source ${sourcePath}.`);
    }
    const anchorOccurrences = lines.reduce(
      (count, line) => count + line.split(annotation.anchor).length - 1,
      0,
    );
    if (anchorOccurrences !== 1) {
      fail(
        `${annotation.id} needs one unambiguous "${annotation.anchor}" anchor in ${sourcePath}; found ${anchorOccurrences}.`,
      );
    }
    const anchorColumn = targetLine.indexOf(annotation.anchor);
    if (anchorColumn === -1 || anchorColumn !== columnNumber) {
      fail(
        `${annotation.id} is stale at ${sourcePath}:${lineNumber}:${columnNumber}; expected "${annotation.anchor}" at that exact location.`,
      );
    }
  }

  return {
    count: annotations.length,
    files: [...new Set(annotations.map(({ source }) => source.split(':')[0]))],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = validateSourceAnnotations(process.argv[2] ?? defaultFixtureRoot);
  console.log(`Validated ${result.count} fixture-relative Foundry source annotations.`);
}
