import React from 'react';
import '../../styles/submit-quote.css';
import { useStore } from '../../context/StoreContext';

export const QuoteSuccessView: React.FC = () => {
  const { submittedQuote, setActiveView } = useStore();
  const reference = (submittedQuote as any)?.reference || submittedQuote?.id || '—';

  return (
    <main className="sq-page" aria-label="Quote Submitted Successfully">
      <div className="sq-success">
        <span className="sq-success-icon" aria-hidden="true">
          ✓
        </span>
        <h1 className="sq-title">Quote Submitted Successfully</h1>
        <p className="sq-subtitle">The CAM LABS team will review your quote. Pricing and order confirmation happen after review.</p>
        <div className="sq-ref-card">
          <span className="sq-ref-label">Quote Reference</span>
          <span className="sq-ref-value" data-testid="quote-reference">
            {reference}
          </span>
          <span className="sq-ref-hint">Keep this reference — it follows your request from quote to order.</span>
        </div>
        <ul className="sq-steps">
          <li>Your quote has been received.</li>
          <li>CAM LABS reviews configuration and estimated pricing.</li>
          <li>You are notified when it is approved and converted to an order.</li>
        </ul>
        <div className="sq-auth-actions">
          <button type="button" className="sq-submit" onClick={() => setActiveView('dashboard')}>
            View My Quotes
          </button>
          <button type="button" className="sq-edit" onClick={() => setActiveView('manufacturing-request')}>
            Start Another Quote
          </button>
        </div>
      </div>
    </main>
  );
};
