// Foundry's internal UI system. Product-native values are never read or rewritten here.
export const uiSystemRevision = 'studio-2026-11-03';
export const geometry = Object.freeze({
  radiusCompact: 4,
  radiusControl: 8,
  radiusFloating: 12,
  radiusDialog: 12,
  controlHeight: 32,
  compactTarget: 24,
  fieldGap: 8,
  fieldRowGap: 8,
  labelGap: 4,
  sectionInset: 16,
  focusWidth: 2,
  focusOffset: 2,
  selectionWidth: 1,
  dividerWidth: 1,
});
export const palettes = Object.freeze({
  light: {
    canvas: '#F1F1F1',
    panel: '#FBFBFB',
    field: '#F2F2F2',
    hover: '#E9E9E9',
    ink: '#202020',
    muted: '#686868',
    divider: '#E3E3E3',
    boundary: '#D4D4D4',
    control: '#858585',
    accent: '#3157FF',
    focus: '#3157FF',
    selected: '#E7E7E7',
    selectionInk: '#202020',
    chrome: '#FBFBFB',
    elevated: '#FFFFFF',
    success: '#217344',
    warning: '#855A12',
    error: '#B83030',
    shadow: '0 12px 32px #0000001A, 0 1px 4px #0000000A',
  },
  dark: {
    canvas: '#090909',
    panel: '#0E0E0E',
    field: '#161616',
    hover: '#222222',
    ink: '#F5F5F5',
    muted: '#A3A3A3',
    divider: '#FFFFFF0E',
    boundary: '#FFFFFF1A',
    control: '#858585',
    accent: '#3157FF',
    focus: '#8295FF',
    selected: '#292929',
    selectionInk: '#F5F5F5',
    chrome: '#0E0E0E',
    elevated: '#101010',
    success: '#82CEA1',
    warning: '#E6BB70',
    error: '#F79797',
    shadow: '0 20px 55px #00000090, 0 1px 4px #00000040',
  },
});
export const shell = Object.freeze({
  background: '#0E0E0E',
  ink: '#F5F5F5',
  muted: '#A3A3A3',
  subtle: '#999999',
  hover: '#1C1C1C',
  selected: '#292929',
  focus: '#8295FF',
});
export const typeRoles = Object.freeze([
  ['control', 12, 20, 400],
  ['navigation', 12, 20, 500],
  ['section', 12, 20, 500],
  ['metadata', 11, 18, 400],
  ['footnote', 10, 16, 400],
  ['documentTitle', 18, 26, 550],
  ['documentSection', 12, 20, 550],
  ['brand', 13, 20, 600],
  ['touchEntry', 16, 20, 400],
]);
const kebab = (value) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
const block = (selector, values) =>
  `${selector} {\n${Object.entries(values)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')}\n}`;
export function makeUIThemeCSS() {
  const base = {};
  for (const [key, value] of Object.entries(geometry)) base[`--fd-${kebab(key)}`] = `${value}px`;
  for (const [key, value] of Object.entries({
    field: '#161616',
    hover: '#222222',
    control: '#858585',
    divider: '#FFFFFF0E',
    boundary: '#FFFFFF1A',
  }))
    base[`--fd-sidebar-${key}`] = value;
  Object.assign(base, {
    '--fd-overlay-selection': '#3157FF',
    '--fd-overlay-ink': '#FFFFFF',
    '--fd-font-sans': "'Foundry Geist', Arial, sans-serif",
    '--fd-font-code': "'Foundry Code', monospace",
    '--fd-icon-size': '16px',
    '--fd-icon-stroke': 2,
    '--fd-property-stroke': 4 / 3,
  });
  for (const [id, size, line, weight] of typeRoles) {
    base[`--fd-type-${kebab(id)}-size`] = `${size}px`;
    base[`--fd-type-${kebab(id)}-line`] = `${line}px`;
    base[`--fd-type-${kebab(id)}-weight`] = weight;
  }
  for (const key of [
    'radiusCompact',
    'radiusControl',
    'radiusFloating',
    'radiusDialog',
    'controlHeight',
    'fieldGap',
    'fieldRowGap',
    'sectionInset',
  ])
    base[`--${kebab(key)}`] = `var(--fd-${kebab(key)})`;
  const output = [
    `/* Generated from ui-system.mjs (${uiSystemRevision}). Do not edit. */`,
    block(':root[data-foundry-pilot]', base),
  ];
  for (const [theme, colors] of Object.entries(palettes)) {
    const values = {};
    for (const [key, value] of Object.entries(colors)) {
      values[`--fd-color-${kebab(key)}`] = value;
      values[`--${key}`] = `var(--fd-color-${kebab(key)})`;
    }
    for (const [key, value] of Object.entries({
      ...shell,
      page: colors.canvas,
    }))
      values[`--fd-shell-${key}`] = value;
    output.push(
      block(
        theme === 'light'
          ? ':root[data-foundry-pilot], :root[data-foundry-pilot][data-theme="light"]'
          : ':root[data-foundry-pilot][data-theme="dark"]',
        values,
      ),
    );
  }
  return output.join('\n\n') + '\n';
}
