// Preserve the control the user is actually using, not a remembered default.
// Keys are scoped to the current Delivery view/record by the caller.
const attributes = [
  'data-delivery-field',
  'data-delivery-record',
  'data-delivery-document',
  'data-visual-report',
];
const selectors = [
  '.delivery-record-detail > header h2',
  '.foundry-delivery-notes > summary',
  '.foundry-delivery-context > summary',
  '.foundry-delivery-captures > summary',
  '.foundry-delivery-document-source > summary',
  '[data-next-save-narrative]',
  '[data-next-reset-narrative]',
  '#delivery-create-milestone',
];

export function captureDeliveryFocus(content) {
  const element = content.ownerDocument.activeElement;
  if (!element || !content.contains(element)) return null;
  const attribute = attributes.find((name) => element.hasAttribute(name));
  const selector = attribute ? `[${attribute}]` : selectors.find((value) => element.matches(value));
  if (!selector) return null;
  return {
    element,
    selector,
    attribute,
    value: attribute ? element.getAttribute(attribute) : null,
    tabIndex: element.getAttribute('tabindex'),
    start: element.selectionStart,
    end: element.selectionEnd,
    direction: element.selectionDirection,
  };
}

export function restoreDeliveryFocus(content, snapshot) {
  if (!snapshot || snapshot.element.isConnected) return false;
  const doc = content.ownerDocument;
  // A replacement normally leaves focus on BODY. Never override a new focus owner.
  if (doc.activeElement !== doc.body) return false;
  const matches = [...content.querySelectorAll(snapshot.selector)].filter(
    (element) => !snapshot.attribute || element.getAttribute(snapshot.attribute) === snapshot.value,
  );
  if (matches.length !== 1) return false;
  const element = matches[0];
  if (element.disabled || element.closest('[hidden], [inert]') || !element.getClientRects().length)
    return false;
  if (snapshot.tabIndex === '-1') element.tabIndex = -1;
  element.focus({ preventScroll: true });
  if (typeof snapshot.start === 'number' && typeof element.setSelectionRange === 'function')
    element.setSelectionRange(snapshot.start, snapshot.end, snapshot.direction ?? 'none');
  return doc.activeElement === element;
}
