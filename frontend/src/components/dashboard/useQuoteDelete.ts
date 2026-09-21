import { useState } from 'react';
import { Quote } from '../../types';
import { ApiError, ApiService } from '../../services/api';

/**
 * Shared customer quote-deletion-REQUEST flow (Dashboard Recent Quotes +
 * My Quotes + Quote workspace). Deletion-by-approval: the client files a
 * request (POST /quotes/:id/deletion-request) and the Quote stays visible
 * with a "Deletion Requested" state until an admin approves or rejects.
 * Eligibility display is centralized via `isQuoteDeletable`; the server
 * re-checks ownership, converted/Approved protection, and duplicate PENDING.
 */
export function useQuoteDelete(onRequested: (id: string) => void) {
  const [target, setTarget] = useState<Quote | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const askDelete = (quote: Quote) => {
    setTarget(quote);
    setReason('');
    setErrorCode(null);
    setErrorMessage(null);
  };

  const cancel = () => {
    if (busy) return;
    setTarget(null);
    setReason('');
    setErrorCode(null);
    setErrorMessage(null);
  };

  const confirm = async (): Promise<boolean> => {
    if (!target || busy) return false;
    setBusy(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const result = await ApiService.requestQuoteDeletion(target.id, reason);
      if (!result) throw new Error('request failed');
      const id = target.id;
      setTarget(null);
      setReason('');
      onRequested(id);
      return true;
    } catch (err) {
      // Protected/converted quotes surface the server reason; the row and
      // counters stay untouched (no optimistic removal anywhere).
      setErrorCode(err instanceof ApiError ? err.code || String(err.status) : 'UNKNOWN');
      setErrorMessage(err instanceof ApiError ? err.message : 'request failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { target, reason, setReason, busy, errorCode, errorMessage, askDelete, cancel, confirm };
}
