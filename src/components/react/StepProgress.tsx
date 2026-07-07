import { STEP_TITLES } from '../../lib/form-ui';

interface Props {
  step: number;
  total: number;
  transitioning?: boolean;
  transitionLabel?: string;
}

export default function StepProgress({ step, total, transitioning, transitionLabel }: Props) {
  return (
    <div className={`step-progress${transitioning ? ' transitioning' : ''}`}>
      <div className="step-progress-top">
        <span className="step-label">
          Paso {step} de {total} — {STEP_TITLES[step - 1]}
        </span>
        <span className="step-pct">{Math.round((step / total) * 100)}%</span>
      </div>

      <div className="progress-track" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        <div className="progress-fill" style={{ width: `${(step / total) * 100}%` }}>
          <div className="progress-glow" />
        </div>
      </div>

      <div className="step-pills">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div
              key={n}
              className={`step-pill${done ? ' done' : ''}${active ? ' active' : ''}`}
            >
              <span className="step-pill-dot" />
              <span className="step-pill-text">{STEP_TITLES[i]}</span>
            </div>
          );
        })}
      </div>

      {transitioning && (
        <div className="transition-banner">
          <span className="ai-dots"><i /><i /><i /></span>
          <span>{transitionLabel ?? 'Procesando...'}</span>
        </div>
      )}
    </div>
  );
}
