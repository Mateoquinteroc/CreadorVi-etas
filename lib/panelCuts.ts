/**
 * Geometry for diagonal cuts along a shared border between two adjacent panels.
 * GridStack only ever sees the plain rectangle (x, y, w, h) of each panel - a cut
 * is a purely visual overlay computed from that rectangle plus its neighbor's.
 *
 * Scope (v1): a cut is only supported between two panels that share a FULL edge
 * (same height for a left/right pair, same width for a top/bottom pair). Partial
 * overlaps ("T" junctions) are not supported - keeping the geometry to a single
 * shared line between exactly two panels, always tiling perfectly.
 */

export interface GridPoint {
  x: number;
  y: number;
}

interface PanelLike {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PanelCut {
  id: string;
  panelAId: string;
  panelBId: string;
  /** Grid-unit shift at the start of the shared edge (top for a vertical edge,
   * left for a horizontal one). 0 = unshifted. */
  offsetStart: number;
  /** Grid-unit shift at the end of the shared edge (bottom/right). 0 = unshifted. */
  offsetEnd: number;
}

export interface Adjacency {
  edge: 'vertical' | 'horizontal';
  /** Shared x (vertical edge) or y (horizontal edge) boundary, in grid units. */
  boundary: number;
  /** Start of the shared segment (top for vertical, left for horizontal). */
  start: number;
  /** End of the shared segment (bottom for vertical, right for horizontal). */
  end: number;
  /** Left panel (vertical edge) or top panel (horizontal edge). */
  first: PanelLike;
  /** Right panel (vertical edge) or bottom panel (horizontal edge). */
  second: PanelLike;
}

/** Returns the shared full-edge adjacency between two panels, or null if they
 * don't touch along a matching full edge. */
export function findAdjacency(a: PanelLike, b: PanelLike): Adjacency | null {
  // Side by side, same height -> vertical shared edge.
  if (a.y === b.y && a.h === b.h) {
    if (a.x + a.w === b.x) return { edge: 'vertical', boundary: b.x, start: a.y, end: a.y + a.h, first: a, second: b };
    if (b.x + b.w === a.x) return { edge: 'vertical', boundary: a.x, start: a.y, end: a.y + a.h, first: b, second: a };
  }
  // Stacked, same width -> horizontal shared edge.
  if (a.x === b.x && a.w === b.w) {
    if (a.y + a.h === b.y) return { edge: 'horizontal', boundary: b.y, start: a.x, end: a.x + a.w, first: a, second: b };
    if (b.y + b.h === a.y) return { edge: 'horizontal', boundary: a.y, start: a.x, end: a.x + a.w, first: b, second: a };
  }
  return null;
}

/** All full-edge-adjacent pairs in a layout - one entry per cuttable shared
 * edge, used to know where to render drag handles. O(n²) but panel counts in
 * this app are small (dozens at most). */
export function findAllAdjacencies(panels: PanelLike[]): Adjacency[] {
  const result: Adjacency[] = [];
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const adjacency = findAdjacency(panels[i], panels[j]);
      if (adjacency) result.push(adjacency);
    }
  }
  return result;
}

/** Maximum |offset| that keeps the diagonal inside both panels' own bounds. */
export function maxCutOffset(adjacency: Adjacency): number {
  const span = adjacency.edge === 'vertical'
    ? Math.min(adjacency.first.w, adjacency.second.w)
    : Math.min(adjacency.first.h, adjacency.second.h);
  return Math.max(1, Math.floor(span * 0.8));
}

export function clampCutOffset(offset: number, adjacency: Adjacency): number {
  const max = maxCutOffset(adjacency);
  return Math.max(-max, Math.min(max, offset));
}

/** The two endpoints of the shared edge, in grid units. `p1` is the start
 * endpoint (top/left), `p2` is the end endpoint (bottom/right) - each shifted
 * independently by its own offset. Both panels in a cut read the same two
 * offsets, so they're geometrically incapable of drifting out of sync. */
export function cutEndpoints(adjacency: Adjacency, offsetStart: number, offsetEnd: number): { p1: GridPoint; p2: GridPoint } {
  if (adjacency.edge === 'vertical') {
    return {
      p1: { x: adjacency.boundary + offsetStart, y: adjacency.start },
      p2: { x: adjacency.boundary + offsetEnd, y: adjacency.end },
    };
  }
  return {
    p1: { x: adjacency.start, y: adjacency.boundary + offsetStart },
    p2: { x: adjacency.end, y: adjacency.boundary + offsetEnd },
  };
}

