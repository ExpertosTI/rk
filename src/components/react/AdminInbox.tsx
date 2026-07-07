import { useEffect, useState } from 'react';
import { LogOut, MessageCircle, RefreshCw } from 'lucide-react';
import { PRODUCTS, GARANTIA_LABELS, type ProductKey } from '../../lib/constants';
import { whatsappLink } from '../../lib/whatsapp';

interface Submission {
  id: string;
  fecha: string;
  estado: string;
  producto: ProductKey;
  monto: string;
  plazo: string;
  garantia: keyof typeof GARANTIA_LABELS;
  nombre: string;
  whatsapp: string;
  email?: string;
  ingresos: string;
  provincia: string;
}

interface Props {
  onLogout: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  nueva: '#F5A623',
  revision: '#1E88E5',
  aprobada: '#3AAA35',
  rechazada: '#E53935',
  cerrada: '#888',
};

export default function AdminInbox({ onLogout }: Props) {
  const [items, setItems] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);

  function load() {
    const data = JSON.parse(localStorage.getItem('rk_solicitudes') || '[]') as Submission[];
    setItems(data);
    if (selected) {
      setSelected(data.find((d) => d.id === selected.id) ?? null);
    }
  }

  useEffect(() => { load(); }, []);

  function updateStatus(id: string, estado: string) {
    const data = items.map((item) => (item.id === id ? { ...item, estado } : item));
    localStorage.setItem('rk_solicitudes', JSON.stringify(data));
    setItems(data);
    if (selected?.id === id) setSelected({ ...selected, estado });
  }

  const nuevas = items.filter((i) => i.estado === 'nueva').length;

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <div>
          <h1>Bahía de solicitudes</h1>
          <p>{items.length} solicitudes · <strong>{nuevas} nuevas</strong></p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="btn-back" onClick={load}>
            <RefreshCw size={16} /> Actualizar
          </button>
          <button type="button" className="btn-back" onClick={onLogout}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <div className="admin-list">
          {items.length === 0 && (
            <p className="admin-empty">No hay solicitudes aún. Envía una desde el formulario público.</p>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-row${selected?.id === item.id ? ' active' : ''}`}
              onClick={() => setSelected(item)}
            >
              <div className="admin-row-top">
                <strong>{item.nombre}</strong>
                <span className="admin-status" style={{ background: STATUS_COLORS[item.estado] ?? '#888' }}>
                  {item.estado}
                </span>
              </div>
              <div className="admin-row-meta">
                {PRODUCTS[item.producto]} · {item.monto}
              </div>
              <div className="admin-row-date">
                {new Date(item.fecha).toLocaleString('es-DO')}
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="admin-detail">
            <h2>{selected.nombre}</h2>
            <p className="admin-ref">{selected.id}</p>

            <dl className="admin-dl">
              <dt>Producto</dt><dd>{PRODUCTS[selected.producto]}</dd>
              <dt>Monto</dt><dd>{selected.monto}</dd>
              <dt>Plazo</dt><dd>{selected.plazo} meses</dd>
              <dt>Garantía</dt><dd>{GARANTIA_LABELS[selected.garantia]}</dd>
              <dt>WhatsApp</dt><dd>{selected.whatsapp}</dd>
              {selected.email && (
                <>
                  <dt>Email</dt>
                  <dd>{selected.email}</dd>
                </>
              )}
              <dt>Ingresos</dt><dd>{selected.ingresos}</dd>
              <dt>Ubicación</dt><dd>{selected.provincia}</dd>
            </dl>

            <div className="admin-status-actions">
              {['nueva', 'revision', 'aprobada', 'rechazada', 'cerrada'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`status-btn${selected.estado === s ? ' active' : ''}`}
                  style={{ '--c': STATUS_COLORS[s] } as React.CSSProperties}
                  onClick={() => updateStatus(selected.id, s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <a
              className="btn-whatsapp"
              href={whatsappLink(selected.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} />
              Abrir WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
