import React from 'react';

/**
 * Minimal, safe formatter for model output: paragraphs, bullet and numbered
 * lists, **bold**, `code`, ### headings, and [Page N] citations rendered as chips.
 * Builds React elements only, so model text can never inject HTML.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[Pages?\s+[\d,\s–-]+\])/g;

const renderInline = (text, keyPrefix) =>
  text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-zinc-900 dark:text-zinc-50">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-zinc-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    const cite = /^\[Pages?\s+([\d,\s–-]+)\]$/.exec(part);
    if (cite) {
      return (
        <span
          key={key}
          className="mx-0.5 inline-flex items-center rounded border border-primary-200 bg-primary-50 px-1.5 align-baseline text-[11px] font-medium leading-5 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300"
          title="Source page in your document"
        >
          p. {cite[1].trim()}
        </span>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,4}\s+/;

const RichText = ({ text = '', className = '' }) => {
  const blocks = [];
  let list = null;

  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  text.split('\n').forEach((raw, index) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      return;
    }
    if (BULLET.test(line) || NUMBER.test(line)) {
      const ordered = NUMBER.test(line);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { type: 'list', ordered, items: [] };
      }
      list.items.push(line.replace(ordered ? NUMBER : BULLET, ''));
      return;
    }
    flushList();
    if (HEADING.test(line)) {
      blocks.push({ type: 'heading', text: line.replace(HEADING, '').replace(/\*\*/g, ''), index });
      return;
    }
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'p' && !raw.startsWith(' ') && last.open) {
      last.text += ` ${line.trim()}`;
    } else {
      blocks.push({ type: 'p', text: line.trim(), open: true });
    }
  });
  flushList();

  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <p key={i} className="pt-1 font-semibold text-zinc-900 dark:text-zinc-50">
              {renderInline(block.text, i)}
            </p>
          );
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i} className={`space-y-1 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-zinc-400`}>
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, `${i}-${j}`)}</li>
              ))}
            </Tag>
          );
        }
        return <p key={i}>{renderInline(block.text, i)}</p>;
      })}
    </div>
  );
};

export default RichText;
