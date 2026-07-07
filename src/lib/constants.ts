export const BRAND = {
  name: 'RK Inversiones',
  slogan: 'Dinero Rápido y Fácil',
  phone: '829-669-8958',
  whatsapp: '18296698958',
  minAmount: 50_000,
} as const;

export const PRODUCTS = {
  apartamentos: { label: 'Apartamentos', desc: 'Financia tu apartamento' },
  casas:        { label: 'Casas',        desc: 'Tu casa propia' },
  vehiculos:    { label: 'Vehículos',    desc: 'Hasta 60 meses' },
  solares:      { label: 'Solares',      desc: 'Invierte en terreno' },
} as const;

export type ProductKey = keyof typeof PRODUCTS;

export const PLAZOS = [12, 24, 36, 48, 60] as const;

export const PROVINCIAS = [
  'Azua', 'Bahoruco', 'Barahona', 'Dajabón', 'Distrito Nacional',
  'Duarte', 'El Seibo', 'Espaillat', 'Hato Mayor', 'Hermanas Mirabal',
  'Independencia', 'La Altagracia', 'La Romana', 'La Vega', 'María Trinidad Sánchez',
  'Monseñor Nouel', 'Monte Cristi', 'Monte Plata', 'Pedernales', 'Peravia',
  'Puerto Plata', 'Samaná', 'San Cristóbal', 'San José de Ocoa', 'San Juan',
  'San Pedro de Macorís', 'Sánchez Ramírez', 'Santiago', 'Santiago Rodríguez',
  'Santo Domingo', 'Santo Domingo Este', 'Santo Domingo Norte', 'Santo Domingo Oeste',
  'Valverde',
] as const;

export const GARANTIA_LABELS = {
  si: 'Sí',
  no: 'No',
  unsure: 'No estoy seguro',
} as const;
