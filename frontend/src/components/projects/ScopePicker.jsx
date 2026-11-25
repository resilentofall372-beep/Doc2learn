
/** Choose "Whole project" or a single document. `value` is a document id, or '' for the whole project. */
const ScopePicker = ({ documents, value, onChange, label = 'Source', id = 'scope' }) => (
  <div>
    <label htmlFor={id} className="label">{label}</label>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input">
      <option value="">
        Whole project ({documents.length} {documents.length === 1 ? 'document' : 'documents'})
      </option>
      {documents.map((doc) => (
        <option key={doc._id} value={doc._id}>
          {doc.filename}
        </option>
      ))}
    </select>
  </div>
);

export default ScopePicker;
