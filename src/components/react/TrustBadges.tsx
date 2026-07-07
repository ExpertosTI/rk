import { Zap, ShieldCheck, Handshake } from 'lucide-react';

const BADGES = [
  { icon: Zap, label: 'Respuesta rápida' },
  { icon: ShieldCheck, label: '100% confidencial' },
  { icon: Handshake, label: 'Sin compromiso' },
] as const;

export default function TrustBadges() {
  return (
    <div className="badges" aria-label="Beneficios">
      {BADGES.map(({ icon: Icon, label }) => (
        <span className="badge" key={label}>
          <Icon size={15} strokeWidth={2} />
          {label}
        </span>
      ))}
    </div>
  );
}
