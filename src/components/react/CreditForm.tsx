import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  MessageCircle,
} from 'lucide-react';
import {
  BRAND,
  PRODUCTS,
  PLAZOS,
  PROVINCIAS,
  GARANTIA_LABELS,
  type ProductKey,
} from '../../lib/constants';
import { PRODUCT_ICONS } from '../../lib/icons';
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

const STEPS = [
  { label: 'Tu crédito', sub: 'Producto y monto' },
  { label: 'Tus datos', sub: 'Información personal' },
  { label: 'Confirmación', sub: 'Listo para enviar' },
];

export default function CreditForm({ initialProduct }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);

  const {
    register,
    handleSubmit,
    watch,
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

  const producto = watch('producto');

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
    await new Promise((r) => setTimeout(r, 1200));

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

  function selectProduct(key: ProductKey) {
    setValue('producto', key, { shouldValidate: true });
  }

  const firstName = submission?.nombre.split(' ')[0] ?? '';
  const waMessage = submission
    ? encodeURIComponent(
        `Hola, soy ${submission.nombre}. Acabo de enviar una solicitud de financiamiento de ${PRODUCTS[submission.producto].label} por ${submission.monto}. Referencia: ${submission.id}`,
      )
    : '';

  return (
    <>
      {step < 3 && (
        <div className="step-header">
          <div className="step-dots">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={s.label} style={{ display: 'contents' }}>
                  {i > 0 && (
                    <div className="step-line">
                      <div
                        className="step-line-fill"
                        style={{ width: done || active ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                  <div className={`step-dot${active ? ' active' : ''}${done ? ' done' : ''}`}>
                    {done ? <Check size={13} strokeWidth={2.5} /> : n}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="step-label">{STEPS[step - 1].label}</div>
          <div className="step-sublabel">{STEPS[step - 1].sub}</div>
        </div>
      )}

      <div className="hp-field" aria-hidden="true">
        <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      {step === 1 && (
        <div className="step">
          <div className="field">
            <label>Tipo de financiamiento <span className="req">*</span></label>
            <div className="product-grid" role="group" aria-label="Tipo de financiamiento">
              {(Object.entries(PRODUCTS) as [ProductKey, (typeof PRODUCTS)[ProductKey]][]).map(
                ([key, p]) => {
                  const Icon = PRODUCT_ICONS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`product-card${producto === key ? ' selected' : ''}`}
                      onClick={() => selectProduct(key)}
                      aria-pressed={producto === key}
                    >
                      <div className="product-check">
                        <Check size={11} strokeWidth={3} />
                      </div>
                      <div className="product-icon-wrap">
                        <Icon strokeWidth={1.75} />
                      </div>
                      <div className="product-card-text">
                        <span>{p.label}</span>
                        <small>{p.desc}</small>
                      </div>
                    </button>
                  );
                },
              )}
            </div>
            {errors.producto && <div className="error-msg">{errors.producto.message}</div>}
          </div>

          <div className="field">
            <label htmlFor="monto">Monto aproximado <span className="req">*</span></label>
            <input
              id="monto"
              type="text"
              inputMode="numeric"
              placeholder="RD$800,000"
              className={errors.monto ? 'error' : ''}
              {...register('monto', {
                onChange: (e) => { e.target.value = formatCurrency(e.target.value); },
              })}
            />
            <div className="hint">Mínimo RD${BRAND.minAmount.toLocaleString('es-DO')}</div>
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
          <div className="assistant">
            <div className="assistant-avatar">RK</div>
            <div className="assistant-text">
              <strong>Te asiste el equipo RK</strong>
              Completa tus datos y te contactamos por WhatsApp en breve.
            </div>
          </div>

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
            <label htmlFor="ingresos">Ingresos mensuales <span className="req">*</span></label>
            <input
              id="ingresos"
              type="text"
              inputMode="numeric"
              placeholder="RD$45,000"
              className={errors.ingresos ? 'error' : ''}
              {...register('ingresos', {
                onChange: (e) => { e.target.value = formatCurrency(e.target.value); },
              })}
            />
            <div className="hint">Aproximado, lo que recibes al mes</div>
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
              placeholder="Cuéntanos más sobre lo que necesitas (opcional)"
              {...register('comentarios')}
            />
          </div>
        </div>
      )}

      {step === 3 && submission && (
        <div className="step">
          <div className="success-icon">
            <CircleCheck size={36} color="#3AAA35" strokeWidth={1.75} />
          </div>
          <h2 className="confirm-title">¡Solicitud enviada!</h2>
          <p className="confirm-text">
            Listo, {firstName}. Un asesor de RK Inversiones te contactará por WhatsApp en breve.
          </p>

          <div className="summary">
            {[
              ['Producto', PRODUCTS[submission.producto].label],
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
              <MessageCircle size={20} />
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
              <ArrowLeft size={16} strokeWidth={2} />
              Atrás
            </button>
          )}
          {step === 1 && (
            <button type="button" className="btn-next" onClick={onStep1}>
              Continuar
              <ArrowRight size={16} strokeWidth={2} />
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="btn-next"
              disabled={submitting}
              onClick={handleSubmit(onSubmit)}
            >
              {submitting ? (
                <span className="spinner" />
              ) : (
                <>
                  Enviar solicitud
                  <ArrowRight size={16} strokeWidth={2} />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}
