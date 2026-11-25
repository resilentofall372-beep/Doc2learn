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
