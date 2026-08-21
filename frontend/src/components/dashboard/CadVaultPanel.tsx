import React, { useEffect, useRef, useState } from 'react';
import { ApiError, ApiService } from '../../services/api';
import { CadFile } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { CadGeometryViewer } from '../manufacturing/CadGeometryViewer';

const statusText = (file: CadFile): string => {
  const version = file.latestVersion;
  if (!version) return file.status;
  if (version.scanStatus === 'QUARANTINED') return 'quarantined';
  if (version.processingStatus === 'COMPLETE') return 'ready';
  if (version.processingStatus === 'FAILED') return 'processingFailed';
  return 'analyzing';
};

export const CadVaultPanel: React.FC = () => {
  const { startManufacturingRequest } = useStore();
  const { t } = useTranslation();
  const [files, setFiles] = useState<CadFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [previewFile, setPreviewFile] = useState<CadFile | null>(null);
  const [deleteFile, setDeleteFile] = useState<CadFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    setIsLoading(true);
    const result = await ApiService.getCadFiles();
    setFiles(result || []);
    setIsLoading(false);
  };

  useEffect(() => { void loadFiles(); }, []);

  useEffect(() => {
    if (!files.some((file) => file.latestVersion?.processingStatus === 'PENDING' || file.latestVersion?.processingStatus === 'PROCESSING')) return;
    const interval = window.setInterval(() => { void loadFiles(); }, 1000);
    return () => window.clearInterval(interval);
  }, [files]);

  const upload = async (selectedFiles: File[]) => {
    setError('');
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const results = await Promise.allSettled(selectedFiles.map((file) => ApiService.uploadCadFile(file, (percentage) => setUploadProgress(percentage))));
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failed) throw failed.reason;
      const duplicate = results.find((result) => result.status === 'fulfilled' && result.value?.duplicate);
      if (duplicate?.status === 'fulfilled' && duplicate.value) setError(t('cad.duplicateFound', { name: duplicate.value.name, version: duplicate.value.version.version }));
      await loadFiles();
    } catch (uploadError) {
      setError(uploadError instanceof ApiError ? uploadError.message : t('cad.uploadFailed'));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const download = async (file: CadFile) => {
    try {
      const response = await fetch(`/api/v1/cad-files/${file.id}/download`, { credentials: 'same-origin' });
      if (!response.ok) throw new ApiError(response.status, t('cad.downloadFailed'));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : t('cad.downloadFailed'));
    }
  };

  const confirmDelete = async () => {
    if (!deleteFile) return;
    setIsDeleting(true);
    try {
      await ApiService.deleteCadFile(deleteFile.id);
      setFiles((current) => current.filter((file) => file.id !== deleteFile.id));
      setDeleteFile(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('cad.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="dashboard-section-panel cad-vault-panel">
      <div className="panel-header-row">
        <div className="panel-title-group">
          <div>
            <h3 className="panel-title">{t('cad.vault')}</h3>
            <p className="cad-vault-subtitle">{t('cad.vaultDescription')}</p>
          </div>
          <span className="badge badge-neutral">STEP, STL, OBJ, PLY, DXF, SVG, PDF, IGES</span>
        </div>
        <div className="cad-upload-control"><button className="btn btn-sm btn-primary" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          {isUploading ? t('cad.uploading') : t('cad.upload')}
        </button>{isUploading && uploadProgress !== null && <div className="cad-upload-progress" aria-live="polite"><span>{t('cad.uploading')}</span><progress max="100" value={uploadProgress} aria-label={`${t('cad.uploading')} ${uploadProgress}%`} /><strong>{uploadProgress}%</strong></div>}</div>
        <input ref={inputRef} type="file" hidden multiple accept=".step,.stp,.stl,.obj,.ply,.dxf,.svg,.pdf,.iges,.igs" onChange={(event) => { const selectedFiles = Array.from(event.target.files || []); if (selectedFiles.length) void upload(selectedFiles); }} />
      </div>

      {error && <div className="cad-vault-error" role="alert">{error}</div>}
      {isLoading ? <p className="cad-vault-empty">{t('cad.loadingFiles')}</p> : files.length === 0 ? <p className="cad-vault-empty">{t('cad.empty')}</p> : (
        <div className="cad-files-grid">
          {files.map((file) => (
            <article key={file.id} className="cad-file-card">
              <div className="file-preview-thumb"><span className="file-format-tag">{file.format}</span><span className="cad-vault-icon">◇</span></div>
              <div>
                <strong className="cad-file-name">{file.name}</strong>
                <span className="cad-file-meta">{file.size} · version {file.latestVersion?.version || 0}</span>
              </div>
              <div className="file-details-list">
                <div className="file-detail-entry"><span>{t('cad.scan')}</span><strong>{file.latestVersion?.scanStatus || t('cad.legacy')}</strong></div>
                <div className="file-detail-entry"><span>{t('cad.analysis')}</span><strong>{t(`cad.${statusText(file)}`)}</strong></div>
              </div>
              <div className="cad-file-status"><span className={file.latestVersion?.processingStatus === 'COMPLETE' ? '' : 'pulse-dot'} />{t(`cad.${statusText(file)}`)}</div>
              <div className="cad-file-actions">
                <button className="btn btn-sm btn-primary" onClick={() => startManufacturingRequest()}>{t('cad.configureOrder')}</button>
                <button className="btn btn-sm btn-outline" title={t('cad.preview')} aria-label={`${t('cad.preview')} ${file.name}`} disabled={file.latestVersion?.processingStatus !== 'COMPLETE' || !file.latestVersion.metadata?.viewerAsset?.available} onClick={() => setPreviewFile(file)}>{t('cad.preview')}</button>
                <button className="btn btn-sm btn-outline" title={t('cad.download')} aria-label={`${t('cad.download')} ${file.name}`} disabled={file.latestVersion?.processingStatus !== 'COMPLETE'} onClick={() => void download(file)}>{t('cad.download')}</button>
                <button className="btn btn-sm btn-outline" title={t('cad.delete')} aria-label={`${t('cad.delete')} ${file.name}`} disabled={file.latestVersion?.processingStatus === 'PENDING' || file.latestVersion?.processingStatus === 'PROCESSING'} onClick={() => setDeleteFile(file)}>{t('cad.delete')}</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {previewFile && <div className="request-modal-backdrop" role="dialog" aria-modal="true" aria-label={t('cad.preview')}><div className="request-preview-modal"><div className="request-modal-header"><div><h2>{t('cad.preview')}</h2><p>{previewFile.name} · {t('cad.version', { version: previewFile.latestVersion?.version || 1 })}</p></div><button className="request-modal-close" aria-label={t('common.close')} onClick={() => setPreviewFile(null)}>×</button></div><CadGeometryViewer file={previewFile} onGeometry={() => undefined} /></div></div>}
      {deleteFile && <div className="request-modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="vault-delete-title"><div className="request-delete-modal"><h2 id="vault-delete-title">{t('cad.deleteTitle')}</h2><p>{t('cad.deleteDescription')}</p><strong>{deleteFile.name}</strong><div className="request-delete-actions"><button className="btn btn-outline" disabled={isDeleting} onClick={() => setDeleteFile(null)}>{t('common.cancel')}</button><button className="btn request-delete-button" disabled={isDeleting} onClick={() => void confirmDelete()}>{isDeleting ? t('cad.deleting') : t('cad.delete')}</button></div></div></div>}
    </section>
  );
};