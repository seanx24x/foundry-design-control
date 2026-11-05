// Original Foundry property diagrams, refined for the isolated Lucide study.
// Copyright (c) 2026 Sean Lynch. SPDX-License-Identifier: MIT
// License notice: assets/foundry-LICENSE.txt. No application icons are replaced.

const SIZE = 16;
const STROKE = 4 / 3;
const REFERENCE_OPACITY = 0.6;
const BORDER_STROKE = 2;

export const PROPERTY_ICON_SYSTEM = Object.freeze({
  version: 1,
  family: 'Foundry property diagrams',
  scope: 'Isolated Lucide integration study',
  viewBox: '0 0 16 16',
  strokeWidth: STROKE,
  referenceOpacity: REFERENCE_OPACITY,
  linecap: 'round',
  linejoin: 'round',
  baseline: 'icon-study-foundry.json',
  baselineSource: 'apps/inspector/public/next-icons.js',
  license: 'MIT',
  licenseNotice: 'assets/foundry-LICENSE.txt',
  rationale:
    'Retain property-specific diagrams while matching the optical stroke of Lucide 24px artwork rendered at 16px.',
});

const union = (boxes) => [
  Math.min(...boxes.map((box) => box[0])),
  Math.min(...boxes.map((box) => box[1])),
  Math.max(...boxes.map((box) => box[2])),
  Math.max(...boxes.map((box) => box[3])),
];
const expand = (box, amount) => [
  box[0] - amount,
  box[1] - amount,
  box[2] + amount,
  box[3] + amount,
];
const attributes = ({
  reference = false,
  strokeWidth = STROKE,
  fill = 'none',
  stroke = 'currentColor',
} = {}) =>
  `fill="${fill}" stroke="${stroke}"${stroke === 'none' ? '' : ` stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`}${reference ? ` opacity="${REFERENCE_OPACITY}"` : ''}`;

// Bounds describe centerline/fill geometry. Ink bounds conservatively include
// the round cap/join radius. They are not a substitute for browser inspection.
const path = (d, bounds, options = {}) => ({
  body: `<path d="${d}" ${attributes(options)}/>`,
  bounds,
  inkBounds:
    options.stroke === 'none' ? [...bounds] : expand(bounds, (options.strokeWidth ?? STROKE) / 2),
});
const rect = (x, y, width, height, options = {}) => ({
  body: `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${options.radius ?? 0.5}" ${attributes(options)}/>`,
  bounds: [x, y, x + width, y + height],
  inkBounds: expand([x, y, x + width, y + height], (options.strokeWidth ?? STROKE) / 2),
});
const circle = (cx, cy, radius) => ({
  body: `<circle cx="${cx}" cy="${cy}" r="${radius}" ${attributes()}/>`,
  bounds: [cx - radius, cy - radius, cx + radius, cy + radius],
  inkBounds: expand([cx - radius, cy - radius, cx + radius, cy + radius], STROKE / 2),
});
const group = (...nodes) => ({
  body: nodes.map((node) => node.body).join(''),
  bounds: union(nodes.map((node) => node.bounds)),
  inkBounds: union(nodes.map((node) => node.inkBounds)),
});
const rotateBounds = (box, angle) => {
  const points = [
    [box[0], box[1]],
    [box[2], box[1]],
    [box[2], box[3]],
    [box[0], box[3]],
  ].map(([x, y]) =>
    angle === 90
      ? [SIZE - y, x]
      : angle === 180
        ? [SIZE - x, SIZE - y]
        : angle === 270
          ? [y, SIZE - x]
          : [x, y],
  );
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
};
const rotate = (node, angle) =>
  angle === 0
    ? node
    : {
        body: `<g transform="rotate(${angle} 8 8)">${node.body}</g>`,
        bounds: rotateBounds(node.bounds, angle),
        inkBounds: rotateBounds(node.inkBounds, angle),
      };

