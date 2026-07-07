import { useEffect, useState } from 'react';
import { Cloud, CloudOff, FileImage, LogOut, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { PRODUCTS, GARANTIA_LABELS } from '../../lib/constants';
import { whatsappLink } from '../../lib/whatsapp';
import { base64ToBlobUrl } from '../../lib/upload';
import { formatCedula } from '../../lib/formatters';
import {
  consultarBuro,
  fetchConsultasBuro,
  type BureauConsulta,
} from '../../lib/bureau';
import {
  checkInsforgeConnection,
  fetchAllSolicitudesAdmin,
  fetchDocumentoCedula,
  updateSolicitudEstado,
  type Solicitud,
  type SolicitudEstado,
} from '../../lib/solicitudes';

interface Props {
  onLogout: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  nueva: '#F5A623',
  borrador: '#9E9E9E',
  revision: '#1E88E5',
  aprobada: '#3AAA35',
  rechazada: '#E53935',
  cerrada: '#888',
};

export default function AdminInbox({ onLogout }: Props) {
  const [items, setItems] = useState<Solicitud[]>([]);
  const [drafts, setDrafts] = useState<Solicitud[]>([]);
  const [selected, setSelected] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'insforge' | 'local'>('local');
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cedulaUrl, setCedulaUrl] = useState<string | null>(null);
  const [bureauConsultas, setBureauConsultas] = useState<BureauConsulta[]>([]);
  const [bureauLoading, setBureauLoading] = useState(false);
  const [bureauError, setBureauError] = useState<string | null>(null);

  async function loadBureau(solicitudId: string) {
    const res = await fetchConsultasBuro(solicitudId);
    if (res.ok && res.data) {
      setBureauConsultas(res.data);
      setBureauError(null);
    } else {
      setBureauConsultas([]);
      setBureauError(res.error ?? 'sin_datos');
    }
  }

  async function runBureauConsulta() {
    if (!selected) return;
    const cedula = selected.numero_cedula?.replace(/\D/g, '') ?? '';
    if (!/^\d{11}$/.test(cedula)) {
      setBureauError('La solicitud no tiene número de cédula válido (11 dígitos).');
      return;
    }
    setBureauLoading(true);
    setBureauError(null);
    const res = await consultarBuro({
      solicitudId: selected.id,
      numeroCedula: cedula,
      nombre: selected.nombre?.trim() || 'Solicitante',
    });
    setBureauLoading(false);
    if (!res.ok) {
      setBureauError(res.error ?? 'consulta_fallida');
      return;
    }
    await loadBureau(selected.id);
  }

  async function loadCedula(solicitudId: string) {
    const res = await fetchDocumentoCedula(solicitudId);
    if (res.ok && res.data?.[0]?.data_base64 && res.data[0].mime) {
      setCedulaUrl(base64ToBlobUrl(res.data[0].data_base64, res.data[0].mime));
    } else {
      setCedulaUrl(null);
    }
  }

  async function load() {
    setLoading(true);
    const [conn, data] = await Promise.all([
      checkInsforgeConnection(),
      fetchAllSolicitudesAdmin(),
    ]);
    setDbConnected(conn.connected);
    setItems(data.items);
    setDrafts(data.drafts);
    setSource(data.source);
    setSyncError(data.error ?? null);
    if (selected) {
      const all = [...data.items, ...data.drafts];
      setSelected(all.find((d) => d.id === selected.id) ?? null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected?.cedula_recibida) {
      setCedulaUrl(null);
      return;
    }
    void loadCedula(selected.id);
    return () => setCedulaUrl(null);
  }, [selected?.id, selected?.cedula_recibida]);

  useEffect(() => {
    if (!selected?.completada) {
      setBureauConsultas([]);
      setBureauError(null);
      return;
    }
    void loadBureau(selected.id);
  }, [selected?.id, selected?.completada]);

  async function updateStatus(id: string, estado: SolicitudEstado) {
    await updateSolicitudEstado(id, estado);
    const patch = { estado };
    const nextItems = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    const nextDrafts = drafts.map((item) => (item.id === id ? { ...item, ...patch } : item));
    setItems(nextItems);
    setDrafts(nextDrafts);
    if (selected?.id === id) setSelected({ ...selected, ...patch });
  }

  const nuevas = items.filter((i) => i.estado === 'nueva').length;
  const allRows = [...items, ...drafts];

  function displayName(item: Solicitud) {
    return item.nombre?.trim() || `Borrador ${item.progreso_pct}%`;
  }

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <div>
          <h1>Bahía de solicitudes</h1>
          <p>
            {items.length} enviadas · <strong>{nuevas} nuevas</strong>
            {drafts.length > 0 && <> · {drafts.length} en progreso</>}
          </p>
          <p className="admin-sync-meta">
            {dbConnected ? (
              <span className="admin-sync-ok"><Cloud size={14} /> Insforge conectado</span>
            ) : (
              <span className="admin-sync-warn"><CloudOff size={14} /> {source === 'local' ? 'Modo local' : 'Sin conexión DB'}</span>
            )}
            {syncError && <span className="admin-sync-err"> · {syncError}</span>}
          </p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="btn-back" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> Actualizar
          </button>
          <button type="button" className="btn-back" onClick={onLogout}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <div className="admin-list">
          {allRows.length === 0 && !loading && (
            <p className="admin-empty">No hay solicitudes aún. Envía una desde el formulario público.</p>
          )}
          {loading && allRows.length === 0 && (
            <p className="admin-empty">Cargando desde Insforge...</p>
          )}
          {allRows.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-row${selected?.id === item.id ? ' active' : ''}${!item.completada ? ' is-draft' : ''}`}
              onClick={() => setSelected(item)}
            >
              <div className="admin-row-top">
                <strong>{displayName(item)}</strong>
                <span className="admin-status" style={{ background: STATUS_COLORS[item.estado] ?? '#888' }}>
                  {item.completada ? item.estado : `borrador ${item.progreso_pct}%`}
                </span>
              </div>
              <div className="admin-row-meta">
                {item.producto ? PRODUCTS[item.producto] : 'Sin producto'}
                {item.monto ? ` · ${item.monto}` : ''}
              </div>
              <div className="admin-row-date">
                {new Date(item.fecha).toLocaleString('es-DO')}
                {!item.completada && ` · Paso ${item.paso_actual}`}
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="admin-detail">
            <h2>{displayName(selected)}</h2>
            <p className="admin-ref">{selected.id}</p>

            {!selected.completada && (
              <div className="admin-progress-banner">
                Formulario al <strong>{selected.progreso_pct}%</strong> · Paso {selected.paso_actual}
              </div>
            )}

            <dl className="admin-dl">
              {selected.producto && (
                <>
                  <dt>Producto</dt><dd>{PRODUCTS[selected.producto]}</dd>
                </>
              )}
              {selected.monto && (
                <>
                  <dt>Monto</dt><dd>{selected.monto}</dd>
                </>
              )}
              {selected.plazo && (
                <>
                  <dt>Plazo</dt><dd>{selected.plazo} meses</dd>
                </>
              )}
              {selected.garantia && (
                <>
                  <dt>Garantía</dt><dd>{GARANTIA_LABELS[selected.garantia]}</dd>
                </>
              )}
              {selected.whatsapp && (
                <>
                  <dt>WhatsApp</dt><dd>{selected.whatsapp}</dd>
                </>
              )}
              {selected.email && (
                <>
                  <dt>Email</dt><dd>{selected.email}</dd>
                </>
              )}
              {selected.ingresos && (
                <>
                  <dt>Ingresos</dt><dd>{selected.ingresos}</dd>
                </>
              )}
              {selected.provincia && (
                <>
                  <dt>Ubicación</dt><dd>{selected.provincia}</dd>
                </>
              )}
              {selected.numero_cedula && (
                <>
                  <dt>Cédula (número)</dt><dd>{formatCedula(selected.numero_cedula)}</dd>
                </>
              )}
              {selected.comentarios && (
                <>
                  <dt>Comentarios</dt><dd>{selected.comentarios}</dd>
                </>
              )}
              {selected.completada && (
                <>
                  <dt>Autoriza datos</dt><dd>{selected.autoriza_datos ? 'Sí' : 'No'}</dd>
                  <dt>Privacidad</dt><dd>{selected.acepta_privacidad ? 'Aceptada' : 'No'}</dd>
                  <dt>Cédula</dt><dd>{selected.cedula_recibida ? 'Recibida' : 'Pendiente'}</dd>
                </>
              )}
            </dl>

            {cedulaUrl && (
              <a
                className="btn-cedula"
                href={cedulaUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileImage size={18} />
                Ver cédula subida
              </a>
            )}

            {selected.completada && selected.autoriza_datos && (
              <div className="admin-bureau">
                <div className="admin-bureau-head">
                  <h3><ShieldCheck size={18} /> DATACRÉDITO / TransUnion</h3>
                  <button
                    type="button"
                    className="btn-bureau"
                    onClick={runBureauConsulta}
                    disabled={bureauLoading || !selected.numero_cedula}
                  >
                    {bureauLoading ? 'Consultando…' : 'Consultar buró'}
                  </button>
                </div>
                {!selected.numero_cedula && (
                  <p className="admin-bureau-hint">Falta el número de cédula en la solicitud.</p>
                )}
                {bureauError && <p className="admin-bureau-err">{bureauError}</p>}
                {bureauConsultas.length > 0 && (
                  <ul className="admin-bureau-list">
                    {bureauConsultas.map((c) => (
                      <li key={c.id} className={`bureau-item bureau-${c.estado}`}>
                        <div className="bureau-item-top">
                          <strong>{c.score != null ? `Score ${c.score}` : c.estado}</strong>
                          <span>{new Date(c.created_at).toLocaleString('es-DO')}</span>
                        </div>
                        <p>{c.resumen}</p>
                        {c.recomendacion && (
                          <span className="bureau-rec">{c.recomendacion.replace(/_/g, ' ')}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selected.completada && (
              <div className="admin-status-actions">
                {(['nueva', 'revision', 'aprobada', 'rechazada', 'cerrada'] as const).map((s) => (
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
            )}

            {selected.whatsapp && (
              <a
                className="btn-whatsapp"
                href={whatsappLink(selected.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={18} />
                Abrir WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
