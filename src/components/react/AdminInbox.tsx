import { useEffect, useMemo, useState } from 'react';
import {
  FileImage, Inbox, LogOut, Mail, MessageCircle, RefreshCw, Search, ShieldCheck,
} from 'lucide-react';
import { BRAND, PRODUCTS, GARANTIA_LABELS } from '../../lib/constants';
import { whatsappLink } from '../../lib/whatsapp';
import { base64ToBlobUrl } from '../../lib/upload';
import { formatCedula } from '../../lib/formatters';
import {
  consultarBuro,
  fetchConsultasBuro,
  type BureauConsulta,
} from '../../lib/bureau';
import {
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
  borrador: '#94A3B8',
  revision: '#2563EB',
  aprobada: '#16A34A',
  rechazada: '#DC2626',
  cerrada: '#64748B',
};

const STATUS_LABELS: Record<string, string> = {
  nueva: 'Nueva',
  borrador: 'Borrador',
  revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cerrada: 'Cerrada',
};

type FilterKey = 'todas' | 'nuevas' | 'revision' | 'borradores' | 'cerradas';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'nuevas', label: 'Nuevas' },
  { key: 'revision', label: 'En revisión' },
  { key: 'borradores', label: 'Borradores' },
  { key: 'cerradas', label: 'Cerradas' },
];

