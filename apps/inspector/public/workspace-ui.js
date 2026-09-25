// The redesigned workspace is the default. Only an explicit legacy request
// opts out; old ui=next links and unrecognized values still open the current UI.
export function resolveWorkspaceUI(search) {
  return new URLSearchParams(search).get('ui') === 'legacy' ? 'legacy' : 'next';
}
