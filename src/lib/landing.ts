import type { ProductKey } from './constants';

export const PRODUCT_STACK: Record<ProductKey, string> = {
  apartamentos: 'Financiar un apartamento',
  casas: 'Financiar mi casa',
  vehiculos: 'Financiar un vehículo',
  solares: 'Financiar un solar o terreno',
};

export const STATS = [
  { value: '2 horas', label: 'Aprobación rápida' },
  { value: '100%', label: 'En línea' },
  { value: '4', label: 'Soluciones de crédito' },
  { value: '60', label: 'Meses máximo' },
] as const;

export const FEATURES = [
  { title: 'Inmediatez', desc: 'Dinero rápido y fácil' },
  { title: 'Hasta 60 meses', desc: 'Plazos flexibles' },
  { title: 'Sin historial', desc: 'Tu crédito no importa' },
  { title: '100% confidencial', desc: 'Datos protegidos' },
] as const;

export const PRODUCT_CARDS = [
  { key: 'vehiculos' as const, label: 'Vehículos', desc: 'Hasta 60 meses para pagar' },
  { key: 'apartamentos' as const, label: 'Apartamentos', desc: 'Financia tu apartamento' },
  { key: 'casas' as const, label: 'Casas', desc: 'Tu casa propia, más cerca' },
  { key: 'solares' as const, label: 'Solares', desc: 'Invierte en tu terreno' },
];