export default function AdminInbox({ onLogout }: Props) {
  const [items, setItems] = useState<Solicitud[]>([]);
  const [drafts, setDrafts] = useState<Solicitud[]>([]);
  const [selected, setSelected] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [cedulaUrl, setCedulaUrl] = useState<string | null>(null);
  const [bureauConsultas, setBureauConsultas] = useState<BureauConsulta[]>([]);
  const [bureauLoading, setBureauLoading] = useState(false);
  const [bureauError, setBureauError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [search, setSearch] = useState('');

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

  function friendlyBureauError(code: string) {
    const map: Record<string, string> = {
      cedula_invalida: 'El número de cédula no es válido.',
      consulta_fallida: 'No se pudo completar la consulta. Intenta de nuevo.',
      unauthorized: 'No autorizado para esta consulta.',
      sin_datos: 'Aún no hay consultas registradas.',
    };
    return map[code] ?? 'No se pudo completar la consulta.';
  }

  async function load(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    const data = await fetchAllSolicitudesAdmin();
    setItems(data.items);
    setDrafts(data.drafts);
    setLoadFailed(Boolean(data.error));
    if (selected) {
      const all = [...data.items, ...data.drafts];
      setSelected(all.find((d) => d.id === selected.id) ?? null);
    }
    if (!opts?.silent) setLoading(false);
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load({ silent: true }); }, 12_000);
    return () => clearInterval(timer);
  }, []);

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
  const enRevision = items.filter((i) => i.estado === 'revision').length;
  const aprobadas = items.filter((i) => i.estado === 'aprobada').length;
  const allRows = [...items, ...drafts];

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((item) => {
      if (filter === 'nuevas' && (item.estado !== 'nueva' || !item.completada)) return false;
      if (filter === 'revision' && item.estado !== 'revision') return false;
      if (filter === 'borradores' && item.completada) return false;
      if (filter === 'cerradas' && !['cerrada', 'rechazada'].includes(item.estado)) return false;
      if (!q) return true;
      const hay = [
        item.nombre,
        item.id,
        item.whatsapp,
        item.email,
        item.producto ? PRODUCTS[item.producto] : '',
        item.monto,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [allRows, filter, search]);

  function displayName(item: Solicitud) {
    return item.nombre?.trim() || 'Borrador sin nombre';
  }

  function statusLabel(item: Solicitud) {
    if (!item.completada) return `${item.progreso_pct}% · paso ${item.paso_actual}`;
    return STATUS_LABELS[item.estado] ?? item.estado;
  }

  const total = items.length + drafts.length;

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <img src="/brand/logo.jpeg" alt={BRAND.name} className="admin-brand-logo" />
          <div>
            <p className="admin-brand-eyebrow">{BRAND.name}</p>
            <h1>Bahía de solicitudes</h1>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
            Actualizar
          </button>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onLogout}>
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-kpis">
          <article className="admin-kpi">
            <span className="admin-kpi-value">{nuevas}</span>
            <span className="admin-kpi-label">Nuevas</span>
          </article>
          <article className="admin-kpi">
            <span className="admin-kpi-value">{enRevision}</span>
            <span className="admin-kpi-label">En revisión</span>
          </article>
          <article className="admin-kpi">
            <span className="admin-kpi-value">{aprobadas}</span>
            <span className="admin-kpi-label">Aprobadas</span>
          </article>
          <article className="admin-kpi">
            <span className="admin-kpi-value">{drafts.length}</span>
            <span className="admin-kpi-label">En progreso</span>
          </article>
        </div>

        <div className="admin-toolbar">
          <div className="admin-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`admin-filter-btn${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="admin-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Buscar nombre, referencia, teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <div className="admin-layout">
          <section className="admin-list-panel">
            <div className="admin-list-head">
              <strong>{filteredRows.length}</strong>
              <span>de {total} solicitudes</span>
            </div>
            <div className="admin-list">
              {loading && filteredRows.length === 0 && (
                <p className="admin-empty">Cargando solicitudes…</p>
              )}
              {!loading && loadFailed && filteredRows.length === 0 && (
                <p className="admin-empty admin-empty-error">
                  No se pudo conectar con el servidor. Pulsa Actualizar.
                </p>
              )}
              {!loading && !loadFailed && filteredRows.length === 0 && (
                <p className="admin-empty">No hay solicitudes con este filtro.</p>
              )}
              {filteredRows.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-row${selected?.id === item.id ? ' active' : ''}${!item.completada ? ' is-draft' : ''}`}
                  onClick={() => setSelected(item)}
                >
                  <div className="admin-row-top">
                    <strong>{displayName(item)}</strong>
                    <span
                      className="admin-status"
                      style={{ background: STATUS_COLORS[item.estado] ?? '#888' }}
                    >
                      {statusLabel(item)}
                    </span>
                  </div>
                  <div className="admin-row-meta">
                    {item.producto ? PRODUCTS[item.producto] : 'Sin producto'}
                    {item.monto ? ` · ${item.monto}` : ''}
                  </div>
                  <div className="admin-row-date">
                    {new Date(item.fecha).toLocaleString('es-DO')}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {selected ? (
            <section className="admin-detail">
              <div className="admin-detail-head">
                <div>
                  <p className="admin-detail-eyebrow">Detalle de solicitud</p>
                  <h2>{displayName(selected)}</h2>
                  <p className="admin-ref">{selected.id}</p>
                </div>
                <span
                  className="admin-detail-badge"
                  style={{ background: STATUS_COLORS[selected.estado] ?? '#888' }}
                >
                  {statusLabel(selected)}
                </span>
              </div>

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
                    <dt>Correo</dt><dd>{selected.email}</dd>
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
                    <dt>Cédula</dt><dd>{formatCedula(selected.numero_cedula)}</dd>
                  </>
                )}
                {selected.comentarios && (
                  <>
                    <dt>Comentarios</dt><dd>{selected.comentarios}</dd>
                  </>
                )}
                {selected.completada && (
                  <>
                    <dt>Autorización</dt><dd>{selected.autoriza_datos ? 'Sí' : 'No'}</dd>
                    <dt>Privacidad</dt><dd>{selected.acepta_privacidad ? 'Aceptada' : 'No'}</dd>
                    <dt>Documento</dt><dd>{selected.cedula_recibida ? 'Recibido' : 'Pendiente'}</dd>
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
                    <h3><ShieldCheck size={18} /> Verificación crediticia</h3>
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
                  {bureauError && (
                    <p className="admin-bureau-err">{friendlyBureauError(bureauError)}</p>
                  )}
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
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}

              <div className="admin-detail-actions">
                {selected.whatsapp && (
                  <a
                    className="btn-whatsapp"
                    href={whatsappLink(selected.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle size={18} />
                    WhatsApp
                  </a>
                )}
                {selected.email && (
                  <a
                    className="btn-mail"
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(`RK Inversiones — solicitud ${selected.id}`)}`}
                  >
                    <Mail size={18} />
                    Correo
                  </a>
                )}
              </div>
            </section>
          ) : (
            <section className="admin-detail admin-detail-empty">
              <Inbox size={40} strokeWidth={1.5} />
              <h2>Selecciona una solicitud</h2>
              <p>Elige un registro de la lista para ver el detalle completo.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
