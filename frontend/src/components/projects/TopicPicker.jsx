import { Link } from 'react-router-dom';

/** Choose one topic from the outline, or "All topics" (''). Shows a hint to build an outline when there is none. */
const TopicPicker = ({ projectId, topics, value, onChange, label = 'Topic', id = 'topic' }) => {
  if (!topics.length) {
    return (
      <div>
        <span className="label">{label}</span>
        <p className="muted text-sm">
          <Link to={`/projects/${projectId}/topics`} className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
            Build a topic outline
          </Link>{' '}
          to study one topic at a time.
        </p>
      </div>
    );
  }
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">All topics</option>
        {topics.map((topic, i) => (
          <option key={topic.id} value={topic.id}>
            {i + 1}. {topic.title}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TopicPicker;
