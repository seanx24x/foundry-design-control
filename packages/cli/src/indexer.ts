import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import {
  PROTOCOL_VERSION,
  projectDesignGraphSchema,
  type ComponentDefinition,
  type DesignToken,
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

  for (const path of files) {
    const content = await readFile(path, 'utf8').catch(() => '');
    const file = relative(root, path).replaceAll('\\', '/');
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
    indexedAt: new Date().toISOString(),
  });
}
