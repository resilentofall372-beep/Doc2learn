
const QuizQuestion = ({ question, selectedAnswer, onAnswerSelect }) => {
  if (!question) return null;
  return (
    <div>
      <h2 className="text-lg font-medium leading-relaxed text-zinc-900 dark:text-zinc-50">{question.question}</h2>
      <div className="mt-6 space-y-2.5" role="radiogroup">
        {Object.entries(question.options).map(([key, value]) => {
          const active = selectedAnswer === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onAnswerSelect(key)}
              className={`choice flex w-full items-start gap-3 px-4 py-3 text-left font-normal ${active ? 'choice-active' : ''}`}
            >
              <span
                className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md border text-xs font-semibold ${
                  active
                    ? 'border-primary-600 bg-primary-600 text-white dark:border-primary-400 dark:bg-primary-500'
                    : 'border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400'
                }`}
              >
                {key}
              </span>
              <span className="pt-0.5 text-sm text-zinc-800 dark:text-zinc-200">{value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuizQuestion;