const width = path(
  'M2.5 4v8M13.5 4v8M2.5 8h11M5 5.5 2.5 8 5 10.5M11 5.5 13.5 8 11 10.5',
  [2.5, 4, 13.5, 12],
);
const rowGap = group(
  rect(3, 2, 10, 3, { reference: true }),
  rect(3, 11, 10, 3, { reference: true }),
  path('M8 5.5v5M6.5 7 8 5.5 9.5 7M6.5 9 8 10.5 9.5 9', [6.5, 5.5, 9.5, 10.5]),
);
const allGap = group(
  rect(2, 2, 3.5, 3.5, { reference: true }),
  rect(10.5, 2, 3.5, 3.5, { reference: true }),
  rect(2, 10.5, 3.5, 3.5, { reference: true }),
  rect(10.5, 10.5, 3.5, 3.5, { reference: true }),
  path('M8 2.5v11M2.5 8h11', [2.5, 2.5, 13.5, 13.5]),
);
const padding = (angles) =>
  group(
    rect(2.5, 2.5, 11, 11, { reference: true }),
    ...angles.map((angle) => rotate(path('M5 5h6', [5, 5, 11, 5]), angle)),
  );
const margin = (angle) =>
  group(rect(5, 5, 6, 6, { reference: true }), rotate(path('M3 2.5h10', [3, 2.5, 13, 2.5]), angle));
const corner = (angle) =>
  rotate(
    group(
      // Leave the selected corner open: no faint square corner through the curve.
      path('M9 3h4v10H3V9', [3, 3, 13, 13], { reference: true }),
      path('M3 10V7a4 4 0 0 1 4-4h3', [3, 3, 10, 10]),
    ),
    angle,
  );
const radius = rect(2.5, 2.5, 11, 11, { radius: 3.5 });

function define(key, label, description, category, drawing, changes, extra = {}) {
  if (
    drawing.inkBounds.some((value) => !Number.isFinite(value)) ||
    drawing.inkBounds[0] < 0 ||
    drawing.inkBounds[1] < 0 ||
    drawing.inkBounds[2] > SIZE ||
    drawing.inkBounds[3] > SIZE
  ) {
    throw new Error(`Property icon exceeds its native 16px bounds: ${key}`);
  }
  return Object.freeze({
    label,
    description,
    category,
    body: drawing.body,
    viewBox: '0 0 16 16',
    width: SIZE,
    height: SIZE,
    strokeWidth: STROKE,
    referenceOpacity: REFERENCE_OPACITY,
    geometryBounds: Object.freeze([...drawing.bounds]),
    inkBounds: Object.freeze([...drawing.inkBounds]),
    baselineProperty: key,
    changes: Object.freeze(changes),
    ...extra,
  });
}
const spacingChanges = [
  'Ordinary stroke matches Lucide at native 16px.',
  'Reference frame raised from 0.4 to 0.6 opacity; foreground remains full currentColor.',
  'Small reference-frame corners are rounded without changing inside/outside meaning.',
];
const cornerChanges = [
  'Selected quarter-round is isolated from an open reference frame.',
  'One geometry is rotated to preserve exact corner orientation and optical weight.',
];

