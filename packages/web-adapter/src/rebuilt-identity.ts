export interface FrozenVerificationTarget {
  id: string;
  componentPath: string[];
  source?: { file: string; line?: number; column?: number; symbol?: string };
  locator?: Record<string, unknown>;
}

export interface RenderedVerificationIdentity {
  foundryId?: string;
  componentPath: string[];
  source?: { file: string; line?: number; column?: number; symbol?: string };
}

export function rebuiltTargetIdentityMatches(
  frozen: FrozenVerificationTarget,
  rendered: RenderedVerificationIdentity,
): boolean {
  const expectedFoundryId =
    typeof frozen.locator?.foundryId === 'string' ? frozen.locator.foundryId : undefined;
  if (expectedFoundryId || rendered.foundryId) {
    if (
      !expectedFoundryId ||
      rendered.foundryId !== expectedFoundryId ||
      frozen.id !== expectedFoundryId
    ) {
      return false;
    }
    if (!frozen.source && frozen.componentPath.length === 0) return true;
    if (JSON.stringify(rendered.componentPath) !== JSON.stringify(frozen.componentPath)) {
      return false;
    }
    if (!frozen.source) return true;
    return Boolean(
      rendered.source &&
      rendered.source.file === frozen.source.file &&
      rendered.source.line === frozen.source.line &&
      rendered.source.column === frozen.source.column &&
      rendered.source.symbol === frozen.source.symbol,
    );
  }
  if (!frozen.source?.file || !frozen.source.line || !rendered.source) return false;
  return (
    rendered.source.file === frozen.source.file &&
    rendered.source.line === frozen.source.line &&
    rendered.source.column === frozen.source.column &&
    rendered.source.symbol === frozen.source.symbol &&
    JSON.stringify(rendered.componentPath) === JSON.stringify(frozen.componentPath)
  );
}
