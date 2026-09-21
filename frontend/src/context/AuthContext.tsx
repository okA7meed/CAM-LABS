import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, ProfileUpdate } from '../types';
import { ApiError, ApiService } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, twoFactorCode?: string, rememberMe?: boolean) => Promise<boolean>;
  register: (name: string, email: string, password: string, company: string | undefined, phone: string) => Promise<boolean>;
  loginWithGoogle: (credential: string, twoFactorCode?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchPersona: (personaId: string) => void;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    ApiService.getCurrentUser()
      .then((user) => {
        if (mounted) setCurrentUser(user);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password: string, twoFactorCode?: string, rememberMe: boolean = true): Promise<boolean> => {
    const result = await ApiService.login(email, password, twoFactorCode, rememberMe);
    if (!result?.user) return false;
    setCurrentUser(result.user);
    return true;
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    company: string | undefined,
    phone: string,
  ): Promise<boolean> => {
    const result = await ApiService.register({ name, email, password, company, phone });
    if (!result?.user) return false;
    setCurrentUser(result.user);
    return true;
  };

  const logout = async () => {
    await ApiService.logout();
    setCurrentUser(null);
  };

  const loginWithGoogle = async (credential: string, twoFactorCode?: string): Promise<boolean> => {
    const result = await ApiService.loginWithGoogle(credential, twoFactorCode);
    if (!result?.user) return false;
    setCurrentUser(result.user);
    return true;
  };

  const switchPersona = (_personaId: string) => {
    throw new Error('Demo persona switching is disabled for authenticated sessions.');
  };

  const updateProfile = async (data: ProfileUpdate) => {
    if (!currentUser) throw new ApiError(401, 'Authentication is required.');
    const updated = await ApiService.updateProfile(data);
    if (updated) setCurrentUser(updated);
  };

  const refreshUser = async () => {
    const user = await ApiService.getCurrentUser();
    if (user) setCurrentUser(user);
  };

  // Apply persisted language/theme preferences after sign-in so the account
  // center choices follow the user across devices. LocalStorage remains the
  // live source; this only aligns it once per authenticated session.
  useEffect(() => {
    if (!currentUser) return;
    try {
      const savedLanguage = currentUser.preferences?.language;
      if ((savedLanguage === 'en' || savedLanguage === 'ar') && window.localStorage.getItem('locale') !== savedLanguage) {
        void import('../i18n').then((m) => { void m.default.changeLanguage(savedLanguage); });
      }
      const savedTheme = currentUser.preferences?.theme;
      if ((savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') && window.localStorage.getItem('theme') !== savedTheme) {
        window.localStorage.setItem('theme', savedTheme);
        window.dispatchEvent(new CustomEvent('cam-labs-theme-preference', { detail: savedTheme }));
      }
    } catch {
      /* ignore storage errors */
    }
  }, [currentUser?.id]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        switchPersona,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
