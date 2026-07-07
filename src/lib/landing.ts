import type { ProductKey } from './constants';
import { BRAND, MARKETING, PRODUCTS } from './constants';

export const NAV_LINKS = [
  { href: '#solicitar', label: 'Solicitar' },
  { href: '#productos', label: 'Productos' },
  { href: '#nosotros', label: 'Nosotros' },
] as const;

export const PROMO = {
  text: `${MARKETING.approval} · ${BRAND.slogan}`,
} as const;

export const HERO = {
  title: 'Tu aliado en financiamiento',
  subtitle:
    'Apartamentos, casas, vehículos y solares en República Dominicana. Cotiza, solicita y recibe respuesta por WhatsApp.',
  ctaPrimary: 'Solicitar financiamiento',
  ctaWhatsApp: 'WhatsApp',
  tagline: `${BRAND.slogan} — con el respaldo de ${BRAND.name}.`,
} as const;

export const FORM_SECTION = {
  eyebrow: 'Solicitud en línea',
  title: 'Solicita tu financiamiento',
  lead: 'Unos pasos rápidos — sin compromiso.',
} as const;

export const STRIP = {
  title: 'Metas reales, financiamiento accesible.',
  caption: BRAND.name,
} as const;

export const PRODUCT_LINES: { key: ProductKey; label: string; desc: string }[] = [
  {
    key: 'vehiculos',
    label: PRODUCTS.vehiculos,
    desc: 'Nuevos y usados. Hasta 60 meses. Aprobación inmediata.',
  },
  {
    key: 'apartamentos',
    label: PRODUCTS.apartamentos,
    desc: 'Financiamiento para el apartamento que tu familia necesita.',
  },
  {
    key: 'casas',
    label: PRODUCTS.casas,
    desc: 'Vivienda propia o inversión inmobiliaria con asesoría personal.',
  },
  {
    key: 'solares',
    label: PRODUCTS.solares,
    desc: 'Terrenos y solares para proyectos a mediano plazo.',
  },
];

export const PRODUCT_CARDS = PRODUCT_LINES;

export const PRODUCTS_SECTION = {
  eyebrow: 'Productos',
  title: 'Líneas de financiamiento',
  lead: 'Cada línea responde a una necesidad distinta. Te orientamos para elegir la opción adecuada.',
} as const;

export const ABOUT = {
  eyebrow: 'Sobre nosotros',
  title: BRAND.name,
  lead: `Empresa de financiamiento en ${BRAND.city}, ${BRAND.country}.`,
  text: `${BRAND.advisor}, ${BRAND.advisorRole}, coordina la atención desde la primera consulta. Trato directo, condiciones claras y respuesta ágil.`,
} as const;

export const FOOTER = {
  tagline: `${BRAND.slogan} — ${BRAND.city}, ${BRAND.country}.`,
  email: BRAND.email,
  phone: BRAND.phone,
  whatsapp: BRAND.whatsapp,
} as const;

export const PRODUCT_STACK: Record<ProductKey, string> = {
  apartamentos: 'Financiamiento de apartamentos',
  casas: 'Financiamiento de casas',
  vehiculos: 'Financiamiento de vehículos',
  solares: 'Financiamiento de solares y terrenos',
};
