// Premium foundations are the default presentation of the redesigned workspace.
// Keep older pilot links working and an explicit, reload-scoped comparison path.
// This policy never changes session data, edit transactions or stored preferences.
export function foundryFoundationsEnabled(search = globalThis.location?.search ?? '') {
  const params = new URLSearchParams(search);
  return params.get('ui') !== 'legacy' && params.get('foundations') !== 'off';
}
