import { z } from 'zod';
import { BRAND } from './constants';
import { parseCurrency, phoneDigits, cedulaDigits } from './formatters';

export const creditFormSchema = z.object({
  producto: z.enum(['apartamentos', 'casas', 'vehiculos', 'solares'], {
    message: 'Selecciona un tipo de financiamiento',
  }),
  monto: z
    .string()
    .min(1, 'Ingresa el monto aproximado')
    .refine((v) => parseCurrency(v) >= BRAND.minAmount, {
      message: `El monto mínimo es RD$${BRAND.minAmount.toLocaleString('es-DO')}`,
    }),
  plazo: z.string().min(1, 'Selecciona un plazo'),
  garantia: z.enum(['si', 'no', 'unsure'], {
    message: 'Indica si tienes garantía',
  }),
  nombre: z.string().min(3, 'Ingresa tu nombre completo'),
  whatsapp: z
    .string()
    .refine((v) => phoneDigits(v).length === 10, {
      message: 'Ingresa un número válido: (809) 000-0000',
    }),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'Correo electrónico no válido',
    }),
  ingresos: z.string().min(1, 'Ingresa tus ingresos mensuales'),
  cuotaMensual: z
    .string()
    .min(1, 'Indica cuánto podrías pagar al mes')
    .refine((v) => parseCurrency(v) >= 1_000, {
      message: 'Ingresa un monto mensual válido (mín. RD$1,000)',
    }),
  provincia: z.string().min(1, 'Selecciona tu provincia o ciudad'),
  numeroCedula: z
    .string()
    .min(1, 'Ingresa tu número de cédula')
    .refine((v) => /^\d{11}$/.test(cedulaDigits(v)), {
      message: 'La cédula debe tener 11 dígitos',
    }),
  comentarios: z.string().optional(),
  cedulaData: z.string().min(80, 'Sube una foto clara de tu cédula'),
  cedulaNombre: z.string().min(1),
  cedulaMime: z.string().min(1),
  autorizaDatos: z.boolean().refine((v) => v === true, {
    message: 'Debes autorizar la verificación de tus datos',
  }),
  aceptaPrivacidad: z.boolean().refine((v) => v === true, {
    message: 'Debes aceptar la política de privacidad',
  }),
  aceptaTerminos: z.boolean().refine((v) => v === true, {
    message: 'Debes aceptar los términos y condiciones',
  }),
  website: z.string().max(0).optional(), // honeypot
});

export type CreditFormData = z.infer<typeof creditFormSchema>;

export const step1Fields = ['producto', 'monto', 'plazo', 'garantia'] as const;
export const step2Fields = ['nombre', 'whatsapp', 'email', 'ingresos', 'cuotaMensual', 'provincia'] as const;
