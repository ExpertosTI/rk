import { useEffect, useRef, useState } from 'react';
import { PRODUCTS } from '../../lib/constants';
import type { Solicitud, SolicitudEstado } from '../../lib/solicitudes';

interface Props {
  items: Solicitud[];
  drafts: Solicitud[];
  onRefresh: () => void;
  onSelect: (item: Solicitud) => void;
  onUpdateStatus: (id: string, estado: SolicitudEstado) => void;
}

interface Line {
  id: number;
  type: 'system' | 'input' | 'output' | 'error' | 'success';
  text: string;
}

let lineId = 0;
function nextId() {
  lineId += 1;
  return lineId;
}

const HELP = [
  'Comandos RK Admin:',
  '  help              — esta ayuda',
  '  stats             — resumen de solicitudes',
  '  list [filtro]     — nuevas | borradores | revision | todas',
  '  open <id|nombre>  — abrir solicitud',
  '  estado <id> <s>   — nueva|revision|aprobada|rechazada|cerrada',
  '  refresh           — recargar datos',
  '  clear             — limpiar pantalla',
];

export default function AdminTerminal({ items, drafts, onRefresh, onSelect, onUpdateStatus }: Props) {
  const [lines, setLines] = useState<Line[]>([
    { id: nextId(), type: 'system', text: 'RK Admin Terminal v1.0' },
    { id: nextId(), type: 'system', text: 'Escribe "help" para ver comandos.' },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = [...items, ...drafts];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);

  function push(type: Line['type'], text: string) {
    setLines((prev) => [...prev, { id: nextId(), type, text }]);
  }

  function pushMany(type: Line['type'], texts: string[]) {
    setLines((prev) => [
      ...prev,
      ...texts.map((text) => ({ id: nextId(), type, text })),
    ]);
  }

  function findSolicitud(query: string): Solicitud | undefined {
    const q = query.trim().toLowerCase();
    return all.find(
      (s) => s.id.toLowerCase() === q
        || s.id.toLowerCase().includes(q)
        || s.nombre?.toLowerCase().includes(q),
    );
  }

  function runCommand(raw: string) {
    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase() ?? '';
    const arg1 = parts[1];
    const arg2 = parts[2];

    setLines((prev) => [...prev, { id: nextId(), type: 'input', text: `> ${raw}` }]);

    if (!cmd) return;

    if (cmd === 'clear') {
      setLines([]);
      return;
    }

    if (cmd === 'help') {
      pushMany('output', HELP);
      return;
    }

    if (cmd === 'refresh') {
      onRefresh();
      push('success', 'Recargando solicitudes…');
      return;
    }

    if (cmd === 'stats') {
      const nuevas = items.filter((i) => i.estado === 'nueva' && i.completada).length;
      const revision = items.filter((i) => i.estado === 'revision').length;
      const aprobadas = items.filter((i) => i.estado === 'aprobada').length;
      pushMany('output', [
        `Total completadas: ${items.length}`,
        `Borradores: ${drafts.length}`,
        `Nuevas: ${nuevas}`,
        `En revisión: ${revision}`,
        `Aprobadas: ${aprobadas}`,
      ]);
      return;
    }

    if (cmd === 'list') {
      const filter = arg1?.toLowerCase() ?? 'todas';
      let rows = all;
      if (filter === 'nuevas') rows = items.filter((i) => i.estado === 'nueva' && i.completada);
      else if (filter === 'borradores') rows = drafts;
      else if (filter === 'revision') rows = items.filter((i) => i.estado === 'revision');
      else if (filter === 'todas') rows = all;

      if (rows.length === 0) {
        push('output', 'Sin resultados.');
        return;
      }

      pushMany(
        'output',
        rows.slice(0, 20).map((s) => {
          const name = s.nombre?.trim() || 'Borrador';
          const score = s.score?.total ?? s.puntuacion ?? '—';
          const prod = s.producto ? PRODUCTS[s.producto] : '—';
          return `${s.id}  ${name.padEnd(18).slice(0, 18)}  ${prod}  pts:${score}`;
        }),
      );
      if (rows.length > 20) push('output', `… y ${rows.length - 20} más`);
      return;
    }

    if (cmd === 'open') {
      if (!arg1) {
        push('error', 'Uso: open <id o nombre>');
        return;
      }
      const found = findSolicitud(arg1);
      if (!found) {
        push('error', `No encontrado: ${arg1}`);
        return;
      }
      onSelect(found);
      push('success', `Abierto: ${found.id} — ${found.nombre ?? 'Borrador'}`);
      return;
    }

    if (cmd === 'estado') {
      if (!arg1 || !arg2) {
        push('error', 'Uso: estado <id> <nueva|revision|aprobada|rechazada|cerrada>');
        return;
      }
      const found = findSolicitud(arg1);
      const estados: SolicitudEstado[] = ['nueva', 'revision', 'aprobada', 'rechazada', 'cerrada', 'borrador'];
      if (!estados.includes(arg2 as SolicitudEstado)) {
        push('error', 'Estado no válido.');
        return;
      }
      if (!found) {
        push('error', `No encontrado: ${arg1}`);
        return;
      }
      void onUpdateStatus(found.id, arg2 as SolicitudEstado);
      push('success', `${found.id} → ${arg2}`);
      return;
    }

    push('error', `Comando desconocido: ${cmd}. Escribe "help".`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    runCommand(input);
    setInput('');
  }

  return (
    <div className="admin-terminal-wrap">
      <div className="rk-terminal rk-terminal-admin" onClick={() => inputRef.current?.focus()}>
        <div className="rk-terminal-chrome">
          <span className="rk-terminal-dot rk-terminal-dot-red" />
          <span className="rk-terminal-dot rk-terminal-dot-yellow" />
          <span className="rk-terminal-dot rk-terminal-dot-green" />
          <span className="rk-terminal-title">RK Admin · terminal</span>
        </div>
        <div className="rk-terminal-body" ref={scrollRef}>
          {lines.map((line) => (
            <div key={line.id} className={`rk-terminal-line rk-terminal-line-${line.type}`}>
              {line.text || '\u00A0'}
            </div>
          ))}
          <form className="rk-terminal-form" onSubmit={onSubmit}>
            <span className="rk-terminal-prompt">&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="help"
              className="rk-terminal-input"
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        </div>
      </div>
      <p className="admin-terminal-hint">
        Tip: <code>open RK-</code> o <code>list nuevas</code> · <code>estado RK-xxx revision</code>
      </p>
    </div>
  );
}
