import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationsProvider } from './context/NotificationsContext';
import './i18n';

// Import CSS Design System Cascade
import './styles/design-system.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/explorer.css';
import './styles/dashboard.css';
import './styles/order-center.css';
import './styles/marketplace.css';
import './styles/cad-geometry-viewer.css';
import './styles/motion.css';
import './styles/admin.css';
import './styles/pricing-engine.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <StoreProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
