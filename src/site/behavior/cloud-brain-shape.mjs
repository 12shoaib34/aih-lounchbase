// Shared vector source for the animated inline SVG and its static fallback.
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const split = (points, t) => {
  const [a, b, c] = [
    mix(points[0], points[1], t),
    mix(points[1], points[2], t),
    mix(points[2], points[3], t),
  ];
  const [d, e] = [mix(a, b, t), mix(b, c, t)];
  const f = mix(d, e, t);
  return [
    [points[0], a, d, f],
    [f, e, c, points[3]],
  ];
};
const forward = (point, from, length) => {
  const scale = length / distance(point, from);
  return point.map((value, i) => value + (value - from[i]) * scale);
};

// Trim each old corner and insert a cubic fillet aligned with both endpoint
// tangents. This preserves the lobes without miter spikes or sharp corners.
function roundedPath(start, segments, radius, closed = false) {
  let previous = start;
  const cubics = segments.map(([a, b, end]) => {
    const cubic = [previous, a, b, end];
    previous = end;
    return cubic;
  });
  const trimmed = cubics.map((cubic, index) => {
    const from =
      closed || index > 0
        ? Math.min(0.18, 0.1 / (3 * distance(cubic[0], cubic[1])))
        : 0;
    const to =
      closed || index < cubics.length - 1
        ? 1 - Math.min(0.18, 0.1 / (3 * distance(cubic[2], cubic[3])))
        : 1;
    return split(split(cubic, to)[0], from / to)[1];
  });
  const result = [];
  trimmed.forEach((cubic, index) => {
    result.push(cubic.slice(1));
    const next = trimmed[(index + 1) % trimmed.length];
    if (!closed && index === trimmed.length - 1) return;
    const handle = distance(cubic[3], next[0]) * 0.36;
    result.push([
      forward(cubic[3], cubic[2], handle),
      forward(next[0], next[1], handle),
      next[0],
    ]);
  });
  return { start: trimmed[0][0], segments: result, radius, closed };
}

const outline = roundedPath(
  [0, 1.56],
  [
    [
      [-0.5, 2.05],
      [-1.35, 1.8],
      [-1.4, 0.85],
    ],
    [
      [-2.3, 0.75],
      [-2.4, -0.5],
      [-1.82, -0.78],
    ],
    [
      [-2.4, -1.1],
      [-2.1, -2.0],
      [-0.95, -1.83],
    ],
    [
      [-0.65, -2.05],
      [-0.2, -1.93],
      [0, -1.64],
    ],
    [
      [0.25, -1.99],
      [0.7, -2.0],
      [0.95, -1.82],
    ],
    [
      [2.15, -1.96],
      [2.4, -0.95],
      [1.84, -0.75],
    ],
    [
      [2.45, -0.35],
      [2.35, 0.8],
      [1.43, 0.87],
    ],
    [
      [1.35, 1.85],
      [0.5, 2.03],
      [0, 1.56],
    ],
  ],
  0.011,
  true,
);

// Attach branches to actual rounded curves with shared endpoints and tangents.
const attachment = (path, index, t) => {
  const start = index ? path.segments[index - 1][2] : path.start;
  const part = split([start, ...path.segments[index]], t)[0];
  const point = part[3];
  const length = distance(point, part[2]);
  return {
    point,
    tangent: point.map((value, axis) => (value - part[2][axis]) / length),
    path,
    index,
    t,
  };
};
const handle = (join, amount) =>
  join.point.map((value, axis) => value + join.tangent[axis] * amount);
const top = attachment(outline, 0, 0.025);
const bottom = attachment(outline, 6, 0.55);
const lowerLeft = attachment(outline, 4, 0.98);
const lowerRight = attachment(outline, 10, 0.02);
const spine = roundedPath(
  top.point,
  [
    [handle(top, -0.32), [0.16, 0.9], [0.16, 0.59]],
    [
      [0.15, 0.15],
      [0.52, 0.15],
      [0.52, -0.12],
    ],
    [
      [0.52, -0.4],
      [0.18, -0.35],
      [0.04, -0.75],
    ],
    [[-0.09, -1.1], handle(bottom, 0.28), bottom.point],
  ],
  0.009,
);
const upperLeft = attachment(spine, 6, 0.08);
const upperRight = attachment(spine, 4, 0.65);
export const cloudPaths = [
  outline,
  spine,
  roundedPath(
    [-0.77, 0.55],
    [[[-0.77, -0.2], handle(upperLeft, -0.3), upperLeft.point]],
    0.009,
  ),
  roundedPath(
    [0.93, 0.18],
    [[[0.93, -0.12], handle(upperRight, -0.25), upperRight.point]],
    0.009,
  ),
  roundedPath(
    [-0.85, -0.74],
    [
      [
        [-0.62, -0.74],
        [-0.35, -0.73],
        [-0.35, -1.1],
      ],
      [[-0.35, -1.65], handle(lowerLeft, 0.34), lowerLeft.point],
    ],
    0.009,
  ),
  roundedPath(
    [0.65, -1.05],
    [
      [
        [0.18, -1.05],
        [0.18, -1.3],
        [0.35, -1.58],
      ],
      [[0.54, -1.81], handle(lowerRight, -0.3), lowerRight.point],
    ],
    0.009,
  ),
];
export const cloudJunctions = [
  { branch: 1, end: "start", join: top },
  { branch: 1, end: "end", join: bottom },
  { branch: 2, end: "end", join: upperLeft },
  { branch: 3, end: "end", join: upperRight },
  { branch: 4, end: "end", join: lowerLeft },
  { branch: 5, end: "end", join: lowerRight },
];
export const cloudTerminals = [
  [-0.77, 0.75],
  [0.93, 0.38],
  [-1.05, -0.74],
  [0.85, -1.05],
];
export const terminalRadius = 0.01;

export function cloudPathData({ start, segments, closed }) {
  const point = (p) => p.map((n) => Number(n.toFixed(6))).join(" ");
  return `M${point(start)}${segments.map((s) => `C${s.map(point).join(" ")}`).join("")}${closed ? "Z" : ""}`;
}
export function cloudFallbackSvg() {
  const paths = cloudPaths
    .map(
      (path) =>
        `<path stroke-width="${path.radius * 2}" d="${cloudPathData(path)}"/>`,
    )
    .join("\n");
  const rings = cloudTerminals
    .map(
      ([x, y]) =>
        `<circle cx="${x}" cy="${y}" r=".2" stroke-width="${terminalRadius * 2}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 500" fill="none">
<defs><linearGradient id="ink" x1="-2" y1="2" x2="2" y2="-2" gradientUnits="userSpaceOnUse"><stop stop-color="#4264f5"/><stop offset="1" stop-color="#3456dc"/></linearGradient></defs>
<g transform="translate(300 240) scale(95 -95)" stroke="url(#ink)" stroke-linecap="round" stroke-linejoin="round">
${paths}
${rings}
</g></svg>\n`;
}
