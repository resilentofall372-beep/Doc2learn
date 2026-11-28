// The sections of a project workspace, in study order: Home · Ask · Practice · Map · Sources.
// One list drives the sidebar, the mobile tabs and each page's header, so they can never disagree.
import { FileText, Layers, LayoutDashboard, ListChecks, ListTree, MessageSquareText, Network, Repeat, Target } from 'lucide-react';

export const SECTIONS = [
  {
    key: 'overview',
    path: '',
    label: 'Home',
    icon: LayoutDashboard,
    title: 'Overview',
    description: 'Your progress by topic, and the next thing to do.',
  },
  {
    key: 'learn',
    path: '/learn',
    label: 'Ask',
    icon: MessageSquareText,
    title: 'Ask the tutor',
    description: 'Ask questions or use a study tool. Every answer comes from your documents, with sources you can open.',
  },
  {
    key: 'practice',
    path: '/quiz',
    label: 'Practice',
    icon: Target,
    title: 'Practice',
    description: 'Check what you know with quizzes and flashcards, and review cards when they are due.',
    children: [
      { key: 'quiz', path: '/quiz', label: 'Quiz', icon: ListChecks, description: 'Multiple-choice questions from your documents, graded with an explanation for every option.' },
      { key: 'flashcards', path: '/flashcards', label: 'Flashcards', icon: Layers, description: 'Flip cards and rate how well you knew each one. Ratings schedule its next review.' },
      { key: 'review', path: '/review', label: 'Review', icon: Repeat, description: 'Cards that are due today, just before you would forget them.' },
    ],
  },
  {
    key: 'map',
    path: '/map',
    label: 'Map',
    icon: Network,
    title: 'Concept map',
    description: 'How the ideas connect. Click any node to see what it means and study it.',
  },
  {
    key: 'documents',
    path: '/documents',
    label: 'Sources',
    icon: FileText,
    title: 'Sources',
    description: 'The documents in this project. Add files or paste text; the tutor and quizzes use all of it.',
  },
];

// Pages that aren't in the menu but belong to a section.
const EXTRA = {
  '/topics': { section: 'overview', title: 'Topic outline', description: 'How this project is split into topics. Rename, reorder, merge or add them.', icon: ListTree },
  '/tutor': { section: 'learn' },
  '/live': { section: 'practice', title: 'Host a live quiz', description: 'Players join with a code. You control the pace, one question at a time.' },
};

/** The section (and page title) for a path inside a project, e.g. "/flashcards" -> Practice. */
export const sectionFor = (rest) => {
  const path = rest.replace(/\/$/, '');
  for (const section of SECTIONS) {
    if (section.path === path) return { section, page: section };
    const child = section.children?.find((c) => c.path === path);
    if (child) return { section, page: { ...section, title: child.label, description: child.description || section.description, child } };
  }
  const extra = EXTRA[path];
  if (extra) {
    const section = SECTIONS.find((s) => s.key === extra.section);
    return { section, page: { ...section, ...extra } };
  }
  return { section: SECTIONS[0], page: SECTIONS[0] };
};
