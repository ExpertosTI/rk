import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  id: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  searchable?: boolean;
}

export default function ModernSelect({
  id,
  label,
  required,
  placeholder = 'Selecciona una opción',
  options,
  value,
  onChange,
  error,
  searchable = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = searchable && query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className={`field modern-select${error ? ' has-error' : ''}`} ref={wrapRef}>
      <label htmlFor={id}>
        {label} {required && <span className="req">*</span>}
      </label>

      <button
        type="button"
        id={id}
        className={`select-trigger${open ? ' open' : ''}${!selected ? ' placeholder' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={18} className={`select-chevron${open ? ' rotated' : ''}`} />
      </button>

      {open && (
        <div className="select-dropdown" role="listbox">
          {searchable && (
            <input
              className="select-search"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          )}
          <ul className="select-options">
            {filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={`select-option${opt.value === value ? ' selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && <Check size={16} />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="select-empty">Sin resultados</li>
            )}
          </ul>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
