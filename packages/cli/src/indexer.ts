import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import {
  PROTOCOL_VERSION,
  projectDesignGraphSchema,
  type ComponentDefinition,
  type ComponentVariantAxis,
  type ContainerQueryDefinition,
  type DesignSystemFinding,
  type DesignToken,
  type DesignTokenUsage,
  type MotionPreset,
  type ProjectDesignGraph,
  type TokenPromotionCandidate,
  type ThemeDefinition,
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
  '.html',
]);

const STYLESHEET_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less']);

type StylesheetSegment = { content: string; offset: number };

function stylesheetSegments(file: string, content: string): StylesheetSegment[] {
  const extension = extname(file).toLowerCase();
  if (STYLESHEET_EXTENSIONS.has(extension)) return [{ content, offset: 0 }];

  const segments: StylesheetSegment[] = [];
  const appendMatches = (pattern: RegExp): void => {
    for (const match of content.matchAll(pattern)) {
      const body = match[1];
      if (!body || match.index == null) continue;
      const bodyOffset = match[0].indexOf(body);
      segments.push({ content: body, offset: match.index + Math.max(0, bodyOffset) });
    }
  };

  if (extension === '.html') {
    appendMatches(/<style\b[^>]*>([\s\S]*?)<\/style>/gi);
  } else if (/\.[cm]?[jt]sx?$/.test(file)) {
    appendMatches(
      /\b(?:css|createGlobalStyle|styled(?:\.[A-Za-z_$][\w$]*|\([^)]*\)))\s*`([\s\S]*?)`/g,
    );
  }
  return segments;
}

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

function tokenComparableValue(token: DesignToken): string {
  return token.resolvedValue ?? token.value;
}

function aliasTarget(value: string): string | undefined {
  return /^var\(\s*(--[\w-]+)(?:\s*,[^)]*)?\s*\)$/.exec(value.trim())?.[1];
}

function resolveTokenAliases(tokens: Map<string, DesignToken>): void {
  type AliasResolution = {
    aliasChain: string[];
    aliasStatus: 'direct' | 'resolved' | 'broken' | 'circular';
    resolvedValue?: string;
  };
  const resolve = (token: DesignToken, trail: string[] = []): AliasResolution => {
    const targetName = aliasTarget(token.value);
    if (!targetName)
      return { aliasChain: [token.name], aliasStatus: 'direct', resolvedValue: token.value };
    if (trail.includes(token.name)) {
      return { aliasChain: [...trail, token.name], aliasStatus: 'circular' };
    }
    const target = tokens.get(targetName);
    if (!target) return { aliasChain: [token.name, targetName], aliasStatus: 'broken' };
    const resolved = resolve(target, [...trail, token.name]);
    return {
      aliasChain: [token.name, ...resolved.aliasChain.filter((name) => name !== token.name)],
      aliasStatus: resolved.aliasStatus === 'direct' ? 'resolved' : resolved.aliasStatus,
      resolvedValue: resolved.resolvedValue,
    };
  };

  for (const token of tokens.values()) {
    const targetName = aliasTarget(token.value);
    if (targetName) {
      token.aliasOfTokenName = targetName;
      const target = tokens.get(targetName);
      token.aliasOfTokenId = target?.id;
      if (token.category === 'other' && target) token.category = target.category;
    }
    Object.assign(token, resolve(token));
  }
}

function promotionTokenName(
  category: DesignToken['category'],
  property: string,
  value: string,
): string {
  const propertySlug = property
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const valueSlug = value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replaceAll('.', '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `--${category}-${propertySlug || 'value'}${valueSlug ? `-${valueSlug}` : ''}`;
}

function objectNumber(source: string, property: string): number | undefined {
  const match = new RegExp(`\\b${property}\\s*:\\s*(-?[\\d.]+)`).exec(source);
  const value = Number(match?.[1]);
  return Number.isFinite(value) ? value : undefined;
}

function objectString(source: string, property: string): string | undefined {
  const quoted = new RegExp(`\\b${property}\\s*:\\s*['\"]([^'\"]+)['\"]`).exec(source);
  if (quoted?.[1]) return quoted[1];
  const array = new RegExp(`\\b${property}\\s*:\\s*\\[([^\\]]+)\\]`).exec(source);
  if (!array?.[1]) return undefined;
  const values = array[1]
    .split(',')
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite);
  return values.length === 4 ? `cubic-bezier(${values.join(', ')})` : undefined;
}

