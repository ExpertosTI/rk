import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, CircleCheck, MessageCircle } from 'lucide-react';
import {
  BRAND,
  PRODUCTS,
  PLAZOS,
  PROVINCIAS,
  GARANTIA_LABELS,
  type ProductKey,
} from '../../lib/constants';
import { STEP_TITLES } from '../../lib/form-ui';
import {
  creditFormSchema,
  step1Fields,
  type CreditFormData,
} from '../../lib/schema';
import { formatCurrency, formatPhone } from '../../lib/formatters';

interface Props {
  initialProduct?: ProductKey;
}

interface Submission extends CreditFormData {
  id: string;
  fecha: string;
  estado: string;
}

const TOTAL_STEPS = 3;

export default function CreditForm({ initialProduct }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    reset,
    formState: { errors },
  } = useForm<CreditFormData>({
    resolver: zodResolver(creditFormSchema),
    defaultValues: {
      producto: initialProduct,
      monto: '',
      plazo: '',
      garantia: undefined,
      nombre: '',
      whatsapp: '',
      email: '',
      ingresos: '',
      provincia: '',
      comentarios: '',
      website: '',
    },
  });

  useEffect(() => {
    if (initialProduct) setValue('producto', initialProduct);
  }, [initialProduct, setValue]);

  function goToStep(next: number) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onStep1() {
    const valid = await trigger([...step1Fields]);
    if (valid) goToStep(2);
  }

  async function onSubmit(data: CreditFormData) {
    if (data.website) return;

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));

    const result: Submission = {
      ...data,
      id: 'RK-' + Date.now().toString(36).toUpperCase(),
      fecha: new Date().toISOString(),
      estado: 'nueva',
    };

    const stored = JSON.parse(localStorage.getItem('rk_solicitudes') || '[]');
    stored.unshift(result);
    localStorage.setItem('rk_solicitudes', JSON.stringify(stored));

    setSubmission(result);
    setSubmitting(false);
    goToStep(3);
  }

  function handleNewRequest() {
    reset();
    setSubmission(null);
    setStep(1);
  }

  const firstName = submission?.nombre.split(' ')[0] ?? '';
  const progress = (step / TOTAL_STEPS) * 100;
  const waMessage = submission
    ? encodeURIComponent(
        `Hola, soy ${submission.nombre}. Acabo de enviar una solicitud de financiamiento de ${PRODUCTS[submission.producto]} por ${submission.monto}. Referencia: ${submission.id}`,
      )
    : '';

  return (
    <>
      {step < 3 && (
        <div className="step-header">
          <div className="step-label">
            Paso {step} de {TOTAL_STEPS} — {STEP_TITLES[step - 1]}
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="hp-field" aria-hidden="true">
        <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      {step === 1 && (
        <div className="step">
          <div className="field">
            <label htmlFor="producto">Tipo de financiamiento <span className="req">*</span></label>
            <select id="producto" className={errors.producto ? 'error' : ''} {...register('producto')}>
              <option value="">Selecciona una opción</option>
              {(Object.entries(PRODUCTS) as [ProductKey, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {errors.producto && <div className="error-msg">{errors.producto.message}</div>}
          </div>

          <div className="field">
            <label htmlFor="monto">Monto aproximado (RD$) <span className="req">*</span></label>
            <input
              id="monto"
              type="text"
              inputMode="numeric"
              placeholder="Ej. RD$1,200,000"
              className={errors.monto ? 'error' : ''}
              {...register('monto', {
                onChange: (e) => { e.target.value = formatCurrency(e.target.value); },
              })}
            />
            {errors.monto && <div className="error-msg">{errors.monto.message}</div>}
          </div>

          <div className="field">
            <label htmlFor="plazo">Plazo deseado <span className="req">*</span></label>
            <select id="plazo" className={errors.plazo ? 'error' : ''} {...register('plazo')}>
              <option value="">Selecciona un plazo</option>
              {PLAZOS.map((p) => (
                <option key={p} value={String(p)}>{p} meses</option>
              ))}
            </select>
            {errors.plazo && <div className="error-msg">{errors.plazo.message}</div>}
          </div>

          <div className="field">
            <label>¿Tienes garantía? <span className="req">*</span></label>
            <div className="radio-group">
              {(['si', 'no', 'unsure'] as const).map((val) => (
                <div className="radio-pill" key={val}>
                  <input type="radio" id={`gar-${val}`} value={val} {...register('garantia')} />
                  <label htmlFor={`gar-${val}`}>
                    {val === 'unsure' ? 'No estoy seguro' : val === 'si' ? 'Sí' : 'No'}
                  </label>
                </div>
              ))}
            </div>
            {errors.garantia && <div className="error-msg">{errors.garantia.message}</div>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step">
          <div className="field">
            <label htmlFor="nombre">Nombre completo <span className="req">*</span></label>
            <input
              id="nombre"
              type="text"
              placeholder="Nombre y apellido"
              autoComplete="name"
              className={errors.nombre ? 'error' : ''}
              {...register('nombre')}
            />
            {errors.nombre && <div className="error-msg">{errors.nombre.message}</div>}
          </div>

          <div className="field">
            <label htmlFor="whatsapp">WhatsApp <span className="req">*</span></label>
            <input
              id="whatsapp"
              type="tel"
              placeholder="(809) 000-0000"
              autoComplete="tel"
              className={errors.whatsapp ? 'error' : ''}
              {...register('whatsapp', {
                onChange: (e) => { e.target.value = formatPhone(e.target.value); },
              })}
            />
            <div className="hint">Te contactaremos por aquí</div>
            {errors.whatsapp && <div className="error-msg">{errors.whatsapp.message}</div>}
          </div>

          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              className={errors.email ? 'error' : ''}
              {...register('email')}
            />
            {errors.email && <div className="error-msg">{errors.email.message}</div>}
          </div>

          <div className="field">
            <label htmlFor="ingresos">Ingresos mensuales (RD$) <span className="req">*</span></label>
            <input
              id="ingresos"
              type="text"
              inputMode="numeric"
              placeholder="Ej. RD$45,000"
              className={errors.ingresos ? 'error' : ''}
              {...register('ingresos', {
                onChange: (e) => { e.target.value = formatCurrency(e.target.value); },
              })}
            />
            {errors.ingresos && <div className="error-msg">{errors.ingresos.message}</div>}
          </div>

          <div className="field">
            <label htmlFor="provincia">Provincia / Ciudad <span className="req">*</span></label>
            <select id="provincia" className={errors.provincia ? 'error' : ''} {...register('provincia')}>
              <option value="">Selecciona tu ubicación</option>
              {PROVINCIAS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {errors.provincia && <div className="error-msg">{errors.provincia.message}</div>}
          </div>

          <div className="field">
            <label htmlFor="comentarios">Comentarios adicionales</label>
            <textarea
              id="comentarios"
              placeholder="Opcional"
              {...register('comentarios')}
            />
          </div>
        </div>
      )}

      {step === 3 && submission && (
        <div className="step success-wrap">
          <div className="success-icon">
            <CircleCheck size={32} color="#3AAA35" strokeWidth={1.75} />
          </div>
          <h2 className="confirm-title">¡Solicitud enviada!</h2>
          <p className="confirm-text">
            Listo, {firstName}. Un asesor de RK Inversiones te contactará por WhatsApp en breve.
          </p>

          <div className="summary">
            {[
              ['Producto', PRODUCTS[submission.producto]],
              ['Monto', submission.monto],
              ['Plazo', `${submission.plazo} meses`],
              ['Garantía', GARANTIA_LABELS[submission.garantia]],
              ['Nombre', submission.nombre],
              ['WhatsApp', submission.whatsapp],
              ...(submission.email ? [['Email', submission.email]] : []),
              ['Ingresos', submission.ingresos],
              ['Ubicación', submission.provincia],
              ['Referencia', submission.id],
            ].map(([label, value]) => (
              <div className="summary-row" key={label}>
                <span className="label">{label}</span>
                <span className="value">{value}</span>
              </div>
            ))}
          </div>

          <div className="confirm-actions">
            <a
              className="btn-whatsapp"
              href={`https://wa.me/${BRAND.whatsapp}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} />
              Hablar con un asesor
            </a>
            <button type="button" className="btn-secondary" onClick={handleNewRequest}>
              Enviar otra solicitud
            </button>
          </div>
        </div>
      )}

      {step < 3 && (
        <div className="form-actions">
          {step > 1 && (
            <button type="button" className="btn-back" onClick={() => goToStep(step - 1)}>
              <ArrowLeft size={16} />
              Atrás
            </button>
          )}
          {step === 1 && (
            <button type="button" className="btn-next" onClick={onStep1}>
              Continuar
              <ArrowRight size={16} />
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="btn-next"
              disabled={submitting}
              onClick={handleSubmit(onSubmit)}
            >
              {submitting ? <span className="spinner" /> : (
                <>
                  Enviar solicitud
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}
