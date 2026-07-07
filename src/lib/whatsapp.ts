export function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 10 ? `1${digits}` : digits.startsWith('1') ? digits : `1${digits}`;
  return `https://wa.me/${normalized}`;
}
