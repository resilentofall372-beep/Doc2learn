import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown, Maximize2, Minus, Plus, Search, X } from 'lucide-react';
import { STATUS } from '../../utils/progress';

/*
 * Interactive concept map.
 * - Radial layout: the central idea in the middle, branches (topics) on an inner ring,
 *   their concepts fanned out on an outer ring inside the branch's slice.
 * - Wheel or buttons to zoom, drag the background to pan, "fit" to see everything.
 * - Click a node to select it (the page shows details); branches can be collapsed.
 * - Dashed lines are cross-links between related concepts in different branches.
 */

// One hue per branch. Full class strings so Tailwind keeps them.
export const BRANCH_COLORS = [
  { stroke: '#6366f1', node: 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-500/50 dark:bg-indigo-500/15 dark:text-indigo-100', chip: 'bg-indigo-500' },
  { stroke: '#0ea5e9', node: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-100', chip: 'bg-sky-500' },
  { stroke: '#10b981', node: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100', chip: 'bg-emerald-500' },
  { stroke: '#f59e0b', node: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100', chip: 'bg-amber-500' },
  { stroke: '#f43f5e', node: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100', chip: 'bg-rose-500' },
  { stroke: '#8b5cf6', node: 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-100', chip: 'bg-violet-500' },
  { stroke: '#14b8a6', node: 'border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-500/50 dark:bg-teal-500/15 dark:text-teal-100', chip: 'bg-teal-500' },
  { stroke: '#f97316', node: 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-100', chip: 'bg-orange-500' },
];

const SIZE = {
  center: { w: 210, h: 52 },
  branch: { w: 200, h: 46 },
  concept: { w: 168, h: 34 },
};
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

/** Branches and concepts with stable ids, from new maps ({concepts}) or older ones ({subtopics}). */
export const normaliseMap = (mindmap) => {
  const branches = (mindmap?.branches || []).map((b, i) => {
    const raw = b.concepts?.length ? b.concepts : b.subtopics || [];
    const concepts = raw
      .map((c) => (typeof c === 'string' ? { label: c, note: '' } : { label: c.label || c.text || '', note: c.note || '' }))
      .filter((c) => c.label)
      .map((c, j) => ({ ...c, id: `b${i}c${j}`, branchId: `b${i}` }));
    return { id: `b${i}`, index: i, topic: b.topic, topicId: b.topic_id || null, note: b.note || '', concepts, color: BRANCH_COLORS[i % BRANCH_COLORS.length] };
  });
  const byLabel = new Map(branches.flatMap((b) => b.concepts.map((c) => [c.label.toLowerCase(), c])));
  const links = (mindmap?.links || [])
    .map((l) => ({ from: byLabel.get(String(l.from).toLowerCase()), to: byLabel.get(String(l.to).toLowerCase()), label: l.label || '' }))
    .filter((l) => l.from && l.to);
  return { central: mindmap?.central_topic || 'Concept map', branches, links };
};

const polar = (r, a) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });

const layout = (map, collapsed) => {
  const n = Math.max(1, map.branches.length);
  const most = Math.max(1, ...map.branches.map((b) => b.concepts.length));
  const r1 = n <= 4 ? 210 : n <= 7 ? 250 : 290;
  const r2 = r1 + 190 + Math.max(0, most - 4) * 18;
  const slice = (2 * Math.PI) / n;
  const nodes = { center: { x: 0, y: 0 } };
  map.branches.forEach((b, i) => {
    const angle = -Math.PI / 2 + i * slice;
    nodes[b.id] = { ...polar(r1, angle), angle };
    if (collapsed.has(b.id)) return;
    const m = b.concepts.length;
    // Fan concepts across part of the branch's slice: wide enough to not overlap, never into the neighbour.
    const span = Math.min(slice * 0.82, ((m - 1) * (SIZE.concept.h + 12)) / r2 + 0.05);
    b.concepts.forEach((c, j) => {
      const a = m === 1 ? angle : angle - span / 2 + (span * j) / (m - 1);
      nodes[c.id] = polar(r2, a);
    });
  });
  const pts = Object.values(nodes);
  const pad = 140;
  const box = {
    minX: Math.min(...pts.map((p) => p.x)) - pad,
    maxX: Math.max(...pts.map((p) => p.x)) + pad,
    minY: Math.min(...pts.map((p) => p.y)) - pad / 2,
    maxY: Math.max(...pts.map((p) => p.y)) + pad / 2,
  };
  return { nodes, box };
};

const curve = (a, b, bend = 0.25) => {
  // A gentle curve, bowed towards the centre of the map.
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return `M${a.x},${a.y} Q${mx * (1 - bend)},${my * (1 - bend)} ${b.x},${b.y}`;
};

const NodeBox = ({ at, size, children, onSelect, className, title, dim, selected }) => (
  <foreignObject x={at.x - size.w / 2} y={at.y - size.h / 2} width={size.w} height={size.h} style={{ overflow: 'visible' }}>
    <button
      type="button"
      title={title}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onSelect}
      className={`flex h-full w-full items-center gap-2 rounded-xl border px-3 text-left shadow-sm transition ${className} ${
        selected ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''
      } ${dim ? 'opacity-30' : ''}`}
    >
      {children}
    </button>
  </foreignObject>
);

const MindMapCanvas = ({ map, progressFor, selected, onSelect, height = 620 }) => {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: height });
  const [view, setView] = useState({ x: 400, y: height / 2, k: 1 });
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const drag = useRef(null);

  const { nodes, box } = useMemo(() => layout(map, collapsed), [map, collapsed]);

  // Track the container's size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = useCallback(() => {
    const bw = box.maxX - box.minX;
    const bh = box.maxY - box.minY;
    const k = Math.max(MIN_ZOOM, Math.min(1.1, (size.w / bw) * 0.95, (size.h / bh) * 0.95));
    setView({ k, x: size.w / 2 - ((box.minX + box.maxX) / 2) * k, y: size.h / 2 - ((box.minY + box.maxY) / 2) * k });
  }, [box, size]);

  // Fit when the map or the container changes size (not when collapsing, so the view doesn't jump).
  const fitKey = `${map.branches.length}:${Math.round(size.w)}:${Math.round(size.h)}`;
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);

  const zoomAt = useCallback((factor, px, py) => {
    setView((v) => {
      const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.k * factor));
      return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    });
  }, []);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    setView({ ...drag.current.view, x: drag.current.view.x + dx, y: drag.current.view.y + dy });
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) onSelect?.(null); // a click on empty space clears the selection
    drag.current = null;
  };

  const toggleBranch = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // What to emphasise: the selected branch, or nodes matching the search.
  const q = query.trim().toLowerCase();
  const focusBranch = selected?.branchId || null;
  const matches = (text) => !q || text.toLowerCase().includes(q);
  const dimBranch = (b) => (q ? !matches(b.topic) && !b.concepts.some((c) => matches(c.label)) : focusBranch && focusBranch !== b.id);
  const dimConcept = (b, c) => (q ? !matches(c.label) && !matches(b.topic) : focusBranch && focusBranch !== b.id);

  return (
    <div className="relative">
      {/* toolbar */}
      <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a concept"
            aria-label="Find a concept"
            className="input h-8 py-1 pl-8 pr-7 text-xs"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-zinc-200 bg-white/90 p-0.5 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
          <button type="button" onClick={() => setCollapsed(new Set())} className="btn btn-ghost btn-sm" title="Expand all branches">
            <ChevronsUpDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Expand</span>
          </button>
          <button type="button" onClick={() => setCollapsed(new Set(map.branches.map((b) => b.id)))} className="btn btn-ghost btn-sm" title="Collapse all branches">
            <ChevronsDownUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Collapse</span>
          </button>
          <span className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button type="button" onClick={() => zoomAt(1 / 1.2, size.w / 2, size.h / 2)} className="btn btn-ghost btn-icon p-1.5" aria-label="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-[11px] tabular-nums text-zinc-500">{Math.round(view.k * 100)}%</span>
          <button type="button" onClick={() => zoomAt(1.2, size.w / 2, size.h / 2)} className="btn btn-ghost btn-icon p-1.5" aria-label="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={fit} className="btn btn-ghost btn-icon p-1.5" aria-label="Fit to screen" title="Fit to screen">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="overflow-hidden rounded-b-xl bg-[radial-gradient(circle,_rgb(228_228_231)_1px,_transparent_1px)] [background-size:22px_22px] dark:bg-[radial-gradient(circle,_rgb(39_39_42)_1px,_transparent_1px)]"
        style={{ height }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => (drag.current = null)}
          role="img"
          aria-label={`Concept map of ${map.central}`}
        >
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {/* edges: centre -> branch -> concept */}
            {map.branches.map((b) => (
              <g key={`e-${b.id}`} opacity={dimBranch(b) ? 0.15 : 1} className="transition-opacity">
                <path d={curve(nodes.center, nodes[b.id], 0)} fill="none" stroke={b.color.stroke} strokeWidth="2.5" strokeOpacity="0.55" />
                {!collapsed.has(b.id) &&
                  b.concepts.map((c) => (
                    <path key={c.id} d={curve(nodes[b.id], nodes[c.id], 0.1)} fill="none" stroke={b.color.stroke} strokeWidth="1.5" strokeOpacity="0.4" />
                  ))}
              </g>
            ))}

            {/* cross-links between related concepts */}
            {map.links.map((l) => {
              const a = nodes[l.from.id];
              const z = nodes[l.to.id];
              if (!a || !z) return null;
              const mid = { x: ((a.x + z.x) / 2) * 0.55, y: ((a.y + z.y) / 2) * 0.55 };
              const faded = (focusBranch && focusBranch !== l.from.branchId && focusBranch !== l.to.branchId) || q;
              return (
                <g key={`${l.from.id}-${l.to.id}`} opacity={faded ? 0.12 : 0.9}>
                  <path d={`M${a.x},${a.y} Q${mid.x},${mid.y} ${z.x},${z.y}`} fill="none" strokeDasharray="5 5" strokeWidth="1.5" className="stroke-zinc-400 dark:stroke-zinc-500" />
                  {l.label && (
                    <text x={(a.x + 2 * mid.x + z.x) / 4} y={(a.y + 2 * mid.y + z.y) / 4} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400" style={{ paintOrder: 'stroke', stroke: 'var(--map-bg)', strokeWidth: 4 }}>
                      {l.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* centre */}
            <NodeBox
              at={nodes.center}
              size={SIZE.center}
              title={map.central}
              selected={selected?.type === 'center'}
              onSelect={() => onSelect?.({ type: 'center' })}
              className="justify-center border-primary-600 bg-primary-600 text-center text-sm font-semibold text-white hover:bg-primary-500"
            >
              <span className="truncate">{map.central}</span>
            </NodeBox>

            {/* branches and concepts */}
            {map.branches.map((b) => {
              const progress = progressFor ? progressFor(b) : null;
              const isCollapsed = collapsed.has(b.id);
              return (
                <g key={b.id}>
                  <NodeBox
                    at={nodes[b.id]}
                    size={SIZE.branch}
                    title={b.topic}
                    dim={dimBranch(b)}
                    selected={selected?.type === 'branch' && selected.branchId === b.id}
                    onSelect={() => onSelect?.({ type: 'branch', branchId: b.id })}
                    className={`text-sm font-semibold hover:brightness-95 ${b.color.node}`}
                  >
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${progress ? STATUS[progress.status]?.dot : b.color.chip}`} />
                    <span className="min-w-0 flex-1 truncate">{b.topic}</span>
                    {progress?.mastery != null && <span className="text-[11px] font-medium tabular-nums opacity-70">{progress.mastery}%</span>}
                  </NodeBox>
                  {b.concepts.length > 0 && (
                    <foreignObject x={nodes[b.id].x + SIZE.branch.w / 2 - 12} y={nodes[b.id].y - SIZE.branch.h / 2 - 10} width={26} height={22} style={{ overflow: 'visible' }}>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => toggleBranch(b.id)}
                        title={isCollapsed ? `Show ${b.concepts.length} concepts` : 'Hide concepts'}
                        aria-label={isCollapsed ? `Show concepts of ${b.topic}` : `Hide concepts of ${b.topic}`}
                        className="grid h-5 min-w-[20px] place-items-center rounded-full border border-zinc-300 bg-white px-1 text-[10px] font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {isCollapsed ? `+${b.concepts.length}` : '−'}
                      </button>
                    </foreignObject>
                  )}
                  {!isCollapsed &&
                    b.concepts.map((c) => (
                      <NodeBox
                        key={c.id}
                        at={nodes[c.id]}
                        size={SIZE.concept}
                        title={c.note ? `${c.label}: ${c.note}` : c.label}
                        dim={dimConcept(b, c)}
                        selected={selected?.type === 'concept' && selected.conceptId === c.id}
                        onSelect={() => onSelect?.({ type: 'concept', branchId: b.id, conceptId: c.id })}
                        className="border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${b.color.chip}`} />
                        <span className="truncate">{c.label}</span>
                      </NodeBox>
                    ))}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-zinc-200 px-4 py-2.5 text-xs dark:border-zinc-800">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {progressFor &&
            Object.entries(STATUS).map(([key, s]) => (
              <span key={key} className="muted inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            ))}
          {map.links.length > 0 && (
            <span className="muted inline-flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" strokeDasharray="4 3" className="stroke-zinc-400" strokeWidth="1.5" /></svg>
              Related concepts
            </span>
          )}
        </div>
        <span className="muted">Scroll to zoom · drag to move · click a node for details</span>
      </div>
    </div>
  );
};

export default MindMapCanvas;
