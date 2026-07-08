import { useEffect, useRef, useState } from 'react';
import { IdCard, Upload, X } from 'lucide-react';
import { UPLOAD, fileToBase64, validateUploadFile } from '../../lib/upload';

export interface CedulaValue {
  data: string;
  nombre: string;
  mime: string;
}

interface Props {
  value: CedulaValue | null;
  onChange: (value: CedulaValue | null) => void;
  error?: string;
}

export default function CedulaUpload({ value, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function revokePreview() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  }

  useEffect(() => () => revokePreview(), []);

  async function handleFile(file: File) {
    const validation = validateUploadFile(file);
    if (validation) {
      setLocalError(validation);
      return;
    }

    setLocalError(null);
    const data = await fileToBase64(file);
    onChange({ data, nombre: file.name, mime: file.type });

    revokePreview();
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  function clear() {
    onChange(null);
    revokePreview();
    setPreview(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const displayError = localError || error;

  return (
    <div className={`cedula-upload${displayError ? ' has-error' : ''}`}>
      <label className="cedula-upload-label">
        Cédula de identidad <span className="req">*</span>
      </label>
      <p className="cedula-upload-hint">
        Sube una foto clara del frente de tu cédula. {UPLOAD.acceptLabel}
      </p>

      {!value ? (
        <button
          type="button"
          className={`cedula-dropzone${dragging ? ' is-dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <span className="cedula-dropzone-icon">
            <Upload size={22} />
          </span>
          <strong>Toca para subir tu cédula</strong>
          <span>o arrastra el archivo aquí</span>
        </button>
      ) : (
        <div className="cedula-preview-card">
          {preview ? (
            <img src={preview} alt="Vista previa cédula" className="cedula-preview-img" />
          ) : (
            <div className="cedula-preview-file">
              <IdCard size={28} />
              <span>{value.nombre}</span>
            </div>
          )}
          <button type="button" className="cedula-clear" onClick={clear} aria-label="Quitar archivo">
            <X size={16} />
            Cambiar archivo
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD.accept.join(',')}
        className="cedula-input-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {displayError && <div className="error-msg">{displayError}</div>}
    </div>
  );
}
