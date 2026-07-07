import { Car, Home, Building2, TreePine } from 'lucide-react';
import { PRODUCT_CARDS } from '../../lib/landing';
import type { ProductKey } from '../../lib/constants';

interface Props {
  value: ProductKey | '';
  onChange: (value: ProductKey) => void;
  error?: string;
}

const ICONS = {
  vehiculos: Car,
  apartamentos: Building2,
  casas: Home,
  solares: TreePine,
} as const;

export default function ProductStack({ value, onChange, error }: Props) {
  return (
    <div className={`product-grid${error ? ' has-error' : ''}`}>
      <label className="product-grid-label">
        Tipo de financiamiento <span className="req">*</span>
      </label>
      <div className="product-grid-list" role="listbox" aria-label="Tipo de financiamiento">
        {PRODUCT_CARDS.map(({ key, label, desc }) => {
          const selected = value === key;
          const Icon = ICONS[key];
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={selected}
              className={`product-grid-card${selected ? ' selected' : ''}`}
              onClick={() => onChange(key)}
            >
              <span className="product-grid-icon">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <span className="product-grid-copy">
                <strong>{label}</strong>
                <small>{desc}</small>
              </span>
            </button>
          );
        })}
      </div>
      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