export const PROPERTY_ICONS = Object.freeze({
  left: define(
    'left',
    'X position',
    'Horizontal position, represented by a drawn X rather than a close action.',
    'Position',
    path('M4 4l8 8M12 4l-8 8', [4, 4, 12, 12]),
    ['Centered X uses the shared stroke without relying on font rendering.'],
  ),
  top: define(
    'top',
    'Y position',
    'Vertical position, represented by a drawn Y.',
    'Position',
    path('M4 4l4 4 4-4M8 8v4', [4, 4, 12, 12]),
    ['Y shares the X height, center and stroke.'],
  ),
  width: define(
    'width',
    'Width',
    'Horizontal distance between two end stops.',
    'Dimensions',
    width,
    ['Preserves the established double-arrow measurement diagram.'],
  ),
  height: define(
    'height',
    'Height',
    'Vertical distance between two end stops.',
    'Dimensions',
    rotate(width, 90),
    ['Exact 90-degree rotation of Width; no independent shape drift.'],
  ),
  gap: define(
    'gap',
    'Gap',
    'Both spacing axes between four neighboring items.',
    'Spacing',
    allGap,
    [
      'Four reference items are balanced around two strong gap axes.',
      'Uses the same reference opacity as single-axis gap diagrams.',
    ],
  ),
  rowGap: define(
    'rowGap',
    'Row gap',
    'Vertical spacing between two horizontal rows.',
    'Spacing',
    rowGap,
    [
      'Horizontal reference rows retain a clear vertical measurement arrow.',
      'Bounds are brought inside a consistent 2px reference margin.',
    ],
  ),
  columnGap: define(
    'columnGap',
    'Column gap',
    'Horizontal spacing between two vertical columns.',
    'Spacing',
    rotate(rowGap, 90),
    ['Exact 90-degree rotation of Row gap retains matching spacing and optical weight.'],
  ),
  paddingTop: define(
    'paddingTop',
    'Padding top',
    'Space on the inside top edge of the reference box.',
    'Padding',
    padding([0]),
    spacingChanges,
  ),
  paddingRight: define(
    'paddingRight',
    'Padding right',
    'Space on the inside right edge of the reference box.',
    'Padding',
    padding([90]),
    spacingChanges,
  ),
  paddingBottom: define(
    'paddingBottom',
    'Padding bottom',
    'Space on the inside bottom edge of the reference box.',
    'Padding',
    padding([180]),
    spacingChanges,
  ),
  paddingLeft: define(
    'paddingLeft',
    'Padding left',
    'Space on the inside left edge of the reference box.',
    'Padding',
    padding([270]),
    spacingChanges,
  ),
  paddingHorizontal: define(
    'paddingHorizontal',
    'Horizontal padding',
    'Both inside left and right edges; horizontal spacing.',
    'Padding',
    padding([90, 270]),
    [
      ...spacingChanges,
      'Opposed vertical bars distinguish horizontal padding from vertical padding.',
    ],
  ),
  paddingVertical: define(
    'paddingVertical',
    'Vertical padding',
    'Both inside top and bottom edges; vertical spacing.',
    'Padding',
    padding([0, 180]),
    [
      ...spacingChanges,
      'Opposed horizontal bars distinguish vertical padding from horizontal padding.',
    ],
  ),
  paddingLinked: define(
    'paddingLinked',
    'All-side padding',
    'All four inside edges share a linked value.',
    'Padding',
    padding([0, 90, 180, 270]),
    [...spacingChanges, 'Four edges communicate shared padding, not a generic chain-link action.'],
  ),
  marginTop: define(
    'marginTop',
    'Margin top',
    'Space outside the top of a smaller reference box.',
    'Margin',
    margin(0),
    [...spacingChanges, 'The strong edge sits outside the smaller box, unlike padding.'],
  ),
  marginRight: define(
    'marginRight',
    'Margin right',
    'Space outside the right of a smaller reference box.',
    'Margin',
    margin(90),
    [...spacingChanges, 'The strong edge sits outside the smaller box, unlike padding.'],
  ),
  marginBottom: define(
    'marginBottom',
    'Margin bottom',
    'Space outside the bottom of a smaller reference box.',
    'Margin',
    margin(180),
    [...spacingChanges, 'The strong edge sits outside the smaller box, unlike padding.'],
  ),
  marginLeft: define(
    'marginLeft',
    'Margin left',
    'Space outside the left of a smaller reference box.',
    'Margin',
    margin(270),
    [...spacingChanges, 'The strong edge sits outside the smaller box, unlike padding.'],
  ),
  borderWidth: define(
    'borderWidth',
    'Border width',
    'Thickness of an enclosing border, not a second reference frame.',
    'Appearance',
    rect(3, 3, 10, 10, { strokeWidth: BORDER_STROKE }),
    [
      'The enclosing 2px border intentionally exceeds the ordinary stroke to depict thickness.',
      'Inset 3px geometry keeps the heavier border inside the same optical envelope.',
    ],
    {
      accentStrokeWidth: BORDER_STROKE,
      strokeException:
        'The 2px perimeter is a semantic thickness diagram, not an inconsistent family weight.',
    },
  ),
  borderRadius: define(
    'borderRadius',
    'Corner radius',
    'Rounding applied to every corner of one outline.',
    'Appearance',
    radius,
    ['Four matching 3.5px corner arcs replace the slightly tighter baseline outline.'],
  ),
  radiusLinked: define(
    'radiusLinked',
    'Linked corner radii',
    'One shared radius for all four corners.',
    'Appearance',
    radius,
    [
      'Intentionally shares Corner radius geometry; the field label and link state distinguish the control.',
    ],
    { sharesGeometryWith: 'borderRadius' },
  ),
  borderTopLeftRadius: define(
    'borderTopLeftRadius',
    'Top-left radius',
    'Quarter-round at the top-left corner.',
    'Corner radii',
    corner(0),
    cornerChanges,
  ),
  borderTopRightRadius: define(
    'borderTopRightRadius',
    'Top-right radius',
    'Quarter-round at the top-right corner.',
    'Corner radii',
    corner(90),
    cornerChanges,
  ),
  borderBottomRightRadius: define(
    'borderBottomRightRadius',
    'Bottom-right radius',
    'Quarter-round at the bottom-right corner.',
    'Corner radii',
    corner(180),
    cornerChanges,
  ),
  borderBottomLeftRadius: define(
    'borderBottomLeftRadius',
    'Bottom-left radius',
    'Quarter-round at the bottom-left corner.',
    'Corner radii',
    corner(270),
    cornerChanges,
  ),
  fontFamily: define(
    'fontFamily',
    'Font family',
    'Drawn uppercase A and lowercase a describe a typeface, not language translation.',
    'Typography',
    group(
      path('M2 12.5 5 3.5l3 9M3 9.5h4', [2, 3.5, 8, 12.5]),
      path(
        'M10 7.5c0.5-0.5 1.1-0.75 1.85-0.75 1.4 0 2.15 0.75 2.15 2v3.75M14 9.25h-2c-1.4 0-2.25 0.6-2.25 1.65 0 1 0.75 1.6 1.85 1.6 1.45 0 2.4-0.9 2.4-2.15',
        [9.75, 6.75, 14, 12.5],
      ),
    ),
    [
      'Keeps the recognizable Aa vocabulary with a balanced uppercase stem.',
      'Vector letters retain consistent rendering independently of the UI font.',
    ],
  ),
  fontSize: define(
    'fontSize',
    'Font size',
    'A larger capital T beside a smaller lowercase t conveys a type-size change.',
    'Typography',
    group(
      path('M1.75 3.5h7M5.25 3.5v9', [1.75, 3.5, 8.75, 12.5]),
      path('M12 6v4.75c0 1 0.5 1.5 1.5 1.5M10.25 8h3.5', [10.25, 6, 13.75, 12.25]),
    ),
    [
      'Lowercase t has an explicit crossbar and short curved foot; it no longer reads as two anonymous stems.',
      'Both letters use the same optical stroke; size is communicated by geometry.',
    ],
  ),
  opacity: define(
    'opacity',
    'Opacity',
    'A half-filled circle distinguishes opacity from brightness or a percentage label.',
    'Appearance',
    group(
      path('M8 2.5a5.5 5.5 0 0 0 0 11Z', [2.5, 2.5, 8, 13.5], {
        fill: 'currentColor',
        stroke: 'none',
      }),
      circle(8, 8, 5.5),
    ),
    [
      'Half-fill explicitly has no stroke; the outer circle has no fill.',
      'Each primitive owns its paint so generic outline styling cannot erase the fill.',
    ],
    {
      paintException:
        'Preserve the currentColor half-fill and stroke="none"; never apply blanket fill:none or stroke to descendants.',
    },
  ),
});
