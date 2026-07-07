import { z } from 'zod';
import { BRAND } from './constants';
import { parseCurrency, phoneDigits } from './formatters';

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
  provincia: z.string().min(1, 'Selecciona tu provincia o ciudad'),
  comentarios: z.string().optional(),
  website: z.string().max(0).optional(), // honeypot
});

export type CreditFormData = z.infer<typeof creditFormSchema>;

export const step1Fields = ['producto', 'monto', 'plazo', 'garantia'] as const;
export const step2Fields = ['nombre', 'whatsapp', 'email', 'ingresos', 'provincia'] as const;
