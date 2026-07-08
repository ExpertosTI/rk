import type { ProductKey } from './constants';
import { BRAND, MARKETING, PRODUCTS } from './constants';

export type LandingIconName =
  | 'building'
  | 'home'
  | 'car'
  | 'land'
  | 'zap'
  | 'clock'
  | 'shield'
  | 'phone'
  | 'whatsapp'
  | 'arrow-right'
  | 'calendar'
  | 'badge-check'
  | 'send';

export const PRODUCT_FORM_LINES: { key: ProductKey; label: string; desc: string; icon: LandingIconName }[] = [
  { key: 'apartamentos', label: PRODUCTS.apartamentos, desc: 'Vivienda para tu familia', icon: 'building' },
  { key: 'casas', label: PRODUCTS.casas, desc: 'Casa propia o inversión', icon: 'home' },
  { key: 'vehiculos', label: PRODUCTS.vehiculos, desc: 'Nuevos y usados · 60 meses', icon: 'car' },
  { key: 'solares', label: PRODUCTS.solares, desc: 'Terrenos y proyectos', icon: 'land' },
];

export const HERO_PERKS: { icon: LandingIconName; label: string }[] = [
  { icon: 'zap', label: MARKETING.badges[0] },
  { icon: 'clock', label: MARKETING.badges[1] },
  { icon: 'shield', label: MARKETING.badges[2] },
];

export const PRODUCT_CARDS = PRODUCT_FORM_LINES;

export const PRODUCT_STACK: Record<ProductKey, string> = {
  apartamentos: 'Financiamiento de apartamentos',
  casas: 'Financiamiento de casas',
  vehiculos: 'Financiamiento de vehículos',
  solares: 'Financiamiento de solares y terrenos',
};

export const PRODUCT_LINKS: { key: ProductKey; label: string; href: string }[] = [
  { key: 'apartamentos', label: PRODUCTS.apartamentos, href: '/solicitar?producto=apartamentos' },
  { key: 'casas', label: PRODUCTS.casas, href: '/solicitar?producto=casas' },
  { key: 'vehiculos', label: PRODUCTS.vehiculos, href: '/vehiculos' },
  { key: 'solares', label: PRODUCTS.solares, href: '/solicitar?producto=solares' },
];

export const GENERAL_PAGE = {
  title: 'FINANCIAMIENTO',
  subtitle: 'Apartamentos · Casas · Vehículos · Solares',
  image: '/brand/flyer-general.jpeg',
  cta: 'Solicitar financiamiento',
  ctaHref: '/solicitar',
  hero: {
    eyebrow: BRAND.slogan,
    title: 'Financia sin complicaciones',
    lead: 'Vivienda, vehículos y terrenos con respuesta rápida en RD.',
  },
} as const;

export const VEHICULOS_PAGE = {
  title: 'FINANCIAMIENTO DE VEHÍCULO',
  badgeHistorial: 'No importa tu historial de crédito',
  plazo: '60',
  plazoLabel: 'meses',
  image: '/brand/flyer-vehiculos.jpeg',
  cta: 'Solicitar vehículo',
  ctaHref: '/solicitar?producto=vehiculos',
  hero: {
    eyebrow: 'Vehículos',
    title: 'Maneja hoy',
    lead: 'Hasta 60 meses · aprobación inmediata',
  },
} as const;

export const FOOTER = {
  phone: BRAND.phone,
  whatsapp: BRAND.whatsapp,
  slogan: BRAND.slogan,
} as const;
