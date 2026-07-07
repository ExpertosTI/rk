import type { LucideIcon } from 'lucide-react';
import { Building2, Home, Car, LandPlot } from 'lucide-react';
import type { ProductKey } from './constants';

export const PRODUCT_ICONS: Record<ProductKey, LucideIcon> = {
  apartamentos: Building2,
  casas: Home,
  vehiculos: Car,
  solares: LandPlot,
};
