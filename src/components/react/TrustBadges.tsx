const BADGES = [
  'Respuesta rápida',
  '100% confidencial',
  'Sin compromiso',
] as const;

export default function TrustBadges() {
  return (
    <div className="badges" aria-label="Beneficios">
      {BADGES.map((label) => (
        <span className="badge" key={label}>
          <span className="badge-check">
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}
