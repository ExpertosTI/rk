import { ChevronRight } from 'lucide-react';
import { PRODUCT_STACK } from '../../lib/landing';
import type { ProductKey } from '../../lib/constants';

interface Props {
  value: ProductKey | '';
  onChange: (value: ProductKey) => void;
  error?: string;
}

const ORDER: ProductKey[] = ['vehiculos', 'apartamentos', 'casas', 'solares'];

export default function ProductStack({ value, onChange, error }: Props) {
  return (
    <div className={`product-stack${error ? ' has-error' : ''}`}>
      <label className="product-stack-label">
        ¿Qué necesitas? <span className="req">*</span>
      </label>
      <div className="product-stack-list" role="listbox" aria-label="Tipo de financiamiento">
        {ORDER.map((key) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={selected}
              className={`product-stack-btn${selected ? ' selected' : ''}`}
              onClick={() => onChange(key)}
            >
              <span>{PRODUCT_STACK[key]}</span>
              <ChevronRight size={18} className="product-stack-arrow" />
            </button>
          );
        })}
      </div>
      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
