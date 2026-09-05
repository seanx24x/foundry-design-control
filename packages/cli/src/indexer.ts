import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import {
  PROTOCOL_VERSION,
  projectDesignGraphSchema,
  type ComponentDefinition,
  type DesignSystemFinding,
  type DesignToken,
  type DesignTokenUsage,
  type MotionPreset,
  type ProjectDesignGraph,
} from 'foundry-design-protocol';
import type { FoundryProjectConfig } from './installer.js';

const SOURCE_EXTENSIONS = new Set([
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
]);

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha1').update(value).digest('hex').slice(0, 12)}`;
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function tokenCategory(name: string, value: string): DesignToken['category'] {
  const hint = `${name} ${value}`.toLowerCase();
  if (/color|background|foreground|#[0-9a-f]{3,8}|rgba?\(|oklch\(|hsl\(/.test(hint)) return 'color';
  if (/radius|rounded/.test(hint)) return 'radius';
  if (/shadow/.test(hint)) return 'shadow';
  if (/duration|easing|transition|spring/.test(hint)) return 'motion';
  if (/font|line-height|tracking|letter/.test(hint)) return 'typography';
  if (/space|gap|padding|margin/.test(hint)) return 'spacing';
  if (/width|height|size/.test(hint)) return 'size';
  return 'other';
}

function declarationCategory(property: string, value: string): DesignToken['category'] | null {
  const name = property.toLowerCase();
  if (/shadow/.test(name)) return 'shadow';
  if (/border.*radius|radius/.test(name)) return 'radius';
  if (/font|line-height|letter-spacing|tracking/.test(name)) return 'typography';
  if (/transition|animation|duration|easing/.test(name)) return 'motion';
  if (/gap|padding|margin|inset/.test(name)) return 'spacing';
  if (/color|background|fill|stroke/.test(name) && /#|rgb|hsl|oklch|color\(/i.test(value))
    return 'color';
  if (/width|height|size/.test(name) && /-?[\d.]+(?:px|rem|em|%|vh|vw)/i.test(value)) return 'size';
  return null;
}

function comparable(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*!important\s*$/, '')
    .replaceAll(' ', '');
}

function numericValue(value: string): { amount: number; unit: string } | null {
  const match = /^(-?[\d.]+)(px|rem|em|ms|s|%)$/i.exec(comparable(value));
  return match ? { amount: Number(match[1]), unit: match[2]!.toLowerCase() } : null;
}

function closeNumericToken(value: string, tokens: DesignToken[]): DesignToken | undefined {
  const parsed = numericValue(value);
  if (!parsed) return undefined;
  return tokens
    .map((token) => ({ token, parsed: numericValue(token.value) }))
    .filter((entry) => entry.parsed?.unit === parsed.unit)
    .map((entry) => ({ ...entry, distance: Math.abs(entry.parsed!.amount - parsed.amount) }))
    .filter(
      (entry) =>
        entry.distance > 0 && entry.distance <= Math.max(2, Math.abs(parsed.amount) * 0.25),
    )
    .sort((a, b) => a.distance - b.distance)[0]?.token;
}

async function sourceFiles(root: string, exclusions: string[]): Promise<string[]> {
  const files: string[] = [];
  const excluded = new Set([
    '.git',
    '.foundry',
    'node_modules',
    'dist',
    'build',
    '.next',
    ...exclusions,
  ]);
  async function visit(directory: string): Promise<void> {
    if (files.length >= 6_000) return;
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      if (excluded.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
        const info = await stat(path).catch(() => undefined);
        if (info && info.size <= 750_000) files.push(path);
      }
    }
  }
  await visit(root);
  return files;
}

