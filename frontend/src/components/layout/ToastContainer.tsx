import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { CAM_EASE } from '../ui/AnimatedModal';
import type { ToastMessage } from '../../types';

const ToastCard: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const isError = toast.type === 'error';
  return (
    <motion.div
      key={toast.id}
      className={`toast ${toast.type} show cam-motion`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      layout
      initial={{ opacity: 0, x: 48, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.96 }}
      transition={{ duration: 0.26, ease: CAM_EASE }}
    >
      <span className="toast-accent" aria-hidden="true" />
      <span className="toast-icon" aria-hidden="true">
        <Icon name={toast.icon} size={19} />
      </span>
      <div className="toast-content">
        <div className="toast-title">{toast.title}</div>
        {toast.message ? <div className="toast-message">{toast.message}</div> : null}
        {toast.action ? (
          <div className="toast-actions">
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                try {
                  toast.action?.onClick();
                } finally {
                  onClose(toast.id);
                }
              }}
            >
              {toast.action.label}
            </button>
          </div>
        ) : null}
      </div>
      <span className="toast-close-wrap">
        <button
          type="button"
          className="toast-close"
          aria-label={`Dismiss: ${toast.title}`}
          onClick={() => onClose(toast.id)}
        >
          <Icon name="close" size={15} />
        </button>
      </span>
      <span className="toast-progress" aria-hidden="true">
        <span key={toast.repeat} style={{ animationDuration: `${Math.max(0, toast.durationMs)}ms` }} />
      </span>
    </motion.div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useStore();

  return (
    <div className="toast-container" aria-label="Notifications">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
};
