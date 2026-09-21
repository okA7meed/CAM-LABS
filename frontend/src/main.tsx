import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { MarketplaceProvider } from './context/MarketplaceContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationsProvider } from './context/NotificationsContext';
import './i18n';

// Import CSS Design System Cascade
import './styles/design-system.css';
import './styles/components.css';
import './styles/auth-modal.css';
import './styles/layout.css';
import './styles/explorer.css';
import './styles/dashboard.css';
import './styles/dashboard-overview.css';
import './styles/account.css';
import './styles/order-center.css';
import './styles/marketplace.css';
import './styles/mk-marketplace.css';
import './styles/cad-geometry-viewer.css';
import './styles/motion.css';
import './styles/admin.css';
import './styles/order-detail.css';
import './styles/quote-detail.css';
import './styles/quote-workspace.css';
import './styles/pricing-engine.css';
import './styles/legal.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AuthProvider>
          <StoreProvider>
            <MarketplaceProvider>
            <NotificationsProvider>
              <App />
            </NotificationsProvider>
            </MarketplaceProvider>
          </StoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  </React.StrictMode>
);