/**
 * Builds a panel's outline (clockwise from top-left) in grid units, replacing
 * the corners of any edge that has an active cut with that cut's two endpoints.
 * `allPanels` and `cuts` are the full layout - only cuts referencing `panel`
 * are considered, and only if the two panels are still actually adjacent.
 *
 * `gapGrid` is the same visual gutter used between every other pair of panels
 * (GridStack's own margin), expressed in grid units per axis so it can be
 * applied here too - without it, a cut's shared line sits exactly on both
 * panels' edges with zero space between them, unlike every straight edge in
 * the layout. Each panel's version of the cut line is nudged half that gap
 * toward its own interior (first/left/top moves "backward", second/right/
 * bottom moves "forward"), staying centered on the line the user actually
 * dragged.
 */
export function panelPolygon(
  panel: PanelLike,
  allPanels: PanelLike[],
  cuts: PanelCut[],
  gapGrid: { x: number; y: number } = { x: 0, y: 0 }
): GridPoint[] {
  const TL: GridPoint = { x: panel.x, y: panel.y };
  const TR: GridPoint = { x: panel.x + panel.w, y: panel.y };
  const BR: GridPoint = { x: panel.x + panel.w, y: panel.y + panel.h };
  const BL: GridPoint = { x: panel.x, y: panel.y + panel.h };

  let topNear = TL, topFar = TR;
  let rightNear = TR, rightFar = BR;
  let bottomNear = BR, bottomFar = BL;
  let leftNear = BL, leftFar = TL;

  for (const cut of cuts) {
    if (cut.panelAId !== panel.id && cut.panelBId !== panel.id) continue;
    const otherId = cut.panelAId === panel.id ? cut.panelBId : cut.panelAId;
    const other = allPanels.find(p => p.id === otherId);
    if (!other) continue;

    const adjacency = findAdjacency(panel, other);
    if (!adjacency) continue; // panels moved apart / no longer a matching edge

    const offsetStart = clampCutOffset(cut.offsetStart, adjacency);
    const offsetEnd = clampCutOffset(cut.offsetEnd, adjacency);
    const { p1, p2 } = cutEndpoints(adjacency, offsetStart, offsetEnd);
    const isFirst = adjacency.first.id === panel.id;

    if (adjacency.edge === 'vertical') {
      const shift = (isFirst ? -1 : 1) * (gapGrid.x / 2);
      const sp1: GridPoint = { x: p1.x + shift, y: p1.y };
      const sp2: GridPoint = { x: p2.x + shift, y: p2.y };
      if (isFirst) { rightNear = sp1; rightFar = sp2; }
      else { leftNear = sp2; leftFar = sp1; }
    } else {
      const shift = (isFirst ? -1 : 1) * (gapGrid.y / 2);
      const sp1: GridPoint = { x: p1.x, y: p1.y + shift };
      const sp2: GridPoint = { x: p2.x, y: p2.y + shift };
      if (isFirst) { bottomNear = sp2; bottomFar = sp1; }
      else { topNear = sp1; topFar = sp2; }
    }
  }

  return [topNear, topFar, rightNear, rightFar, bottomNear, bottomFar, leftNear, leftFar];
}

/**
 * Builds an SVG path `d` string for a closed polygon with every vertex
 * rounded by `radius` - a straight edge gets inset from both ends and the
 * corner is replaced with a quadratic curve toward the original vertex.
 * Works the same way regardless of whether a vertex is a plain 90° panel
 * corner or a cut's diagonal-meets-straight-edge point, which is what lets
 * cut panels respect the corner radius setting like any other panel.
 *
 * Each vertex's radius is clamped to half of its shorter adjacent edge, so
 * degenerate/very short edges (e.g. a near-zero cut offset) automatically
 * shrink their own rounding instead of overshooting past the neighboring
 * vertex - no special-casing needed for which vertices are "real" corners.
 */
export function roundedPolygonPath(points: GridPoint[], radius: number): string {
  const n = points.length;
  if (n < 3) return '';
  if (radius <= 0) {
    return `M ${points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')} Z`;
  }

  const cmds: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const distPrev = Math.hypot(toPrev.x, toPrev.y);
    const distNext = Math.hypot(toNext.x, toNext.y);
    const r = Math.min(radius, distPrev / 2, distNext / 2);

    if (distPrev < 0.01 || distNext < 0.01 || r < 0.01) {
      cmds.push(`${i === 0 ? 'M' : 'L'} ${curr.x.toFixed(2)},${curr.y.toFixed(2)}`);
      continue;
    }

    const a = { x: curr.x + (toPrev.x / distPrev) * r, y: curr.y + (toPrev.y / distPrev) * r };
    const b = { x: curr.x + (toNext.x / distNext) * r, y: curr.y + (toNext.y / distNext) * r };

    cmds.push(`${i === 0 ? 'M' : 'L'} ${a.x.toFixed(2)},${a.y.toFixed(2)}`);
    cmds.push(`Q ${curr.x.toFixed(2)},${curr.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`);
  }
  cmds.push('Z');
  return cmds.join(' ');
}
