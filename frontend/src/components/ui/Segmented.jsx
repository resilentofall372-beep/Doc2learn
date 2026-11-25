
/** A row of mutually exclusive options. `options` is [{ value, label, hint? }]. */
const Segmented = ({ options, value, onChange, columns, label, id }) => (
  <div role="radiogroup" aria-labelledby={id}>
    {label && (
      <div id={id} className="label">
        {label}
      </div>
    )}
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns || options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`choice text-center ${active ? 'choice-active' : ''}`}
          >
            <span className="block">{option.label}</span>
            {option.hint && <span className="mt-0.5 block text-xs font-normal opacity-70">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  </div>
);

export default Segmented;
