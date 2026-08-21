export interface UserPreferences {
  units: 'mm' | 'in';
  toleranceStandard: string;
  dfmNotifications: boolean;
  dispatchAlerts: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  phone?: string;
  avatar: string;
  tier: string;
  address?: string;
  taxId?: string;
  preferences: UserPreferences;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  user: User;
  token?: string;
  isAuthenticated: boolean;
}
