import React from 'react';

const QuizProgress = ({ current, total }) => (
  <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}>
    <div className="progress-bar" style={{ width: `${(current / total) * 100}%` }} />
  </div>
);

export default QuizProgress;
