import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useStore();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type} show`} role="status" aria-live="polite">
          <div className="toast-icon"><Icon name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'alert' : 'file'} size={17} /></div>
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            <div className="toast-message">{toast.message}</div>
          </div>
          <button className="toast-close" aria-label="Dismiss notification" onClick={() => removeToast(toast.id)}>
            <Icon name="close" size={15} />
          </button>
        </div>
      ))}
    </div>
  );
};
