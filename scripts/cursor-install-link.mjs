import { isDeepStrictEqual } from 'node:util';

const CURSOR_INSTALL_BASE = 'cursor://anysphere.cursor-deeplink/mcp/install';
const FOUNDRY_SERVER_NAME = 'foundry-design-control';
const RUNTIME_URL = 'http://127.0.0.1:4387';
const CURSOR_INSTALL_PATTERN =
  /cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=foundry-design-control&config=[^),\s]+/g;

function requireVersion(version) {
  if (typeof version !== 'string' || !version.trim()) {
    throw new Error('A Foundry release version is required for the Cursor install link');
  }
}

export function buildCursorInstallConfig(version) {
  requireVersion(version);
  return {
    command: 'npx',
    args: ['-y', '--prefer-online', `foundry-design-mcp-server@${version}`],
    env: { FOUNDRY_DESIGN_RUNTIME_URL: RUNTIME_URL },
  };
}

export function buildCursorInstallUrl(version) {
  const encoded = Buffer.from(JSON.stringify(buildCursorInstallConfig(version)), 'utf8').toString(
    'base64',
  );
  return `${CURSOR_INSTALL_BASE}?name=${FOUNDRY_SERVER_NAME}&config=${encodeURIComponent(encoded)}`;
}

export function cursorInstallUrls(markdown) {
  return [...String(markdown).matchAll(CURSOR_INSTALL_PATTERN)].map((match) => match[0]);
}

export function parseCursorInstallUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('The Cursor install link is not a valid URL');
  }
  if (
    parsed.protocol !== 'cursor:' ||
    parsed.hostname !== 'anysphere.cursor-deeplink' ||
    parsed.pathname !== '/mcp/install' ||
    parsed.searchParams.get('name') !== FOUNDRY_SERVER_NAME
  ) {
    throw new Error('The Cursor install link does not target Foundry MCP installation');
  }
  const base64 = parsed.searchParams.get('config') ?? '';
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('The Cursor install link has invalid base64 configuration');
  }
  let decoded;
  try {
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.toString('base64') !== base64) throw new Error('Non-canonical base64');
    decoded = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('The Cursor install link has invalid JSON configuration');
  }
  return decoded;
}

export function validateCursorInstallUrl(url, version, owner = 'Document') {
  const actual = parseCursorInstallUrl(url);
  const expected = buildCursorInstallConfig(version);
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${owner} Cursor configuration does not exactly match Foundry ${version}`);
  }
  if (url !== buildCursorInstallUrl(version)) {
    throw new Error(`${owner} Cursor install link is not canonically encoded`);
  }
  return actual;
}

export function validateCursorInstallDocument(markdown, version, owner = 'Document') {
  const urls = cursorInstallUrls(markdown);
  if (urls.length !== 1) {
    throw new Error(`${owner} must contain exactly one Foundry Cursor install link`);
  }
  validateCursorInstallUrl(urls[0], version, owner);
  return urls[0];
}

export function replaceCursorInstallUrl(markdown, version, owner = 'Document') {
  const urls = cursorInstallUrls(markdown);
  if (urls.length !== 1) {
    throw new Error(`${owner} must contain exactly one Foundry Cursor install link`);
  }
  return String(markdown).replace(urls[0], buildCursorInstallUrl(version));
}
