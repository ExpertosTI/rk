export const UPLOAD = {
  maxBytes: 4 * 1024 * 1024, // 4 MB
  accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const,
  acceptLabel: 'JPG, PNG, WEBP o PDF · máx. 4 MB',
} as const;

export type UploadMime = (typeof UPLOAD.accept)[number];

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('No se pudo leer el archivo'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Archivo no válido'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export function validateUploadFile(file: File): string | null {
  if (!UPLOAD.accept.includes(file.type as UploadMime)) {
    return 'Formato no permitido. Usa JPG, PNG, WEBP o PDF.';
  }
  if (file.size > UPLOAD.maxBytes) {
    return 'El archivo es muy grande. Máximo 4 MB.';
  }
  return null;
}

export function base64ToBlobUrl(base64: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}
