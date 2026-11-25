
/**
 * Minimal, safe formatter for model output: paragraphs, bullet and numbered
 * lists, **bold**, `code`, ### headings, and citations rendered as chips.
 *
 * Citations look like [Doc 2, Page 3] (or older [Page 3]). `legend` maps the
 * Doc number to {filename}, so a chip reads "lecture-3.pdf · p. 3".
 * Builds React elements only, so model text can never inject HTML.
 */
import { Fragment } from 'react';

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[Doc\s*\d+(?:\s*,\s*Pages?\s*[\d,\s–-]+)?\]|\[Pages?\s+[\d,\s–-]+\])/gi;
const DOC_CITE = /^\[Doc\s*(\d+)(?:\s*,\s*Pages?\s*([\d,\s–-]+))?\]$/i;
const PAGE_CITE = /^\[Pages?\s+([\d,\s–-]+)\]$/i;

const shortName = (name = '') => (name.length > 28 ? `${name.slice(0, 25)}…` : name);

const Chip = ({ label, title }) => (
  <span
    className="mx-0.5 inline-flex max-w-full items-center rounded border border-primary-200 bg-primary-50 px-1.5 align-baseline text-[11px] font-medium leading-5 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300"
    title={title}
  >
    {label}
  </span>
);

const renderInline = (text, keyPrefix, legend) =>
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
    const doc = DOC_CITE.exec(part);
    if (doc) {
      const filename = legend?.[String(Number(doc[1]))]?.filename;
      const page = doc[2]?.trim();
      const name = filename ? shortName(filename) : `Doc ${doc[1]}`;
      const label = page ? `${name} · p. ${page}` : name;
      return <Chip key={key} label={label} title={`${filename || `Document ${doc[1]}`}${page ? `, page ${page}` : ''}`} />;
    }
    const pageOnly = PAGE_CITE.exec(part);
    if (pageOnly) {
      return <Chip key={key} label={`p. ${pageOnly[1].trim()}`} title="Source page in your document" />;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,4}\s+/;

const RichText = ({ text = '', className = '', legend }) => {
  const blocks = [];
  let list = null;

  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  text.split('\n').forEach((raw) => {
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
      blocks.push({ type: 'heading', text: line.replace(HEADING, '').replace(/\*\*/g, '') });
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
              {renderInline(block.text, i, legend)}
            </p>
          );
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i} className={`space-y-1 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-zinc-400`}>
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, `${i}-${j}`, legend)}</li>
              ))}
            </Tag>
          );
        }
        return <p key={i}>{renderInline(block.text, i, legend)}</p>;
      })}
    </div>
  );
};

/** "lecture.pdf · p. 3" for a {filename, page} source. */
export const sourceLabel = (source) => {
  if (!source) return '';
  const name = source.filename || (source.doc ? `Doc ${source.doc}` : 'Document');
  return source.page ? `${name} · p. ${source.page}` : name;
};

export default RichText;
