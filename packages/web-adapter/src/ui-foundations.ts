export const FOUNDRY_UI_GRID = 4;

export const FOUNDRY_UI_ICON_SIZES = [12, 16, 20] as const;
export const FOUNDRY_UI_CONTROL_SIZES = [32, 36, 40, 44, 48] as const;
export const FOUNDRY_UI_RADII = [0, 4, 8, 12, 16, 20, 24, 32] as const;
export const FOUNDRY_UI_TYPE_SIZES = [8, 12, 16, 20, 24, 28, 32, 40, 48, 64, 68, 76] as const;

export const FOUNDRY_UI_FOUNDATION_CSS = `
  :host {
    --fdc-space-1:4px;
    --fdc-space-2:8px;
    --fdc-space-3:12px;
    --fdc-space-4:16px;
    --fdc-space-5:20px;
    --fdc-space-6:24px;
    --fdc-space-7:28px;
    --fdc-space-8:32px;
    --fdc-radius-xs:4px;
    --fdc-radius-sm:8px;
    --fdc-radius-md:12px;
    --fdc-radius-lg:16px;
    --fdc-control-sm:32px;
    --fdc-control-md:36px;
    --fdc-control-lg:40px;
    --fdc-icon-sm:12px;
    --fdc-icon-md:16px;
    --fdc-icon-lg:20px;
    --fdc-type-caption:12px;
    --fdc-type-body:16px;
    --fdc-type-heading:20px;
  }
`;

export function nearestFoundryGridValue(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return 0;
  const direction = value < 0 ? -1 : 1;
  return (
    direction *
    Math.floor((Math.abs(value) + FOUNDRY_UI_GRID / 2) / FOUNDRY_UI_GRID) *
    FOUNDRY_UI_GRID
  );
}
