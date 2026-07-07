import type { ProductKey } from './constants';
import { BRAND, PRODUCTS } from './constants';

export const PRODUCT_FORM_LINES: { key: ProductKey; label: string; desc: string }[] = [
  { key: 'vehiculos', label: PRODUCTS.vehiculos, desc: 'Nuevos y usados. Hasta 60 meses. Aprobación inmediata.' },
  { key: 'apartamentos', label: PRODUCTS.apartamentos, desc: 'Financiamiento para el apartamento que tu familia necesita.' },
  { key: 'casas', label: PRODUCTS.casas, desc: 'Vivienda propia o inversión inmobiliaria.' },
  { key: 'solares', label: PRODUCTS.solares, desc: 'Terrenos y solares para proyectos a mediano plazo.' },
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
} as const;

export const VEHICULOS_PAGE = {
  title: 'FINANCIAMIENTO DE VEHÍCULO',
  badgeHistorial: 'No importa tu historial de crédito',
  plazo: '60',
  plazoLabel: 'meses para pagar',
  image: '/brand/flyer-vehiculos.jpeg',
  cta: 'Solicitar vehículo',
  ctaHref: '/solicitar?producto=vehiculos',
} as const;

export const FOOTER = {
  phone: BRAND.phone,
  email: BRAND.email,
  whatsapp: BRAND.whatsapp,
  slogan: BRAND.slogan,
} as const;
