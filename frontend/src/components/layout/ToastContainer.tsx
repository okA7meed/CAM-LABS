import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { CAM_EASE } from '../ui/AnimatedModal';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useStore();

  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`toast ${toast.type} show cam-motion`}
            role="status"
            aria-live="polite"
            layout
            initial={{ opacity: 0, x: 48, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.96 }}
            transition={{ duration: 0.26, ease: CAM_EASE }}
          >
            <div className="toast-icon"><Icon name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'alert' : 'file'} size={17} /></div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" aria-label="Dismiss notification" onClick={() => removeToast(toast.id)}>
              <Icon name="close" size={15} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};