function nativeMotionPresets(file: string, content: string): MotionPreset[] {
  const presets: MotionPreset[] = [];
  const push = (
    adapter: 'motion' | 'gsap' | 'react-spring',
    label: string,
    sourceProperty: string,
    index: number,
    body: string,
  ): void => {
    const seconds = adapter !== 'react-spring';
    const duration = objectNumber(body, 'duration');
    const delay = objectNumber(body, 'delay');
    const easing =
      objectString(body, adapter === 'gsap' ? 'ease' : 'ease') ?? objectString(body, 'easing');
    const configuration = Object.fromEntries(
      [
        'type',
        'mass',
        'stiffness',
        'damping',
        'tension',
        'friction',
        'velocity',
        'repeat',
        'repeatType',
        'yoyo',
      ]
        .map((property) => [property, objectNumber(body, property) ?? objectString(body, property)])
        .filter((entry): entry is [string, string | number] => entry[1] != null),
    );
    presets.push({
      id: stableId('mot', `${file}:${index}:${adapter}`),
      label,
      duration: duration == null ? undefined : seconds ? duration * 1000 : duration,
      delay: delay == null ? undefined : seconds ? delay * 1000 : delay,
      easing,
      adapter,
      sourceProperty,
      configuration,
      source: { file, line: lineAt(content, index) },
      evidence: [`${adapter} source import`, `${sourceProperty} authoring site`],
    });
  };

  if (/from\s+['\"](?:motion\/react|framer-motion)['\"]/.test(content)) {
    for (const match of content.matchAll(/<motion\.([A-Za-z][\w]*)\b([\s\S]*?)>/g)) {
      const body = match[2] ?? '';
      if (!/\b(?:animate|transition|variants)\s*=/.test(body)) continue;
      push('motion', `Motion ${match[1]}`, 'transition', match.index ?? 0, body);
    }
  }
  if (/from\s+['\"]gsap['\"]|require\(['\"]gsap['\"]\)/.test(content)) {
    for (const match of content.matchAll(
      /gsap\.(to|from|fromTo|set)\s*\(([\s\S]{0,1200}?)\)\s*[;,]/g,
    )) {
      push('gsap', `GSAP ${match[1]} tween`, 'vars', match.index ?? 0, match[2] ?? '');
    }
  }
  if (/from\s+['\"](?:@react-spring\/web|react-spring)['\"]/.test(content)) {
    for (const match of content.matchAll(
      /\b(useSpring|useTransition|useTrail)\s*\(([\s\S]{0,1200}?)\)\s*[;,]/g,
    )) {
      push(
        'react-spring',
        `React Spring ${match[1]}`,
        match[1] === 'useSpring' ? 'config' : (match[1] ?? 'config'),
        match.index ?? 0,
        match[2] ?? '',
      );
    }
  }
  return presets;
}

function balancedObject(
  content: string,
  openIndex: number,
): { body: string; start: number; end: number } | null {
  if (content[openIndex] !== '{') return null;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = openIndex; index < content.length; index += 1) {
    const char = content[index]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0)
      return { body: content.slice(openIndex + 1, index), start: openIndex, end: index };
  }
  return null;
}

function objectProperty(
  content: string,
  property: string,
  offset = 0,
): { body: string; start: number; end: number } | null {
  const match = new RegExp(`(?:^|[,\\s])${property}\\s*:\\s*\\{`, 'm').exec(content.slice(offset));
  if (!match) return null;
  const openIndex = offset + match.index + match[0].lastIndexOf('{');
  return balancedObject(content, openIndex);
}

function topLevelObjectKeys(content: string): Array<{ key: string; index: number }> {
  const keys: Array<{ key: string; index: number }> = [];
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{' || char === '[' || char === '(') depth += 1;
    if (char === '}' || char === ']' || char === ')') depth -= 1;
    if (depth !== 0) continue;
    const match = /^\s*(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$-]*))\s*:/.exec(content.slice(index));
    const key = match?.[1] ?? match?.[2];
    if (!key || keys.some((item) => item.key === key)) continue;
    keys.push({ key, index });
    index += (match?.[0].length ?? 1) - 1;
  }
  return keys;
}

function sourceVariantAxes(file: string, content: string): ComponentVariantAxis[] {
  const axes: ComponentVariantAxis[] = [];
  for (const cva of content.matchAll(/\bcva\s*\(/g)) {
    const configOpen = content.indexOf('{', cva.index ?? 0);
    const config = configOpen >= 0 ? balancedObject(content, configOpen) : null;
    if (!config) continue;
    const variants = objectProperty(config.body, 'variants');
    if (!variants) continue;
    for (const axisKey of topLevelObjectKeys(variants.body)) {
      const axisOpen = variants.body.indexOf('{', axisKey.index);
      const axis = axisOpen >= 0 ? balancedObject(variants.body, axisOpen) : null;
      if (!axis) continue;
      const values = topLevelObjectKeys(axis.body).map((item) => item.key);
      if (!values.length) continue;
      const absolute = config.start + 1 + variants.start + 1 + axisOpen;
      axes.push({
        id: stableId('axis', `${file}:cva:${axisKey.key}`),
        label: axisKey.key,
        property: axisKey.key,
        values,
        adapter: 'cva',
        source: { file, line: lineAt(content, absolute) },
        sourceProperty: `variants.${axisKey.key}`,
        canCreate: true,
        evidence: ['CVA variants object', `Writable ${axisKey.key} option map`],
      });
    }
  }
  for (const match of content.matchAll(
    /\b([A-Za-z_$][\w$]*)\??\s*:\s*((?:['"][^'"]+['"]\s*\|\s*)+['"][^'"]+['"])/g,
  )) {
    const property = match[1]!;
    const values = [...match[2]!.matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]!);
    if (values.length < 2 || axes.some((axis) => axis.property === property)) continue;
    axes.push({
      id: stableId('axis', `${file}:typescript:${property}`),
      label: property,
      property,
      values,
      adapter: 'typescript',
      source: { file, line: lineAt(content, match.index ?? 0) },
      sourceProperty: property,
      canCreate: true,
      evidence: ['TypeScript string union', `Writable ${property} prop type`],
    });
  }
  return axes;
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
  const containerQueries = new Map<string, ContainerQueryDefinition>();
  const themes = new Map<string, ThemeDefinition>();
  const motion = new Map<string, MotionPreset>();
  const storyVariants = new Map<string, ComponentDefinition['variants']>();
  const axesByFile = new Map<string, ComponentVariantAxis[]>();
  const documents: Array<{
    file: string;
    content: string;
    stylesheets: StylesheetSegment[];
  }> = [];

  for (const path of files) {
    const content = await readFile(path, 'utf8').catch(() => '');
    const file = relative(root, path).replaceAll('\\', '/');
    const stylesheets = stylesheetSegments(file, content);
    documents.push({ file, content, stylesheets });
    for (const preset of nativeMotionPresets(file, content)) motion.set(preset.id, preset);
    for (const stylesheet of stylesheets) {
      for (const match of stylesheet.content.matchAll(/(--[\w-]+)\s*:\s*([^;}\n]+)/g)) {
        const name = match[1]!;
        const value = match[2]!.trim();
        if (!value || value.includes('${') || value.includes('\\s*')) continue;
        const index = stylesheet.offset + (match.index ?? 0);
        const declarations = [
          ...(tokens.get(name)?.declarations ?? []),
          { value, source: { file, line: lineAt(content, index) } },
        ];
        tokens.set(name, {
          id: stableId('tok', name),
          name,
          value,
          category: tokenCategory(name, value),
          cssVariable: name,
          declarations,
          source: { file, line: lineAt(content, index) },
          confidence: 'instrumented',
          evidence: ['CSS custom property'],
        });
        if (/duration|motion/.test(name)) {
          const duration = /([\d.]+)m?s/.exec(value);
          motion.set(name, {
            id: stableId('mot', name),
            label: name.replace(/^--/, ''),
            duration: duration
              ? Number(duration[1]) * (value.includes('ms') ? 1 : 1000)
              : undefined,
            adapter: 'css',
            configuration: {},
            source: { file, line: lineAt(content, index) },
            evidence: ['CSS custom property'],
          });
        }
      }
      for (const match of stylesheet.content.matchAll(
        /@media\s*\([^)]*(?:min|max)-width\s*:\s*(\d+)px[^)]*\)/g,
      )) {
        const index = stylesheet.offset + (match.index ?? 0);
        const width = Number(match[1]);
        breakpoints.set(width, {
          width,
          source: { file, line: lineAt(content, index) },
        });
      }
      for (const match of stylesheet.content.matchAll(
        /@container(?:\s+([\w-]+))?\s*\(([^)]*)\)/g,
      )) {
        const name = match[1];
        const condition = match[2]!.trim();
        const min =
          /min-(?:width|inline-size)\s*:\s*([\d.]+)px/i.exec(condition)?.[1] ??
          /(?:width|inline-size)\s*>=?\s*([\d.]+)px/i.exec(condition)?.[1];
        const max =
          /max-(?:width|inline-size)\s*:\s*([\d.]+)px/i.exec(condition)?.[1] ??
          /(?:width|inline-size)\s*<=?\s*([\d.]+)px/i.exec(condition)?.[1];
        if (!min && !max) continue;
        const axis = /block-size|height/i.test(condition)
          ? 'block-size'
          : /\bsize\b/i.test(condition) && !/inline-size/i.test(condition)
            ? 'size'
            : 'inline-size';
        const id = stableId('container', `${file}:${name ?? 'anonymous'}:${condition}`);
        const index = stylesheet.offset + (match.index ?? 0);
        containerQueries.set(id, {
          id,
          label: `${name ?? 'Anonymous container'} · ${condition}`,
          ...(name ? { name } : {}),
          condition,
          axis,
          ...(min ? { minWidth: Number(min) } : {}),
          ...(max ? { maxWidth: Number(max) } : {}),
          source: { file, line: lineAt(content, index) },
          evidence: [
            'CSS @container rule',
            ...(stylesheet.content.includes('container-type')
              ? ['CSS container-type declaration']
              : []),
            ...(name && stylesheet.content.includes('container-name')
              ? ['CSS container-name declaration']
              : []),
          ],
        });
      }
    }
    for (const match of content.matchAll(/\[data-theme\s*=\s*["']?([\w-]+)["']?\]/g)) {
      const id = match[1]!;
      themes.set(id, {
        id,
        label: id[0]!.toUpperCase() + id.slice(1),
        selector: `[data-theme="${id}"]`,
        attribute: 'data-theme',
        value: id,
        source: { file, line: lineAt(content, match.index ?? 0) },
        confidence: 'instrumented',
        evidence: ['Indexed CSS data-theme selector'],
      });
    }
    for (const match of content.matchAll(/\bdata-theme\s*=\s*["']([\w-]+)["']/g)) {
      const id = match[1]!;
      if (themes.has(id)) continue;
      themes.set(id, {
        id,
        label: id[0]!.toUpperCase() + id.slice(1),
        attribute: 'data-theme',
        value: id,
        source: { file, line: lineAt(content, match.index ?? 0) },
        confidence: 'instrumented',
        evidence: ['Indexed HTML data-theme attribute'],
      });
    }
    for (const match of content.matchAll(/(?:^|\s)(\.dark)(?=\s|[{,:])/gm)) {
      if (themes.has('dark')) continue;
      themes.set('dark', {
        id: 'dark',
        label: 'Dark',
        selector: '.dark',
        source: { file, line: lineAt(content, match.index ?? 0) },
        confidence: 'instrumented',
        evidence: ['Indexed CSS class theme selector'],
      });
    }

    if (/\.(?:tsx?|jsx?|mjs|cjs)$/.test(path)) {
      axesByFile.set(file, sourceVariantAxes(file, content));
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
            adapter: 'storybook' as const,
            sourceProperty: story[1]!,
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
          variantAxes: [],
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
      component.variantAxes.push({
        id: stableId('axis', `${variants[0]?.source?.file}:storybook:story`),
        label: 'Story',
        property: 'story',
        values: variants.map((variant) => variant.value),
        adapter: 'storybook',
        source: variants[0]!.source!,
        sourceProperty: 'named export',
        canCreate: true,
        evidence: ['Storybook named exports', 'Writable story definition'],
      });
      component.evidence.push('Storybook story');
    } else if (variants[0]?.source) {
      const id = stableId('cmp', `${variants[0].source.file}:${componentName}`);
      components.set(id, {
        id,
        name: componentName,
        source: variants[0].source,
        instances: 0,
        variants,
        variantAxes: [
          {
            id: stableId('axis', `${variants[0].source.file}:storybook:story`),
            label: 'Story',
            property: 'story',
            values: variants.map((variant) => variant.value),
            adapter: 'storybook',
            source: variants[0].source,
            sourceProperty: 'named export',
            canCreate: true,
            evidence: ['Storybook named exports', 'Writable story definition'],
          },
        ],
        evidence: ['Storybook story'],
      });
    }
  }

  for (const component of components.values()) {
    const nativeAxes = axesByFile.get(component.source?.file ?? '') ?? [];
    const known = new Set(component.variantAxes.map((axis) => axis.property));
    component.variantAxes.push(...nativeAxes.filter((axis) => !known.has(axis.property)));
    for (const axis of nativeAxes) {
      for (const value of axis.values) {
        const id = stableId('var', `${component.id}:${axis.property}:${String(value)}`);
        if (component.variants.some((variant) => variant.id === id)) continue;
        component.variants.push({
          id,
          label: String(value),
          property: axis.property,
          value,
          props: { [axis.property]: value },
          source: axis.source,
          adapter: axis.adapter,
          sourceProperty: `${axis.sourceProperty}.${String(value)}`,
        });
      }
    }
    if (nativeAxes.length) component.evidence.push('Source-backed variant axis');
  }

  // Explicit project contracts let non-framework HTML components retain their
  // real authoring locations instead of borrowing an unrelated inferred export.
  for (const component of config?.design?.components ?? []) components.set(component.id, component);
  resolveTokenAliases(tokens);
  const tokenList = [...tokens.values()];
  const tokenUsages: DesignTokenUsage[] = [];
  const findings: DesignSystemFinding[] = [];
  const recurringLiterals = new Map<
    string,
    {
      value: string;
      category: DesignToken['category'];
      properties: string[];
      sources: Array<{ file: string; line: number }>;
      componentIds: string[];
    }
  >();
  const componentForSource = (file: string, line: number): ComponentDefinition | undefined =>
    [...components.values()]
      .filter(
        (component) => component.source?.file === file && (component.source.line ?? 0) <= line,
      )
      .sort((a, b) => (b.source?.line ?? 0) - (a.source?.line ?? 0))[0];

  for (const { file, content, stylesheets } of documents) {
    for (const stylesheet of stylesheets) {
      for (const match of stylesheet.content.matchAll(/var\(\s*(--[\w-]+)(?:\s*,[^)]*)?\)/g)) {
        const token = tokens.get(match[1]!);
        if (!token) continue;
        const index = stylesheet.offset + (match.index ?? 0);
        const line = lineAt(content, index);
        const lineStart = content.lastIndexOf('\n', index) + 1;
        const declarationPrefix = content.slice(lineStart, index);
        const alias = /--[\w-]+\s*:\s*$/.test(declarationPrefix);
        const component = componentForSource(file, line);
        tokenUsages.push({
          id: stableId('use', `${file}:${index}:${token.id}`),
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

      for (const match of stylesheet.content.matchAll(/([a-zA-Z][\w-]*)\s*:\s*([^;\n},]+)[;},]/g)) {
        const property = match[1]!;
        const value = match[2]!.trim();
        if (property.startsWith('--') || value.includes('var(')) continue;
        const category = declarationCategory(property, value);
        if (!category) continue;
        const categoryTokens = tokenList.filter((token) => token.category === category);
        const exact = categoryTokens
          .filter((token) => comparable(tokenComparableValue(token)) === comparable(value))
          .sort(
            (a, b) =>
              (b.aliasChain?.length ?? 0) - (a.aliasChain?.length ?? 0) ||
              a.name.localeCompare(b.name),
          )[0];
        const suggested =
          exact ??
          closeNumericToken(
            value,
            categoryTokens.map((token) => ({ ...token, value: tokenComparableValue(token) })),
          );
        const index = stylesheet.offset + (match.index ?? 0);
        const line = lineAt(content, index);
        const component = componentForSource(file, line);
        const recurringKey = `${category}:${comparable(value)}`;
        const recurring = recurringLiterals.get(recurringKey) ?? {
          value,
          category,
          properties: [],
          sources: [],
          componentIds: [],
        };
        recurring.properties.push(property);
        recurring.sources.push({ file, line });
        if (component?.id) recurring.componentIds.push(component.id);
        recurringLiterals.set(recurringKey, recurring);
        if (!suggested) continue;
        const usage: DesignTokenUsage = {
          id: stableId('use', `${file}:${index}:${suggested.id}:literal`),
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
  }

  const tokenPromotions: TokenPromotionCandidate[] = [...recurringLiterals.entries()]
    .filter(([, recurring]) => recurring.sources.length >= 2)
    .map(([key, recurring]): TokenPromotionCandidate => {
      const categoryTokens = tokenList.filter((token) => token.category === recurring.category);
      const exact = categoryTokens
        .filter((token) => comparable(tokenComparableValue(token)) === comparable(recurring.value))
        .sort(
          (a, b) =>
            (b.aliasChain?.length ?? 0) - (a.aliasChain?.length ?? 0) ||
            a.name.localeCompare(b.name),
        )[0];
      const near = exact
        ? undefined
        : closeNumericToken(
            recurring.value,
            categoryTokens.map((token) => ({ ...token, value: tokenComparableValue(token) })),
          );
      const suggested = exact ?? near;
      const property = [...recurring.properties].sort(
        (a, b) =>
          recurring.properties.filter((item) => item === b).length -
            recurring.properties.filter((item) => item === a).length || a.localeCompare(b),
      )[0]!;
      const sources = recurring.sources.filter(
        (source, index, all) =>
          all.findIndex(
            (candidate) => candidate.file === source.file && candidate.line === source.line,
          ) === index,
      );
      const relation = exact ? 'exact' : near ? 'near' : 'new';
      const proposedTokenName = promotionTokenName(recurring.category, property, recurring.value);
      const suggestedTokenName =
        suggested?.name ??
        (tokens.has(proposedTokenName)
          ? `${proposedTokenName}-${stableId('token-name', key).slice(-4)}`
          : proposedTokenName);
      return {
        id: stableId('promotion', key),
        value: recurring.value,
        category: recurring.category,
        property,
        occurrenceCount: sources.length,
        sources,
        componentIds: [...new Set(recurring.componentIds)],
        recommendation: suggested ? ('use-existing' as const) : ('create-token' as const),
        relation,
        suggestedTokenId: suggested?.id,
        suggestedTokenName,
        suggestedValue: suggested ? `var(${suggested.name})` : recurring.value,
        aliasChain: suggested?.aliasChain ?? [],
        canStage: sources.length > 0,
        blockers: [],
        evidence: [
          `${sources.length} authored literal occurrences`,
          ...(suggested
            ? [
                relation === 'exact'
                  ? 'Resolved value matches an existing project token'
                  : 'Nearest compatible project token requires explicit review',
              ]
            : ['No compatible project token exists; create one before replacing usages']),
          ...(suggested?.aliasStatus === 'resolved'
            ? [`Preserves alias chain ${(suggested.aliasChain ?? []).join(' → ')}`]
            : []),
        ],
      };
    })
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.value.localeCompare(b.value));

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
    ? configuredThemes.map((theme) => ({
        ...theme,
        confidence: theme.confidence ?? 'instrumented',
        evidence: theme.evidence ?? ['Configured Foundry theme hook'],
      }))
    : [...themes.values()];

  return projectDesignGraphSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    projectRoot: root,
    revision,
    tokens: [...tokens.values()],
    components: [...components.values()],
    breakpoints: graphBreakpoints,
    containerQueries: [...containerQueries.values()].sort(
      (a, b) => (a.minWidth ?? a.maxWidth ?? 0) - (b.minWidth ?? b.maxWidth ?? 0),
    ),
    themes: graphThemes,
    states: config?.design?.states ?? [],
    motionPresets: [...motion.values()],
    tokenUsages,
    designSystemFindings: findings,
    tokenPromotions,
    indexedAt: new Date().toISOString(),
  });
}
