import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import {
  creditFormSchema,
  step1Fields,
  type CreditFormData,
} from '../../lib/schema';
import { formatCurrency, formatPhone, formatCedula } from '../../lib/formatters';
import { overallCompletion, stepCompletion } from '../../lib/form-ui';
import {
  logFormEvent,
  resetSolicitudSession,
  saveDraft,
  submitSolicitud,
} from '../../lib/solicitudes';
import ModernSelect from './ModernSelect';
import ProductStack from './ProductStack';
import CedulaUpload from './CedulaUpload';
import StepProgress from './StepProgress';

interface Props {
  initialProduct?: ProductKey;
}

interface Submission extends CreditFormData {
  id: string;
  fecha: string;
  estado: string;
}

const TOTAL_STEPS = 3;

const TRANSITION_MSG: Record<number, string> = {
  1: 'El buró de crédito está verificando tu información...',
  2: 'Analizando tu perfil — preparando la aprobación de tu préstamo...',
};

const SUBMIT_MSG = 'Verificando con el buró y confirmando tu préstamo...';

export default function CreditForm({ initialProduct }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    reset,
    watch,
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
      numeroCedula: '',
      comentarios: '',
      cedulaData: '',
      cedulaNombre: '',
      cedulaMime: '',
      autorizaDatos: false,
      aceptaPrivacidad: false,
      aceptaTerminos: false,
      website: '',
    },
  });

  const watched = watch();
  const currentStepProgress = useMemo(
    () => stepCompletion(step, watched),
    [step, watched],
  );
  const overallPct = useMemo(
    () => overallCompletion(step, TOTAL_STEPS, currentStepProgress.pct),
    [step, currentStepProgress.pct],
  );

  useEffect(() => {
    if (initialProduct) setValue('producto', initialProduct);
  }, [initialProduct, setValue]);

  useEffect(() => {
    logFormEvent('form_open', { paso: 1, progresoPct: 0 });
  }, []);

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step >= 3 || submission) return;

    const progresoCampos = Object.fromEntries(
      currentStepProgress.fields.map((f) => [f.key, f.done]),
    );

    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const { cedulaData: _c, cedulaNombre: _n, cedulaMime: _m, ...draftSafe } = watched;
      saveDraft(draftSafe, step, overallPct, progresoCampos);
      logFormEvent('draft_save', {
        paso: step,
        progresoPct: overallPct,
        payload: { campos: progresoCampos },
      });
    }, 900);

    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [watched, step, overallPct, currentStepProgress.fields, submission]);

  async function goToStep(next: number) {
    setTransitioning(true);
    await logFormEvent('step_change', { paso: next, progresoPct: overallPct });
    await new Promise((r) => setTimeout(r, 650));
    setStep(next);
    setTransitioning(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onStep1() {
    const valid = await trigger([...step1Fields]);
    if (valid) await goToStep(2);
  }

  async function onSubmit(data: CreditFormData) {
    if (data.website) return;

    setSubmitting(true);
    setTransitioning(true);
    await new Promise((r) => setTimeout(r, 1400));

    const { solicitud, syncOk } = await submitSolicitud(data, 100);

    const result: Submission = {
      ...data,
      id: solicitud.id,
      fecha: solicitud.fecha,
      estado: solicitud.estado,
    };

    if (!syncOk) {
      const stored = JSON.parse(localStorage.getItem('rk_solicitudes') || '[]');
      stored.unshift(result);
      localStorage.setItem('rk_solicitudes', JSON.stringify(stored));
    }

    setSubmission(result);
    setSubmitting(false);
    setTransitioning(false);
    setStep(3);
  }

  function handleNewRequest() {
    resetSolicitudSession();
    reset({
      producto: undefined,
      monto: '',
      plazo: '',
      garantia: undefined,
      nombre: '',
      whatsapp: '',
      email: '',
      ingresos: '',
      provincia: '',
      numeroCedula: '',
      comentarios: '',
      cedulaData: '',
      cedulaNombre: '',
      cedulaMime: '',
      autorizaDatos: false,
      aceptaPrivacidad: false,
      aceptaTerminos: false,
      website: '',
    });
    setSubmission(null);
    setStep(1);
  }

  const firstName = submission?.nombre.split(' ')[0] ?? '';
  const waMessage = submission
    ? encodeURIComponent(
        `Hola, soy ${submission.nombre}. Acabo de enviar una solicitud de financiamiento de ${PRODUCTS[submission.producto]} por ${submission.monto}. Referencia: ${submission.id}`,
      )
    : '';

  const plazoOptions = PLAZOS.map((p) => ({ value: String(p), label: `${p} meses` }));
  const provinciaOptions = PROVINCIAS.map((p) => ({ value: p, label: p }));

  return (
    <>
      {step < 3 && (
        <StepProgress
          step={step}
          total={TOTAL_STEPS}
          stepPct={currentStepProgress.pct}
          overallPct={overallPct}
          filled={currentStepProgress.filled}
          fieldTotal={currentStepProgress.total}
          fields={currentStepProgress.fields}
          transitioning={transitioning || submitting}
          transitionLabel={submitting ? SUBMIT_MSG : TRANSITION_MSG[step]}
        />
      )}

      <div className="hp-field" aria-hidden="true">
        <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <div className={`step-content${transitioning || submitting ? ' is-loading' : ''}`}>
        {step === 1 && (
          <div className="step">
            <Controller
              name="producto"
              control={control}
              render={({ field }) => (
                <ProductStack
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={errors.producto?.message}
                />
              )}
            />

            <div className="field">
              <label htmlFor="monto">¿Cuánto necesitas? (RD$) <span className="req">*</span></label>
              <input
                id="monto"
                type="text"
                inputMode="numeric"
                placeholder="Ej. RD$1,200,000"
                className={`input-modern${errors.monto ? ' error' : ''}`}
                {...register('monto', {
                  onChange: (e) => { e.target.value = formatCurrency(e.target.value); },
                })}
              />
              <div className="hint">Monto mínimo: RD${BRAND.minAmount.toLocaleString('es-DO')}</div>
              {errors.monto && <div className="error-msg">{errors.monto.message}</div>}
            </div>

            <Controller
              name="plazo"
              control={control}
              render={({ field }) => (
                <ModernSelect
                  id="plazo"
                  label="Plazo deseado"
                  required
                  placeholder="¿En cuántos meses?"
                  options={plazoOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.plazo?.message}
                />
              )}
            />

            <div className="field">
              <label>¿Tienes garantía? <span className="req">*</span></label>
              <div className="segment-group">
                {(['si', 'no', 'unsure'] as const).map((val) => (
                  <label key={val} className="segment-item">
                    <input type="radio" value={val} {...register('garantia')} />
                    <span>{val === 'unsure' ? 'No estoy seguro' : val === 'si' ? 'Sí' : 'No'}</span>
                  </label>
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
                className={`input-modern${errors.nombre ? ' error' : ''}`}
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
                className={`input-modern${errors.whatsapp ? ' error' : ''}`}
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
                className={`input-modern${errors.email ? ' error' : ''}`}
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
                className={`input-modern${errors.ingresos ? ' error' : ''}`}
                {...register('ingresos', {
                  onChange: (e) => { e.target.value = formatCurrency(e.target.value); },
                })}
              />
              {errors.ingresos && <div className="error-msg">{errors.ingresos.message}</div>}
            </div>

            <Controller
              name="provincia"
              control={control}
              render={({ field }) => (
                <ModernSelect
                  id="provincia"
                  label="Provincia / Ciudad"
                  required
                  placeholder="¿Dónde te encuentras?"
                  options={provinciaOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.provincia?.message}
                  searchable
                />
              )}
            />

            <div className="field">
              <label htmlFor="comentarios">Comentarios adicionales</label>
              <textarea
                id="comentarios"
                className="input-modern"
                placeholder="Opcional"
                {...register('comentarios')}
              />
            </div>

            <div className="field">
              <label htmlFor="numeroCedula">Número de cédula <span className="req">*</span></label>
              <input
                id="numeroCedula"
                type="text"
                inputMode="numeric"
                placeholder="000-0000000-0"
                className={`input-modern${errors.numeroCedula ? ' error' : ''}`}
                {...register('numeroCedula', {
                  onChange: (e) => { e.target.value = formatCedula(e.target.value); },
                })}
              />
              <div className="hint">Requerido para consulta en DATACRÉDITO / TransUnion</div>
              {errors.numeroCedula && <div className="error-msg">{errors.numeroCedula.message}</div>}
            </div>

            <div className="field">
              <Controller
                name="cedulaData"
                control={control}
                render={() => (
                  <CedulaUpload
                    value={
                      watched.cedulaData
                        ? {
                            data: watched.cedulaData,
                            nombre: watched.cedulaNombre,
                            mime: watched.cedulaMime,
                          }
                        : null
                    }
                    onChange={(v) => {
                      setValue('cedulaData', v?.data ?? '', { shouldValidate: true });
                      setValue('cedulaNombre', v?.nombre ?? '');
                      setValue('cedulaMime', v?.mime ?? '');
                    }}
                    error={errors.cedulaData?.message}
                  />
                )}
              />
            </div>

            <div className="auth-block">
              <p className="auth-block-title">Autorizaciones requeridas</p>

              <div className="field terms-field">
                <label className="terms-check">
                  <input type="checkbox" {...register('autorizaDatos')} />
                  <span>
                    Autorizo a {BRAND.name} a <strong>verificar mi identidad</strong> con la cédula
                    subida y a consultar o reportar mis datos en centrales de riesgo (DATACRÉDITO),
                    conforme a la ley dominicana.
                  </span>
                </label>
                {errors.autorizaDatos && (
                  <div className="error-msg">{errors.autorizaDatos.message}</div>
                )}
              </div>

              <div className="field terms-field">
                <label className="terms-check">
                  <input type="checkbox" {...register('aceptaPrivacidad')} />
                  <span>
                    He leído y acepto la{' '}
                    <a href="/privacidad" target="_blank" rel="noopener noreferrer">
                      política de privacidad
                    </a>
                    , incluyendo el tratamiento de mi cédula y datos personales.
                  </span>
                </label>
                {errors.aceptaPrivacidad && (
                  <div className="error-msg">{errors.aceptaPrivacidad.message}</div>
                )}
              </div>

              <div className="field terms-field">
                <label className="terms-check">
                  <input type="checkbox" {...register('aceptaTerminos')} />
                  <span>
                    Acepto los{' '}
                    <a href="/terminos" target="_blank" rel="noopener noreferrer">
                      términos y condiciones de servicio
                    </a>.
                  </span>
                </label>
                {errors.aceptaTerminos && (
                  <div className="error-msg">{errors.aceptaTerminos.message}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 3 && submission && (
          <div className="step success-wrap">
            <div className="success-icon pulse-success">
              <CircleCheck size={36} color="#3AAA35" strokeWidth={1.75} />
            </div>
            <h2 className="confirm-title">¡Tu préstamo va en camino!</h2>

            <div className="bureau-banner">
              <span className="bureau-banner-dot" />
              <div>
                <strong>Buró de crédito en verificación</strong>
                <span>Tu solicitud fue recibida y estamos confirmando la aprobación de tu préstamo.</span>
              </div>
            </div>

            <p className="confirm-text">
              {firstName}, en breve te contactamos por WhatsApp con la respuesta de aprobación.
              La mayoría de solicitudes se aprueban en menos de 2 horas.
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
                ['Cédula', 'Recibida ✓'],
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
      </div>

      {step < 3 && (
        <div className="form-actions">
          {step > 1 && (
            <button type="button" className="btn-back" disabled={transitioning || submitting} onClick={() => goToStep(step - 1)}>
              <ArrowLeft size={16} />
              Atrás
            </button>
          )}
          {step === 1 && (
            <button type="button" className="btn-next btn-ai" disabled={transitioning} onClick={onStep1}>
              {transitioning ? <span className="spinner" /> : (
                <>
                  Continuar
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className={`btn-next btn-ai${submitting ? ' loading' : ''}`}
              disabled={submitting || transitioning}
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
