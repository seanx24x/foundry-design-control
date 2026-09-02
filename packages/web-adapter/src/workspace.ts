export type FoundryUtility = 'health' | 'memory' | null;
export type InterfaceThemePreference = 'system' | 'light' | 'dark';
export type ResolvedInterfaceTheme = 'light' | 'dark';

export function resolveInterfaceTheme(
  preference: InterfaceThemePreference,
  systemPrefersDark: boolean,
): ResolvedInterfaceTheme {
  return preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference;
}

export interface FoundryWorkspaceState {
  layersOpen: boolean;
  inspectorOpen: boolean;
  utility: FoundryUtility;
  changeSummaryVisible: boolean;
  reviewOpen: boolean;
  workbenchOpen: boolean;
  comparisonOpen: boolean;
}

export type FoundryWorkspaceAction =
  | { type: 'toggle-layers'; open?: boolean }
  | { type: 'toggle-inspector'; open?: boolean }
  | { type: 'open-utility'; utility: Exclude<FoundryUtility, null> }
  | { type: 'close-utility' }
  | { type: 'set-change-summary'; visible: boolean }
  | { type: 'set-review'; open: boolean }
  | { type: 'set-workbench'; open: boolean }
  | { type: 'set-comparison'; open: boolean };

export interface FoundryRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FoundryRectBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const DEFAULT_WORKSPACE_STATE: FoundryWorkspaceState = {
  layersOpen: true,
  inspectorOpen: true,
  utility: null,
  changeSummaryVisible: false,
  reviewOpen: false,
  workbenchOpen: false,
  comparisonOpen: false,
};

export function updateWorkspace(
  state: FoundryWorkspaceState,
  action: FoundryWorkspaceAction,
): FoundryWorkspaceState {
  if (action.type === 'toggle-layers') {
    return { ...state, layersOpen: action.open ?? !state.layersOpen };
  }
  if (action.type === 'toggle-inspector') {
    return { ...state, inspectorOpen: action.open ?? !state.inspectorOpen };
  }
  if (action.type === 'open-utility') {
    return { ...state, utility: state.utility === action.utility ? null : action.utility };
  }
  if (action.type === 'close-utility') return { ...state, utility: null };
  if (action.type === 'set-change-summary') {
    return {
      ...state,
      changeSummaryVisible: action.visible,
      reviewOpen: action.visible ? state.reviewOpen : false,
    };
  }
  if (action.type === 'set-review') return { ...state, reviewOpen: action.open };
  if (action.type === 'set-workbench') return { ...state, workbenchOpen: action.open };
  return { ...state, comparisonOpen: action.open };
}

export function clampUtilityRect(
  rect: FoundryRect,
  bounds: FoundryRectBounds,
  minimum = { width: 280, height: 280 },
): FoundryRect {
  const availableWidth = Math.max(minimum.width, bounds.right - bounds.left);
  const availableHeight = Math.max(minimum.height, bounds.bottom - bounds.top);
  const width = Math.min(Math.max(rect.width, minimum.width), availableWidth);
  const height = Math.min(Math.max(rect.height, minimum.height), availableHeight);
  return {
    x: Math.min(Math.max(rect.x, bounds.left), Math.max(bounds.left, bounds.right - width)),
    y: Math.min(Math.max(rect.y, bounds.top), Math.max(bounds.top, bounds.bottom - height)),
    width,
    height,
  };
}
