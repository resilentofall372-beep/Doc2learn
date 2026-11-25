import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, FolderOpen, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { errorMessage, projectAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import ProjectDialog from '../components/projects/ProjectDialog';
import AddDocumentsDialog from '../components/document/AddDocumentsDialog';
import TodayPanel from '../components/dashboard/TodayPanel';
import { forgetProject } from '../components/projects/ProjectLayout';
import { colorFor } from '../components/ui/Avatar';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { timeAgo } from '../utils/time';

const CardMenu = ({ onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="btn btn-ghost btn-icon"
        aria-label="Project options"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="card absolute right-0 top-9 z-10 w-36 p-1 shadow-lg">
          <button type="button" onClick={(e) => { e.preventDefault(); setOpen(false); onEdit(); }} className="btn btn-ghost btn-sm w-full justify-start">
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          <button type="button" onClick={(e) => { e.preventDefault(); setOpen(false); onDelete(); }} className="btn btn-danger btn-sm w-full justify-start">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, project: null });
  const [created, setCreated] = useState(null); // new project waiting for its first files
  const { addNotification } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await projectAPI.list();
      setProjects(res.data.projects || []);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load projects', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (data) => {
    if (dialog.project) {
      const res = await projectAPI.update(dialog.project._id, data);
      forgetProject(dialog.project._id);
      setProjects((prev) => prev.map((p) => (p._id === dialog.project._id ? res.data.project : p)));
      setDialog({ open: false, project: null });
    } else {
      const res = await projectAPI.create(data);
      setDialog({ open: false, project: null });
      setProjects((prev) => [res.data.project, ...prev]);
      setCreated(res.data.project); // step 2: add files before opening it
    }
  };

  const openCreated = useCallback(() => {
    if (!created) return;
    setCreated(null);
    navigate(`/projects/${created._id}`);
  }, [created, navigate]);

  const remove = async (project) => {
    const files = project.document_count === 1 ? '1 document' : `${project.document_count} documents`;
    if (!window.confirm(`Delete "${project.name}"? Its ${files}, quizzes, flashcards and chat will be deleted too. This can't be undone.`)) return;
    try {
      await projectAPI.remove(project._id);
      forgetProject(project._id);
      setProjects((prev) => prev.filter((p) => p._id !== project._id));
      addNotification({ type: 'success', title: 'Project deleted', message: project.name });
    } catch (error) {
      addNotification({ type: 'error', title: 'Delete failed', message: errorMessage(error) });
    }
  };

  if (loading) return <PageLoader />;

  const firstName = user?.name?.split(' ')[0];

  return (
    <div>
      <PageHeader
        title="Projects"
        description={firstName ? `Welcome back, ${firstName}. Open a project to keep studying, or start a new one.` : undefined}
        actions={
          projects.length > 0 && (
            <button type="button" onClick={() => setDialog({ open: true, project: null })} className="btn btn-primary">
              <Plus className="h-4 w-4" />
              New project
            </button>
          )
        }
      />

      {projects.length > 0 && <TodayPanel expected={projects.length} />}

      {projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="Create your first project"
            description="A project holds the documents for one subject. The tutor, quizzes and flashcards work across all of them."
            action={
              <button type="button" onClick={() => setDialog({ open: true, project: null })} className="btn btn-primary">
                <Plus className="h-4 w-4" />
                Create project
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setDialog({ open: true, project: null })}
            className="flex min-h-[9.5rem] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-500 transition-colors hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-700 dark:border-zinc-700 dark:hover:border-primary-500 dark:hover:bg-primary-500/5 dark:hover:text-primary-300"
          >
            <Plus className="mb-2 h-5 w-5" />
            Create project
          </button>
          {projects.map((project) => (
            <Link
              key={project._id}
              to={`/projects/${project._id}`}
              className="card group flex min-h-[9.5rem] flex-col p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg text-sm font-semibold text-white ${colorFor(project.color, project.name)}`}>
                    {project.name.slice(0, 1).toUpperCase()}
                  </span>
                  <h2 className="truncate text-sm font-semibold group-hover:text-primary-600 dark:group-hover:text-primary-400" title={project.name}>
                    {project.name}
                  </h2>
                </div>
                <CardMenu onEdit={() => setDialog({ open: true, project })} onDelete={() => remove(project)} />
              </div>
              {project.description && <p className="muted mt-3 line-clamp-2 text-sm">{project.description}</p>}
              <div className="muted mt-auto flex items-center gap-3 pt-4 text-xs">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {project.document_count} {project.document_count === 1 ? 'document' : 'documents'}
                </span>
                <span>·</span>
                <span>Edited {timeAgo(project.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ProjectDialog
        open={dialog.open}
        project={dialog.project}
        onClose={() => setDialog({ open: false, project: null })}
        onSave={save}
      />

      <AddDocumentsDialog
        open={Boolean(created)}
        projectId={created?._id}
        title={created ? `Add documents to ${created.name}` : ''}
        description="Add the notes, slides or chapters for this subject. You can always add more later."
        skipLabel="Skip for now"
        doneLabel="Open project"
        onClose={openCreated}
      />
    </div>
  );
};

export default Projects;
