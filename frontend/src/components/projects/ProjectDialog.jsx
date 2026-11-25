import { useEffect, useRef, useState } from 'react';
import { FolderPlus, Pencil } from 'lucide-react';
import { AVATAR_COLORS } from '../ui/Avatar';
import Dialog from '../ui/Dialog';
import LoadingSpinner from '../common/LoadingSpinner';

/** Create or edit a project. `project` is null when creating. */
const ProjectDialog = ({ open, project, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(project?.name || '');
    setDescription(project?.description || '');
    setColor(Number((project?.color || 'c0').slice(1)) || 0);
    setError(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  }, [open, project]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the project a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim(), color: `c${color}` });
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save the project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={saving}
      as="form"
      onSubmit={submit}
      size="sm"
      icon={project ? Pencil : FolderPlus}
      title={project ? 'Edit project' : 'New project'}
      description={project ? 'Rename it or change its colour.' : 'One project per subject: its documents, topics and progress live together.'}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost" disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <LoadingSpinner size="small" />}
            {project ? 'Save' : 'Create project'}
          </button>
        </>
      }
    >
      <div className="space-y-5 p-5">
        {error && <div className="alert alert-danger">{error}</div>}
        <div>
          <label htmlFor="project-name" className="label">Name</label>
          <input id="project-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Biology 101" className="input" />
        </div>
        <div>
          <label htmlFor="project-description" className="label">
            Description <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="What is this project for?"
            className="input resize-none"
          />
        </div>
        <div>
          <span className="label">Colour</span>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((bg, i) => (
              <button
                key={bg}
                type="button"
                onClick={() => setColor(i)}
                aria-label={`Colour ${i + 1}`}
                aria-pressed={color === i}
                className={`h-7 w-7 rounded-full ${bg} ring-offset-2 transition dark:ring-offset-zinc-900 ${color === i ? 'ring-2 ring-zinc-900 dark:ring-zinc-100' : 'hover:scale-105'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ProjectDialog;
