import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Read-only, measured design references for matching editable Figma surfaces.
// Never includes runtime credentials, page URLs or hidden session metadata.
export async function captureDesignReference(page, selector, name, artifacts) {
  const reference = await page.locator(selector).evaluate((root) => {
    const origin = root.getBoundingClientRect();
    const box = (rect) => ({
      x: rect.x - origin.x,
      y: rect.y - origin.y,
      width: rect.width,
      height: rect.height,
    });
    const properties = [
      'display',
      'position',
      'flexDirection',
      'alignItems',
      'justifyContent',
      'gap',
      'gridTemplateColumns',
      'gridTemplateRows',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'backgroundColor',
      'color',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'borderColor',
      'borderRadius',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
      'textAlign',
      'textTransform',
      'boxShadow',
      'overflow',
    ];
    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent.trim()) return null;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        return rect.width ? { type: 'text', text: node.textContent.trim(), ...box(rect) } : null;
      }
      if (!(node instanceof Element)) return null;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || !rect.width || !rect.height)
        return null;
      const result = {
        type: node.tagName.toLowerCase(),
        name: node.id || node.className?.baseVal || node.className || node.tagName.toLowerCase(),
        ...box(rect),
        style: Object.fromEntries(properties.map((key) => [key, style[key]])),
      };
      if (node instanceof SVGElement) {
        result.svg = node.outerHTML.replaceAll('currentColor', style.color);
      } else if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
        result.text = node.value || node.placeholder;
      } else {
        result.children = [...node.childNodes].map(visit).filter(Boolean);
      }
      return result;
    };
    return { format: 'foundry.measured-design-reference', version: 1, root: visit(root) };
  });
  await writeFile(join(artifacts, name + '.layout.json'), JSON.stringify(reference, null, 2));
}
