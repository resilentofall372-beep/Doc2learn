import { useEffect, useMemo, useState } from 'react';
import { topicsAPI } from '../services/api';

/** The project's outline topics ([] until one is built). `titles` maps topic id -> title. */
export const useTopics = (projectId) => {
  const [topics, setTopics] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    topicsAPI
      .get(projectId)
      .then((res) => alive && setTopics(res.data.outline?.topics || []))
      .catch(() => alive && setTopics([]))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const titles = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t.title])), [topics]);
  return { topics, titles, loaded };
};
