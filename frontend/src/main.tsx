import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { ThemeProvider } from './context/ThemeContext';
import './i18n';

// Import CSS Design System Cascade
import './styles/design-system.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/explorer.css';
import './styles/dashboard.css';
import './styles/marketplace.css';
import './styles/manufacturing-request.css';
import './styles/motion.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
