export function parseCurrency(str: string): number {
  return Number(str.replace(/\D/g, '')) || 0;
}

export function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return 'RD$' + Number(digits).toLocaleString('es-DO');
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}
