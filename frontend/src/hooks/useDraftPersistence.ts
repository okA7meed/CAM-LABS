import { useEffect, useRef } from 'react';
import { DRAFT_KEY } from '../components/manufacturing/workspace/constants';
import { FileConfiguration, FileSetupState, RequestState, TechnicalDocumentItem } from '../components/manufacturing/workspace/types';

export interface DraftData {
  request?: Partial<RequestState>;
  note?: string;
  technicalDocuments?: Array<Partial<TechnicalDocumentItem>>;
  fileConfigurations?: Record<string, FileConfiguration>;
  fileSetupStates?: Record<string, FileSetupState>;
  configTouched?: boolean;
  activeConfigTab?: 'basic' | 'advanced';
}

export const useDraftPersistence = ({ request, note, fileConfigurations, fileSetupStates, configTouched, activeConfigTab, technicalDocuments, onRestore }: {
  request: RequestState;
  note: string;
  fileConfigurations: Record<string, FileConfiguration>;
  fileSetupStates: Record<string, FileSetupState>;
  configTouched: boolean;
  activeConfigTab: 'basic' | 'advanced';
  technicalDocuments: TechnicalDocumentItem[];
  onRestore: (data: DraftData) => void;
}) => {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      onRestore(JSON.parse(raw) as DraftData);
    } catch { /* ignore malformed draft */ }
  }, [onRestore]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const payload: DraftData = {
          request,
          note,
          fileConfigurations,
          fileSetupStates,
          configTouched,
          activeConfigTab,
          technicalDocuments: technicalDocuments.filter((d) => d.status === 'ready').map((d) => ({ key: d.key, id: d.id, name: d.name, mimeType: d.mimeType, byteSize: d.byteSize })),
        };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch { /* ignore short-term storage failures */ }
    }, 400);
    return () => window.clearTimeout(id);
  }, [request, note, fileConfigurations, fileSetupStates, configTouched, activeConfigTab, technicalDocuments]);
};