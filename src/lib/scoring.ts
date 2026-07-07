import type { ProductKey } from './constants';
import { GARANTIA_LABELS } from './constants';
import type { CreditFormData } from './schema';
import { parseCurrency } from './formatters';

/** Tasa anual referencial para estimar cuota (evaluación preliminar RK) */
export const TASA_ANUAL_REF = 0.28;

export type NivelPuntuacion = 'excelente' | 'buena' | 'regular' | 'baja' | 'insuficiente';

export interface DesglosePuntuacion {
  completitud: number;
  capacidadPago: number;
  plazoMonto: number;
  garantia: number;
  coherenciaCuota: number;
}

export interface ResultadoPuntuacion {
  total: number;
  nivel: NivelPuntuacion;
  cuotaEstimada: number;
  cuotaDeclarada: number;
  ingresos: number;
  ratioPagoPct: number;
  plazoMeses: number;
  monto: number;
  desglose: DesglosePuntuacion;
  resumen: string;
}

export interface DatosPuntuacion {
  producto?: ProductKey | null;
  monto?: string | null;
  plazo?: string | null;
  garantia?: keyof typeof GARANTIA_LABELS | null;
  ingresos?: string | null;
  cuotaMensual?: string | null;
  email?: string | null;
  numeroCedula?: string | null;
  comentarios?: string | null;
  completada?: boolean;
  progreso_pct?: number;
  paso_actual?: number;
  cedula_recibida?: boolean;
  autoriza_datos?: boolean;
  acepta_privacidad?: boolean;
  acepta_terminos?: boolean;
  progreso_campos?: Record<string, boolean> | null;
}

export function cuotaMensualEstimada(
  monto: number,
  plazoMeses: number,
  tasaAnual = TASA_ANUAL_REF,
): number {
  if (monto <= 0 || plazoMeses <= 0) return 0;
  const r = tasaAnual / 12;
  if (r <= 0) return Math.round(monto / plazoMeses);
  const factor = (1 + r) ** plazoMeses;
  return Math.round((monto * r * factor) / (factor - 1));
}

function nivelDesde(total: number): NivelPuntuacion {
  if (total >= 80) return 'excelente';
  if (total >= 60) return 'buena';
  if (total >= 40) return 'regular';
  if (total > 0) return 'baja';
  return 'insuficiente';
}

function labelNivel(n: NivelPuntuacion): string {
  const map: Record<NivelPuntuacion, string> = {
    excelente: 'Excelente',
    buena: 'Buena',
    regular: 'Regular',
    baja: 'Baja',
    insuficiente: 'Sin datos',
  };
  return map[n];
}

function puntosCompletitud(d: DatosPuntuacion): number {
  let pts = 0;
  if (d.completada) pts += 12;
  else if (typeof d.progreso_pct === 'number') pts += Math.round((d.progreso_pct / 100) * 12);

  if (d.cedula_recibida) pts += 4;
  if (d.numero_cedula?.replace(/\D/g, '').length === 11) pts += 2;
  if (d.email?.includes('@')) pts += 2;
  if (d.comentarios?.trim()) pts += 1;
  if (d.autoriza_datos && d.acepta_privacidad && d.acepta_terminos) pts += 4;

  return Math.min(25, pts);
}

function puntosCapacidadPago(cuota: number, ingresos: number): number {
  if (cuota <= 0 || ingresos <= 0) return 0;
  const ratio = cuota / ingresos;
  if (ratio <= 0.2) return 30;
  if (ratio <= 0.3) return 24;
  if (ratio <= 0.4) return 18;
  if (ratio <= 0.5) return 10;
  if (ratio <= 0.65) return 4;
  return 0;
}

function puntosPlazoMonto(monto: number, plazoMeses: number, producto?: ProductKey | null): number {
  if (monto <= 0 || plazoMeses <= 0) return 0;
  const cuotaSinInteres = monto / plazoMeses;
  let pts = 10;

  // Plazos muy largos para montos bajos = más riesgo
  if (monto < 200_000 && plazoMeses >= 48) pts -= 4;
  if (monto >= 500_000 && plazoMeses <= 24) pts += 3;

  // Producto coherente con monto típico
  if (producto === 'vehiculos' && monto >= 300_000) pts += 2;
  if (producto === 'solares' && monto >= 150_000) pts += 2;
  if (producto === 'casas' && monto >= 1_000_000) pts += 2;

  // Cuota mínima razonable
  if (cuotaSinInteres < 3_000) pts -= 3;

  return Math.max(0, Math.min(15, pts));
}

