// One hue per branch. Full class strings so Tailwind keeps them.
// None of them is a progress colour (grey, indigo, amber, emerald), so a branch's colour
// can't be mistaken for "Review due" or "Mastered" in the map's legend.
export const BRANCH_COLORS = [
  { stroke: '#0ea5e9', node: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-100', chip: 'bg-sky-500' },
  { stroke: '#8b5cf6', node: 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-100', chip: 'bg-violet-500' },
  { stroke: '#f43f5e', node: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100', chip: 'bg-rose-500' },
  { stroke: '#06b6d4', node: 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-100', chip: 'bg-cyan-500' },
  { stroke: '#d946ef', node: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-500/50 dark:bg-fuchsia-500/15 dark:text-fuchsia-100', chip: 'bg-fuchsia-500' },
  { stroke: '#ec4899', node: 'border-pink-300 bg-pink-50 text-pink-900 dark:border-pink-500/50 dark:bg-pink-500/15 dark:text-pink-100', chip: 'bg-pink-500' },
  { stroke: '#3b82f6', node: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-100', chip: 'bg-blue-500' },
  { stroke: '#a855f7', node: 'border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-500/50 dark:bg-purple-500/15 dark:text-purple-100', chip: 'bg-purple-500' },
];

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
