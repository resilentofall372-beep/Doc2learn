// The open project (and its documents), shared by the sidebar and the project pages.
// ProjectLayout loads it; anything can read it with useProjectData(projectId).
import { useEffect, useState } from 'react';

const cache = new Map();
const listeners = new Set();
const emit = (projectId) => listeners.forEach((listener) => listener(projectId));

export const projectStore = {
  get: (projectId) => cache.get(projectId) || null,
  set(projectId, data) {
    cache.set(projectId, data);
    emit(projectId);
  },
  forget(projectId) {
    cache.delete(projectId);
    emit(projectId);
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** { project, documents } for a project once loaded, else null. Re-renders when it changes. */
export const useProjectData = (projectId) => {
  const [data, setData] = useState(() => (projectId ? projectStore.get(projectId) : null));
  useEffect(() => {
    setData(projectId ? projectStore.get(projectId) : null);
    if (!projectId) return undefined;
    return projectStore.subscribe((changed) => {
      if (changed === projectId) setData(projectStore.get(projectId));
    });
  }, [projectId]);
  return data;
};
