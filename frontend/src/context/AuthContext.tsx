import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { ApiError, ApiService } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, company: string | undefined, phone: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchPersona: (personaId: string) => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
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

  const login = async (email: string, password: string): Promise<boolean> => {
    const result = await ApiService.login(email, password);
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

  const switchPersona = (_personaId: string) => {
    throw new Error('Demo persona switching is disabled for authenticated sessions.');
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!currentUser) throw new ApiError(401, 'Authentication is required.');
    const updated = await ApiService.updateProfile(data);
    if (updated) setCurrentUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        isLoading,
        login,
        register,
        logout,
        switchPersona,
        updateProfile,
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
