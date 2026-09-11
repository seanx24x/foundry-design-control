import { verificationValueMatches } from 'foundry-design-protocol';

export function rebuiltPropertyValueMatches(
  property: string,
  rendered: unknown,
  expected: unknown,
): boolean {
  return verificationValueMatches(property, rendered, expected);
}
