import assert from 'node:assert/strict';

export async function verifyInspectorFonts(page) {
  const result = await page.evaluate(async () => {
    const preferred = [
      ['Google Sans Flex', 'google-sans-flex.woff2', '--sans'],
      ['Google Sans Code', 'google-sans-code.woff2', '--mono'],
    ];
    const fonts = [];
    for (const [family, filename, property] of preferred) {
      const faces = await document.fonts.load(`400 12px "${family}"`, 'Foundry 44px');
      const stack = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
      fonts.push({
        family,
        loadedFaces: faces.length,
        allLoaded: faces.every((face) => face.status === 'loaded'),
        preferred: stack.split(',')[0].trim().replaceAll(/["']/g, '') === family,
        localResource: performance.getEntriesByType('resource').some((entry) => {
          const url = new URL(entry.name);
          return url.origin === location.origin && url.pathname === `/fonts/${filename}`;
        }),
      });
    }
    await document.fonts.ready;
    return fonts;
  });
  for (const font of result) {
    assert.ok(
      font.loadedFaces > 0 && font.allLoaded,
      `${font.family} must actually load a bundled face`,
    );
    assert.equal(font.preferred, true, `${font.family} must lead its inspector type stack`);
    assert.equal(
      font.localResource,
      true,
      `${font.family} must be loaded from the inspector origin`,
    );
  }
  return result;
}
