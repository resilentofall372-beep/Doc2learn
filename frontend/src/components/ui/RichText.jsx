
/**
 * Minimal, safe formatter for model output: paragraphs, bullet and numbered
 * lists, **bold**, `code`, ### headings, and citations rendered as chips.
 *
 * Citations look like [Doc 2, Page 3] (or older [Page 3]). `legend` maps the
 * Doc number to {document_id, filename, sections}, so a chip reads "lecture-3.pdf · p. 3",
 * or "spec.docx · 7.1 Plugin Manifest" for a file split into sections at its headings.
 * Clicking a chip opens the source in the reader (SourceReader, mounted once in the app shell).
 * Builds React elements only, so model text can never inject HTML.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { documentAPI, errorMessage } from '../../services/api';
import Dialog from './Dialog';
import LoadingSpinner from '../common/LoadingSpinner';

// --------------------------------------------------------------------------- reader
const readerListeners = new Set();
const documentCache = new Map();

/** Open a source in the reader: { documentId, page?, section?, filename? }. */
export const openSource = (source) => {
  if (source?.documentId) readerListeners.forEach((listener) => listener(source));
};

/** The document reader: shows a file's text, scrolled to the cited page or section. */
export const SourceReader = () => {
  const [target, setTarget] = useState(null);
  const [state, setState] = useState({ loading: false, doc: null, error: null });
  const sectionRefs = useRef({});

  useEffect(() => {
    const listener = (source) => setTarget(source);
    readerListeners.add(listener);
    return () => readerListeners.delete(listener);
  }, []);

  useEffect(() => {
    if (!target) return undefined;
    let alive = true;
    const cached = documentCache.get(target.documentId);
    if (cached) {
      setState({ loading: false, doc: cached, error: null });
      return undefined;
    }
    setState({ loading: true, doc: null, error: null });
    documentAPI
      .get(target.documentId)
      .then((res) => {
        documentCache.set(target.documentId, res.data.document);
        if (alive) setState({ loading: false, doc: res.data.document, error: null });
      })
      .catch((error) => alive && setState({ loading: false, doc: null, error: errorMessage(error, 'Could not open this document') }));
    return () => {
      alive = false;
    };
  }, [target]);

  const sections = state.doc?.sections || [];
  const wanted =
    target && (sections.find((s) => target.section && s.title === target.section) || sections.find((s) => s.page === target.page));

  // Bring the cited section into view once the text is there.
  useEffect(() => {
    if (!wanted) return;
    const el = sectionRefs.current[wanted.page];
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }, [wanted]);

  if (!target) return null;
  const close = () => setTarget(null);
  const title = state.doc?.filename || target.filename || 'Document';
  const unit = state.doc?.has_sections ? 'section' : 'page';
  return (
    <Dialog
      open
      onClose={close}
      size="lg"
      icon={FileText}
      title={title}
      description={wanted ? (wanted.title || `Page ${wanted.page}`) : sections.length > 1 ? `${sections.length} ${unit}s` : 'Source document'}
    >
      {state.loading && <LoadingSpinner className="py-16" label="Opening the document…" />}
      {state.error && <div className="alert alert-danger m-5">{state.error}</div>}
      {state.doc && (
        <div className="flex min-h-0">
          {sections.length > 1 && (
            <nav className="hidden w-56 flex-shrink-0 border-r border-zinc-200 p-3 md:block dark:border-zinc-800" aria-label="Sections">
              <ul className="sticky top-0 space-y-0.5">
                {sections.map((s) => (
                  <li key={s.page}>
                    <button
                      type="button"
                      onClick={() => sectionRefs.current[s.page]?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
                      className={`w-full truncate rounded-md px-2 py-1 text-left text-xs ${
                        wanted?.page === s.page ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                      }`}
                      title={s.title || `Page ${s.page}`}
                    >
                      {s.title || `Page ${s.page}`}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div className="min-w-0 flex-1 space-y-4 p-5">
            {sections.map((s) => (
              <section
                key={s.page}
                ref={(el) => {
                  sectionRefs.current[s.page] = el;
                }}
                className={`scroll-mt-4 rounded-lg p-3 ${wanted?.page === s.page ? 'bg-amber-50 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/40' : ''}`}
              >
                {!state.doc.has_sections && sections.length > 1 && <p className="eyebrow mb-1.5">Page {s.page}</p>}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{s.text}</p>
              </section>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
};

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[Doc\s*\d+(?:\s*,\s*Pages?\s*[\d,\s–-]+)?\]|\[Pages?\s+[\d,\s–-]+\])/gi;
const DOC_CITE = /^\[Doc\s*(\d+)(?:\s*,\s*Pages?\s*([\d,\s–-]+))?\]$/i;
const PAGE_CITE = /^\[Pages?\s+([\d,\s–-]+)\]$/i;

const shortName = (name = '') => (name.length > 28 ? `${name.slice(0, 25)}…` : name);

const CHIP =
  'mx-0.5 inline-flex max-w-full items-center rounded border border-primary-200 bg-primary-50 px-1.5 align-baseline text-[11px] font-medium leading-5 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300';

/** A citation; clickable (opens the reader) when it knows its document. */
const Chip = ({ label, title, source }) =>
  source?.documentId ? (
    <button
      type="button"
      onClick={() => openSource(source)}
      className={`${CHIP} cursor-pointer hover:border-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20`}
      title={`${title}. Click to open it.`}
    >
      <span className="truncate">{label}</span>
    </button>
  ) : (
    <span className={CHIP} title={title}>
      {label}
    </span>
  );

const shortSection = (title = '') => (title.length > 34 ? `${title.slice(0, 31)}…` : title);

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
      const entry = legend?.[String(Number(doc[1]))];
      const filename = entry?.filename;
      const page = doc[2]?.trim();
      const firstPage = page ? Number.parseInt(page, 10) : null;
      const section = firstPage ? entry?.sections?.[String(firstPage)] : null;
      const name = filename ? shortName(filename) : `Doc ${doc[1]}`;
      const label = section ? `${name} · ${shortSection(section)}` : page ? `${name} · p. ${page}` : name;
      const title = `${filename || `Document ${doc[1]}`}${section ? `, ${section}` : page ? `, page ${page}` : ''}`;
      const source = entry?.document_id ? { documentId: entry.document_id, page: firstPage, section, filename } : null;
      return <Chip key={key} label={label} title={title} source={source} />;
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

/** "lecture.pdf · p. 3" (or "spec.docx · 7.1 Plugin Manifest") for a {filename, page, section} source. */
export const sourceLabel = (source) => {
  if (!source) return '';
  const name = source.filename || (source.doc ? `Doc ${source.doc}` : 'Document');
  if (source.section) return `${name} · ${source.section}`;
  return source.page ? `${name} · p. ${source.page}` : name;
};

/** A source as the reader wants it, from {document_id, filename, page, section}. */
export const readerTarget = (source) =>
  source?.document_id ? { documentId: source.document_id, page: source.page ?? null, section: source.section || null, filename: source.filename } : null;

/** "Sources:" followed by clickable chips that open each source in the reader. */
export const SourceChips = ({ sources, label = 'Sources:', className = '' }) =>
  sources?.length ? (
    <p className={`muted flex flex-wrap items-center gap-y-1 text-xs ${className}`}>
      {label && <span className="mr-1">{label}</span>}
      {sources.map((s, i) => (
        <Chip key={`${s.document_id || s.filename}-${s.page}-${i}`} label={sourceLabel(s)} title={sourceLabel(s)} source={readerTarget(s)} />
      ))}
    </p>
  ) : null;

export default RichText;
