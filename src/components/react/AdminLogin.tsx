import { useEffect, useState } from 'react';
import { Lock, Inbox } from 'lucide-react';
import { ADMIN } from '../../lib/constants';
import AdminInbox from './AdminInbox';

const LOCK_KEY = 'rk_admin_lock';
const ATTEMPTS_KEY = 'rk_admin_attempts';

export default function AdminLogin() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState(0);

  useEffect(() => {
    setAuthed(sessionStorage.getItem('rk_admin') === '1');
    setLockedUntil(Number(sessionStorage.getItem(LOCK_KEY) || 0));
    setReady(true);
  }, []);

  function login(e: React.FormEvent) {
    e.preventDefault();
    const now = Date.now();
    if (lockedUntil > now) {
      const mins = Math.ceil((lockedUntil - now) / 60000);
      setError(`Demasiados intentos. Espera ${mins} min.`);
      return;
    }

    if (pin === ADMIN.pin) {
      sessionStorage.setItem('rk_admin', '1');
      sessionStorage.removeItem(ATTEMPTS_KEY);
      sessionStorage.removeItem(LOCK_KEY);
      setAuthed(true);
      setError('');
      return;
    }

    const attempts = Number(sessionStorage.getItem(ATTEMPTS_KEY) || 0) + 1;
    sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));

    if (attempts >= ADMIN.maxAttempts) {
      const until = now + ADMIN.lockoutMs;
      sessionStorage.setItem(LOCK_KEY, String(until));
      setLockedUntil(until);
      setError('Acceso bloqueado por 5 minutos.');
    } else {
      setError(`Clave incorrecta (${ADMIN.maxAttempts - attempts} intentos restantes)`);
    }
  }

  if (!ready) return null;
  if (authed) {
    return (
      <AdminInbox
        onLogout={() => {
          sessionStorage.removeItem('rk_admin');
          setAuthed(false);
        }}
      />
    );
  }

  const isLocked = lockedUntil > Date.now();

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-icon"><Lock size={28} /></div>
        <h1>Bahía de solicitudes</h1>
        <p>RK Inversiones — Panel administrador</p>
        <form onSubmit={login}>
          <div className="field">
            <label htmlFor="pin">Clave de acceso</label>
            <input
              id="pin"
              type="password"
              placeholder="Ingresa tu clave"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={isLocked}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn-next btn-ai" disabled={isLocked}>
            <Inbox size={18} />
            Entrar al panel
          </button>
        </form>
      </div>
    </div>
  );
}
