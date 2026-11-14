import React, { useMemo, useState } from 'react';
import { STATUS } from '../../utils/progress';

// Horizontal tree: central topic on the left, branches in the middle, subtopics on the right.
const COL_X = [0, 290, 590];
const NODE_W = [230, 240, 260];
const ROW_H = 46;
const GAP = 18;
const PAD = 24;

const layout = (mindmap) => {
  const branches = (mindmap.branches || []).map((b) => ({
    topic: b.topic,
    subtopics: (b.subtopics || []).map((s) => (typeof s === 'string' ? s : s.text)).filter(Boolean),
  }));
  let y = PAD;
  const placed = branches.map((branch, i) => {
    const rows = Math.max(1, branch.subtopics.length);
    const height = rows * ROW_H;
    const top = y;
    y += height + GAP;
    return {
      id: `b${i}`,
      text: branch.topic,
      y: top + height / 2,
      children: branch.subtopics.map((text, j) => ({ id: `b${i}s${j}`, text, y: top + j * ROW_H + ROW_H / 2 })),
    };
  });
  const totalHeight = Math.max(y - GAP + PAD, 160);
  return { placed, rootY: totalHeight / 2, height: totalHeight };
};

const curve = (x1, y1, x2, y2) => {
  const mid = (x1 + x2) / 2;
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
};

const Node = ({ x, y, width, text, level, active, dimmed, onClick, progress }) => {
  const styles = [
    'bg-primary-600 text-white border-primary-600 font-semibold text-sm',
    'bg-white text-zinc-900 border-zinc-300 font-medium text-sm dark:bg-zinc-800 dark:text-zinc-50 dark:border-zinc-600',
    'bg-zinc-50 text-zinc-700 border-zinc-200 text-xs dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700',
  ][level];
  return (
    <foreignObject x={x} y={y - 18} width={width} height={36} style={{ overflow: 'visible' }}>
      <button
        type="button"
        onClick={onClick}
        title={text}
        className={`flex h-9 w-full items-center rounded-lg border px-3 text-left shadow-sm transition ${styles} ${
          active ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-zinc-900' : ''
        } ${dimmed ? 'opacity-35' : ''}`}
      >
        {progress && <span className={`mr-2 h-2 w-2 flex-shrink-0 rounded-full ${STATUS[progress.status]?.dot || ''}`} />}
        <span className="truncate">{text}</span>
        {progress?.mastery != null && <span className="ml-auto pl-2 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{progress.mastery}%</span>}
      </button>
    </foreignObject>
  );
};

/**
 * `progressFor(text)` (optional) returns {status, mastery} for a branch that matches an outline
 * topic, so branches show how well each part is known.
 */
const MindMapCanvas = ({ mindmap, progressFor }) => {
  const [focus, setFocus] = useState(null);
  const { placed, rootY, height } = useMemo(() => layout(mindmap), [mindmap]);
  const width = COL_X[2] + NODE_W[2] + PAD;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`${-PAD} 0 ${width + PAD} ${height}`} className="mx-auto block" style={{ minWidth: 760, width: '100%', maxHeight: '70vh' }}>
        {placed.map((branch) => {
          const dim = focus && focus !== branch.id;
          return (
            <g key={branch.id} className={`transition-opacity ${dim ? 'opacity-25' : ''}`}>
              <path d={curve(COL_X[0] + NODE_W[0], rootY, COL_X[1], branch.y)} className="fill-none stroke-zinc-300 dark:stroke-zinc-600" strokeWidth="1.5" />
              {branch.children.map((child) => (
                <path key={child.id} d={curve(COL_X[1] + NODE_W[1], branch.y, COL_X[2], child.y)} className="fill-none stroke-zinc-200 dark:stroke-zinc-700" strokeWidth="1.25" />
              ))}
            </g>
          );
        })}

        <Node x={COL_X[0]} y={rootY} width={NODE_W[0]} level={0} text={mindmap.central_topic} onClick={() => setFocus(null)} />
        {placed.map((branch) => (
          <g key={branch.id}>
            <Node
              x={COL_X[1]}
              y={branch.y}
              width={NODE_W[1]}
              level={1}
              text={branch.text}
              active={focus === branch.id}
              dimmed={focus && focus !== branch.id}
              progress={progressFor ? progressFor(branch.text) : null}
              onClick={() => setFocus(focus === branch.id ? null : branch.id)}
            />
            {branch.children.map((child) => (
              <Node
                key={child.id}
                x={COL_X[2]}
                y={child.y}
                width={NODE_W[2]}
                level={2}
                text={child.text}
                dimmed={focus && focus !== branch.id}
                onClick={() => setFocus(branch.id)}
              />
            ))}
          </g>
        ))}
      </svg>
      {progressFor && (
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          {Object.entries(STATUS).map(([key, s]) => (
            <span key={key} className="muted inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <p className="muted mt-3 text-center text-xs">Click a branch to highlight it. Click the centre topic to reset.</p>
    </div>
  );
};

export default MindMapCanvas;
