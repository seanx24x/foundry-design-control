import { contrastRatio, nearestNumericToken } from './intelligence.js';

export type HealthCategory =
  'contrast' | 'overflow' | 'target-size' | 'accessibility' | 'motion' | 'spacing';
export type HealthSeverity = 'high' | 'medium' | 'low';

export interface HealthFixChange {
  property: string;
  value: string | number;
  unit?: string;
}

export interface HealthFinding {
  ruleId: string;
  category: HealthCategory;
  severity: HealthSeverity;
  title: string;
  description: string;
  evidence: string;
  fix?: { label: string; changes: HealthFixChange[]; token?: string };
}

export interface HealthSnapshot {
  hasVisibleText: boolean;
  color: string;
  backgroundColor: string;
  fontSize: number;
  fontWeight: number;
  interactive: boolean;
  targetSizeEligible: boolean;
  accessibleName: string;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
  overflowX: string;
  overflowY: string;
  motionDuration: number;
  reducedMotionProtected: boolean;
  layoutMode: string;
  gap: number;
  spacingTokens: Array<{ name: string; value: string }>;
  contrastFix?: { value: string; token?: string };
}

export function textContrastThreshold(fontSize: number, fontWeight: number): number {
  const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
  return largeText ? 3 : 4.5;
}

export function auditHealthSnapshot(snapshot: HealthSnapshot): HealthFinding[] {
  const findings: HealthFinding[] = [];
  if (snapshot.hasVisibleText) {
    const ratio = contrastRatio(snapshot.color, snapshot.backgroundColor);
    const threshold = textContrastThreshold(snapshot.fontSize, snapshot.fontWeight);
    if (ratio != null && ratio < threshold) {
      findings.push({
        ruleId: 'text-contrast',
        category: 'contrast',
        severity: ratio < 3 ? 'high' : 'medium',
        title: 'Text contrast is too low',
        description: `Increase contrast to at least ${threshold}:1 for this text size and weight.`,
        evidence: `${ratio}:1 measured against ${threshold}:1 required`,
        fix: snapshot.contrastFix
          ? {
              label: snapshot.contrastFix.token
                ? `Use ${snapshot.contrastFix.token}`
                : 'Use an accessible text color',
              token: snapshot.contrastFix.token,
              changes: [{ property: 'color', value: snapshot.contrastFix.value }],
            }
          : undefined,
      });
    }
  }

  const outsideViewport =
    snapshot.left < -1 ||
    snapshot.right > snapshot.viewportWidth + 1 ||
    snapshot.top < -1 ||
    snapshot.bottom > snapshot.viewportHeight + 1;
  const clipsX = ['auto', 'scroll', 'hidden', 'clip'].includes(snapshot.overflowX);
  const clipsY = ['auto', 'scroll', 'hidden', 'clip'].includes(snapshot.overflowY);
  const contentOverflow =
    (clipsX && snapshot.scrollWidth > snapshot.clientWidth + 1) ||
    (clipsY && snapshot.scrollHeight > snapshot.clientHeight + 1);
  if (outsideViewport || contentOverflow) {
    findings.push({
      ruleId: outsideViewport ? 'viewport-overflow' : 'content-overflow',
      category: 'overflow',
      severity: outsideViewport ? 'high' : 'medium',
      title: outsideViewport ? 'Content leaves the viewport' : 'Content is being clipped',
      description: outsideViewport
        ? 'Keep this element inside the current viewport or add an intentional scrolling container.'
        : 'The rendered content is larger than its available box.',
      evidence: outsideViewport
        ? `${Math.round(snapshot.left)}–${Math.round(snapshot.right)} px across a ${snapshot.viewportWidth} px viewport`
        : `${snapshot.scrollWidth} × ${snapshot.scrollHeight} content inside ${snapshot.clientWidth} × ${snapshot.clientHeight}`,
      fix:
        outsideViewport && snapshot.width > snapshot.viewportWidth
          ? {
              label: 'Constrain to the viewport',
              changes: [{ property: 'maxWidth', value: 100, unit: '%' }],
            }
          : undefined,
    });
  }

  if (snapshot.targetSizeEligible && (snapshot.width < 44 || snapshot.height < 44)) {
    const changes: HealthFixChange[] = [];
    if (snapshot.width < 44) changes.push({ property: 'minWidth', value: 44, unit: 'px' });
    if (snapshot.height < 44) changes.push({ property: 'minHeight', value: 44, unit: 'px' });
    findings.push({
      ruleId: 'target-size',
      category: 'target-size',
      severity: snapshot.width < 24 || snapshot.height < 24 ? 'high' : 'medium',
      title: 'Touch target is too small',
      description: 'Increase the interactive area without making the visible control feel heavier.',
      evidence: `${Math.round(snapshot.width)} × ${Math.round(snapshot.height)} px measured; 44 × 44 px recommended`,
      fix: { label: 'Use a 44 px minimum target', changes },
    });
  }

  if (snapshot.interactive && !snapshot.accessibleName.trim()) {
    findings.push({
      ruleId: 'accessible-name',
      category: 'accessibility',
      severity: 'high',
      title: 'Interactive element has no name',
      description: 'Add a concise accessible name that explains the action or destination.',
      evidence: 'No text, aria-label, aria-labelledby, alt text, or title was found',
    });
  }

  if (snapshot.motionDuration > 300 && !snapshot.reducedMotionProtected) {
    findings.push({
      ruleId: 'reduced-motion',
      category: 'motion',
      severity: 'medium',
      title: 'Motion has no reduced-motion fallback',
      description: 'Provide a calmer or immediate state for people who request reduced motion.',
      evidence: `${Math.round(snapshot.motionDuration)} ms motion without a matching reduced-motion rule`,
    });
  }

  if (['flex', 'grid'].includes(snapshot.layoutMode) && snapshot.gap > 0) {
    const exact = snapshot.spacingTokens.some(
      (token) => Math.abs(Number.parseFloat(token.value) - snapshot.gap) < 0.01,
    );
    const nearest = nearestNumericToken(snapshot.gap, snapshot.spacingTokens);
    if (!exact && nearest) {
      findings.push({
        ruleId: 'spacing-token',
        category: 'spacing',
        severity: 'low',
        title: 'Spacing is outside the project scale',
        description: 'Use the closest project spacing value to strengthen rhythm and consistency.',
        evidence: `${snapshot.gap}px measured; ${nearest.name} is ${nearest.value}px`,
        fix: {
          label: `Use ${nearest.name}`,
          token: nearest.name,
          changes: [{ property: 'gap', value: nearest.value, unit: 'px' }],
        },
      });
    }
  }
  return findings;
}

export function healthScore(findings: Array<Pick<HealthFinding, 'severity'>>): number {
  const penalty = findings.reduce(
    (total, finding) =>
      total + (finding.severity === 'high' ? 18 : finding.severity === 'medium' ? 9 : 4),
    0,
  );
  return Math.max(0, 100 - penalty);
}