function puntosGarantia(garantia?: keyof typeof GARANTIA_LABELS | null): number {
  if (garantia === 'si') return 15;
  if (garantia === 'unsure') return 8;
  if (garantia === 'no') return 3;
  return 0;
}

function puntosCoherenciaCuota(cuotaEstimada: number, cuotaDeclarada: number): number {
  if (cuotaEstimada <= 0 || cuotaDeclarada <= 0) return 0;
  const diff = Math.abs(cuotaEstimada - cuotaDeclarada) / cuotaEstimada;
  if (diff <= 0.1) return 15;
  if (diff <= 0.2) return 12;
  if (cuotaDeclarada >= cuotaEstimada) return 10;
  if (diff <= 0.35) return 6;
  return 2;
}

export function calcularPuntuacion(datos: DatosPuntuacion): ResultadoPuntuacion {
  const monto = parseCurrency(datos.monto ?? '');
  const plazoMeses = Number(datos.plazo) || 0;
  const ingresos = parseCurrency(datos.ingresos ?? '');
  const cuotaDeclarada = parseCurrency(datos.cuotaMensual ?? '');
  const cuotaEstimada = cuotaMensualEstimada(monto, plazoMeses);

  const desglose: DesglosePuntuacion = {
    completitud: puntosCompletitud(datos),
    capacidadPago: puntosCapacidadPago(cuotaEstimada, ingresos),
    plazoMonto: puntosPlazoMonto(monto, plazoMeses, datos.producto),
    garantia: puntosGarantia(datos.garantia),
    coherenciaCuota: puntosCoherenciaCuota(cuotaEstimada, cuotaDeclarada),
  };

  const total = Math.min(
    100,
    desglose.completitud +
      desglose.capacidadPago +
      desglose.plazoMonto +
      desglose.garantia +
      desglose.coherenciaCuota,
  );

  const ratioPagoPct =
    ingresos > 0 && cuotaEstimada > 0 ? Math.round((cuotaEstimada / ingresos) * 100) : 0;

  const nivel = nivelDesde(total);
  let resumen = labelNivel(nivel);

  if (total >= 60 && ratioPagoPct > 0 && ratioPagoPct <= 35) {
    resumen += ' — capacidad de pago adecuada';
  } else if (ratioPagoPct > 50) {
    resumen += ' — cuota alta respecto a ingresos';
  } else if (!datos.completada && (datos.progreso_pct ?? 0) < 100) {
    resumen += ' — formulario incompleto';
  }

  return {
    total,
    nivel,
    cuotaEstimada,
    cuotaDeclarada,
    ingresos,
    ratioPagoPct,
    plazoMeses,
    monto,
    desglose,
    resumen,
  };
}

export function calcularPuntuacionForm(data: Partial<CreditFormData>, opts?: {
  completada?: boolean;
  progreso_pct?: number;
  paso_actual?: number;
  cedula_recibida?: boolean;
}): ResultadoPuntuacion {
  return calcularPuntuacion({
    producto: data.producto,
    monto: data.monto,
    plazo: data.plazo,
    garantia: data.garantia,
    ingresos: data.ingresos,
    cuotaMensual: data.cuotaMensual,
    email: data.email,
    numeroCedula: data.numeroCedula,
    comentarios: data.comentarios,
    completada: opts?.completada,
    progreso_pct: opts?.progreso_pct,
    paso_actual: opts?.paso_actual,
    cedula_recibida: opts?.cedula_recibida,
    autoriza_datos: data.autorizaDatos,
    acepta_privacidad: data.aceptaPrivacidad,
    acepta_terminos: data.aceptaTerminos,
  });
}

export function colorPuntuacion(nivel: NivelPuntuacion): string {
  const map: Record<NivelPuntuacion, string> = {
    excelente: '#16A34A',
    buena: '#2563EB',
    regular: '#F5A623',
    baja: '#DC2626',
    insuficiente: '#94A3B8',
  };
  return map[nivel];
}

export function formatMontoRD(n: number): string {
  if (n <= 0) return '—';
  return `RD$${n.toLocaleString('es-DO')}`;
}
