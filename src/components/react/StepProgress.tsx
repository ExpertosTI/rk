import { STEP_TITLES } from '../../lib/form-ui';

interface FieldStatus {
  key: string;
  label: string;
  done: boolean;
}

interface Props {
  step: number;
  total: number;
  stepPct: number;
  overallPct: number;
  filled: number;
  fieldTotal: number;
  fields: FieldStatus[];
  transitioning?: boolean;
  transitionLabel?: string;
}

export default function StepProgress({
  step,
  total,
  stepPct,
  overallPct,
  filled,
  fieldTotal,
  fields,
  transitioning,
  transitionLabel,
}: Props) {
  return (
    <div className={`step-progress${transitioning ? ' transitioning' : ''}`}>
      <div className="step-progress-top">
        <span className="step-label">
          Paso {step} de {total} — {STEP_TITLES[step - 1]}
        </span>
        <span className="step-pct step-pct-total" aria-label="Progreso total">
          Total {overallPct}%
        </span>
      </div>

      <div
        className="progress-track progress-track-overall"
        role="progressbar"
        aria-valuenow={overallPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso total del formulario"
      >
        <div className="progress-fill" style={{ width: `${overallPct}%` }}>
          <div className="progress-glow" />
        </div>
      </div>

      <div className="step-progress-meta">
        <div className="step-progress-ring" style={{ '--pct': stepPct } as React.CSSProperties}>
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle className="ring-bg" cx="18" cy="18" r="15.5" />
            <circle className="ring-fill" cx="18" cy="18" r="15.5" />
          </svg>
          <span className="ring-label">{filled}/{fieldTotal}</span>
        </div>
        <div className="step-progress-copy">
          <strong>{filled} de {fieldTotal} campos</strong>
          <span>completados en este paso ({stepPct}%)</span>
        </div>
      </div>

      <ul className="field-checklist">
        {fields.map((f) => (
          <li key={f.key} className={f.done ? 'done' : ''}>
            <span className="field-check-dot" />
            {f.label}
          </li>
        ))}
      </ul>

      <div className="step-pills">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={n} className={`step-pill${done ? ' done' : ''}${active ? ' active' : ''}`}>
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