export async function indexProjectDesign(
  root: string,
  config: FoundryProjectConfig | undefined,
  revision?: string,
): Promise<ProjectDesignGraph> {
  const files = await sourceFiles(root, config?.design?.exclude ?? []);
  const tokens = new Map<string, DesignToken>();
  const components = new Map<string, ComponentDefinition>();
  const breakpoints = new Map<number, { width: number; source?: { file: string; line: number } }>();
  const themes = new Set<string>();
  const motion = new Map<string, MotionPreset>();
  const storyVariants = new Map<string, ComponentDefinition['variants']>();
  const documents: Array<{ file: string; content: string }> = [];

  for (const path of files) {
    const content = await readFile(path, 'utf8').catch(() => '');
    const file = relative(root, path).replaceAll('\\', '/');
    documents.push({ file, content });
    for (const match of content.matchAll(/(--[\w-]+)\s*:\s*([^;}\n]+)/g)) {
      const name = match[1]!;
      const value = match[2]!.trim();
      tokens.set(name, {
        id: stableId('tok', name),
        name,
        value,
        category: tokenCategory(name, value),
        cssVariable: name,
        source: { file, line: lineAt(content, match.index ?? 0) },
        confidence: 'instrumented',
        evidence: ['CSS custom property'],
      });
      if (/duration|motion/.test(name)) {
        const duration = /([\d.]+)m?s/.exec(value);
        motion.set(name, {
          id: stableId('mot', name),
          label: name.replace(/^--/, ''),
          duration: duration ? Number(duration[1]) * (value.includes('ms') ? 1 : 1000) : undefined,
          source: { file, line: lineAt(content, match.index ?? 0) },
        });
      }
    }
    for (const match of content.matchAll(
      /@media\s*\([^)]*(?:min|max)-width\s*:\s*(\d+)px[^)]*\)/g,
    )) {
      const width = Number(match[1]);
      breakpoints.set(width, {
        width,
        source: { file, line: lineAt(content, match.index ?? 0) },
      });
    }
    for (const match of content.matchAll(/(?:data-theme=["']|\[data-theme=["'])([\w-]+)/g)) {
      themes.add(match[1]!);
    }
    if (/(?:^|\s)\.dark(?:\s|[{,:])/.test(content)) themes.add('dark');

    if (/\.(?:tsx?|jsx?|mjs|cjs)$/.test(path)) {
      if (/\.stories\.[cm]?[jt]sx?$/.test(path)) {
        const componentName = basename(path).replace(/\.stories\.[cm]?[jt]sx?$/, '');
        const variants = [...content.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)/g)].map(
          (story) => ({
            id: stableId('var', `${file}:${story[1]}`),
            label: story[1]!,
            property: 'story',
            value: story[1]!,
            props: { story: story[1]! },
            source: { file, line: lineAt(content, story.index ?? 0) },
          }),
        );
        storyVariants.set(componentName, variants);
        continue;
      }
      for (const match of content.matchAll(
        /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const)\s+([A-Z][A-Za-z0-9_]*)/g,
      )) {
        const name = match[1]!;
        const id = stableId('cmp', `${file}:${name}`);
        const component = components.get(id) ?? {
          id,
          name,
          source: { file, line: lineAt(content, match.index ?? 0) },
          instances: 0,
          variants: [],
          evidence: ['exported component'],
        };
        components.set(id, component);
      }
    }
  }

  for (const [componentName, variants] of storyVariants) {
    const component = [...components.values()].find((item) => item.name === componentName);
    if (component) {
      component.variants = variants;
      component.evidence.push('Storybook story');
    } else if (variants[0]?.source) {
      const id = stableId('cmp', `${variants[0].source.file}:${componentName}`);
      components.set(id, {
        id,
        name: componentName,
        source: variants[0].source,
        instances: 0,
        variants,
        evidence: ['Storybook story'],
      });
    }
  }

  const tokenList = [...tokens.values()];
  const tokenUsages: DesignTokenUsage[] = [];
  const findings: DesignSystemFinding[] = [];
  const componentForSource = (file: string, line: number): ComponentDefinition | undefined =>
    [...components.values()]
      .filter(
        (component) => component.source?.file === file && (component.source.line ?? 0) <= line,
      )
      .sort((a, b) => (b.source?.line ?? 0) - (a.source?.line ?? 0))[0];

  for (const { file, content } of documents) {
    for (const match of content.matchAll(/var\(\s*(--[\w-]+)(?:\s*,[^)]*)?\)/g)) {
      const token = tokens.get(match[1]!);
      if (!token) continue;
      const line = lineAt(content, match.index ?? 0);
      const lineStart = content.lastIndexOf('\n', match.index ?? 0) + 1;
      const declarationPrefix = content.slice(lineStart, match.index ?? 0);
      const alias = /--[\w-]+\s*:\s*$/.test(declarationPrefix);
      const component = componentForSource(file, line);
      tokenUsages.push({
        id: stableId('use', `${file}:${match.index}:${token.id}`),
        tokenId: token.id,
        tokenName: token.name,
        value: token.value,
        category: token.category,
        kind: alias ? 'alias' : 'reference',
        componentId: component?.id,
        source: { file, line },
        evidence: [alias ? 'Token aliases this project value' : 'CSS variable reference'],
      });
    }

    for (const match of content.matchAll(/([a-zA-Z][\w-]*)\s*:\s*([^;\n},]+)[;},]/g)) {
      const property = match[1]!;
      const value = match[2]!.trim();
      if (property.startsWith('--') || value.includes('var(')) continue;
      const category = declarationCategory(property, value);
      if (!category) continue;
      const categoryTokens = tokenList.filter((token) => token.category === category);
      const exact = categoryTokens.find((token) => comparable(token.value) === comparable(value));
      const suggested = exact ?? closeNumericToken(value, categoryTokens);
      if (!suggested) continue;
      const line = lineAt(content, match.index ?? 0);
      const component = componentForSource(file, line);
      const usage: DesignTokenUsage = {
        id: stableId('use', `${file}:${match.index}:${suggested.id}:literal`),
        tokenId: suggested.id,
        tokenName: suggested.name,
        value,
        category,
        kind: 'literal',
        property,
        componentId: component?.id,
        source: { file, line },
        evidence: [
          exact
            ? 'Literal equals an existing project token'
            : 'Literal is close to a project token',
        ],
      };
      tokenUsages.push(usage);
      findings.push({
        id: stableId('finding', usage.id),
        kind: component ? 'component-drift' : 'literal-drift',
        severity: exact ? 'info' : 'warning',
        title: exact ? `Use ${suggested.name}` : `${value} is close to ${suggested.name}`,
        detail: exact
          ? `${property} repeats ${suggested.value} as a literal instead of its project token.`
          : `${property} uses ${value}; the nearest ${category} token is ${suggested.name} at ${suggested.value}.`,
        category,
        tokenIds: [suggested.id],
        usageIds: [usage.id],
        componentIds: component ? [component.id] : [],
        suggestedTokenId: suggested.id,
        source: usage.source,
        evidence: usage.evidence,
      });
    }
  }

  for (let index = 0; index < tokenList.length; index += 1) {
    const token = tokenList[index]!;
    const near = tokenList.slice(index + 1).find((candidate) => {
      if (candidate.category !== token.category) return false;
      const first = numericValue(token.value);
      const second = numericValue(candidate.value);
      return Boolean(
        first &&
        second &&
        first.unit === second.unit &&
        Math.abs(first.amount - second.amount) > 0 &&
        Math.abs(first.amount - second.amount) <= Math.max(2, Math.abs(first.amount) * 0.2),
      );
    });
    if (near) {
      const relatedUsages = tokenUsages.filter(
        (usage) => usage.tokenId === token.id || usage.tokenId === near.id,
      );
      findings.push({
        id: stableId('finding', `near:${token.id}:${near.id}`),
        kind: 'near-duplicate',
        severity: 'warning',
        title: `${token.name} and ${near.name} are unusually close`,
        detail: `${token.value} and ${near.value} may represent the same ${token.category} decision.`,
        category: token.category,
        tokenIds: [token.id, near.id],
        usageIds: relatedUsages.map((usage) => usage.id),
        componentIds: [
          ...new Set(
            relatedUsages
              .map((usage) => usage.componentId)
              .filter((componentId): componentId is string => Boolean(componentId)),
          ),
        ],
        source: near.source ?? token.source,
        evidence: ['Same category', 'Values fall within the project drift threshold'],
      });
    }
    if (!tokenUsages.some((usage) => usage.tokenId === token.id)) {
      findings.push({
        id: stableId('finding', `unused:${token.id}`),
        kind: 'unused-token',
        severity: 'info',
        title: `${token.name} has no indexed references`,
        detail: 'Confirm whether this token is intentionally reserved before removing it.',
        category: token.category,
        tokenIds: [token.id],
        usageIds: [],
        componentIds: [],
        source: token.source,
        evidence: ['No references were found in indexed project files'],
      });
    }
  }

  const configuredViewports = config?.design?.viewports ?? [];
  const graphBreakpoints = configuredViewports.length
    ? configuredViewports.map((item) => ({ ...item, height: item.height ?? 900 }))
    : breakpoints.size
      ? [...breakpoints.values()]
          .sort((a, b) => a.width - b.width)
          .map((item) => ({
            id: `viewport-${item.width}`,
            label: `${item.width}px`,
            width: item.width,
            height: 900,
            mediaQuery: `width: ${item.width}px`,
            source: item.source,
          }))
      : [
          { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
          { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
          { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
        ];

  const configuredThemes = config?.design?.themes ?? [];
  const graphThemes = configuredThemes.length
    ? configuredThemes
    : [...themes].map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) }));

  return projectDesignGraphSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    projectRoot: root,
    revision,
    tokens: [...tokens.values()],
    components: [...components.values()],
    breakpoints: graphBreakpoints,
    themes: graphThemes,
    states: config?.design?.states ?? [],
    motionPresets: [...motion.values()],
    tokenUsages,
    designSystemFindings: findings,
    indexedAt: new Date().toISOString(),
  });
}
