import { BookOpenCheck, FolderOpen, Quote, Radio, ShieldCheck } from 'lucide-react';

/** The product's selling points, shared by the home page and the sign-in screens. */
export const PRODUCT_POINTS = [
  {
    icon: FolderOpen,
    title: 'One project per subject',
    text: 'Keep each course in its own project: lecture notes, slides and chapters together.',
  },
  {
    icon: Quote,
    title: 'Answers you can check',
    text: 'The tutor answers only from your files and cites the document and page each answer comes from.',
  },
  {
    icon: BookOpenCheck,
    title: 'Practice that adapts',
    text: 'Quizzes, flashcards and a study plan across a whole project, or focused on one file.',
  },
  {
    icon: Radio,
    title: 'Study together',
    text: 'Host a live quiz from any project. Friends join with a six-letter code.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by default',
    text: 'Your projects are visible only to you.',
  },
];
