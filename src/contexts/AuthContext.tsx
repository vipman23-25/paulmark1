import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  setMockUser: (userData: { isAdmin: boolean; email: string; id?: string; name?: string }) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
  setMockUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const createMockUser = (email: string, isAdminRole: boolean, id?: string, name?: string) => {
    return {
      id: id || `mock-user-${Date.now()}`,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      user_metadata: { display_name: name || (isAdminRole ? 'Admin' : 'Personel') },
      app_metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as User;
  };

  const checkRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  };

  useEffect(() => {
    // Development mode: Use mock user instead of Supabase
    const MOCK_MODE = true; // Set to false to enable real Supabase auth
    
    if (MOCK_MODE) {
      const savedUserStr = localStorage.getItem('mock_user_session');
      if (savedUserStr) {
        try {
          const parsedUser = JSON.parse(savedUserStr);
          setUser(parsedUser);
          setIsAdmin(parsedUser.user_metadata?.display_name === 'Admin');
        } catch(e) {}
      }
      // Initialize with loading false - allow user to login
      setIsLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => checkRole(session.user.id), 0);
        } else {
          setIsAdmin(false);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkRole(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setMockUser = (userData: { isAdmin: boolean; email: string; id?: string; name?: string }) => {
    const mockUser = createMockUser(userData.email, userData.isAdmin, userData.id, userData.name);
    setUser(mockUser);
    localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
    setSession(null);
    setIsAdmin(userData.isAdmin);
  };

  const signOut = async () => {
    const MOCK_MODE = true;
    if (MOCK_MODE) {
      setUser(null);
      localStorage.removeItem('mock_user_session');
      setSession(null);
      setIsAdmin(false);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, signOut, setMockUser }}>
      {children}
    </AuthContext.Provider>
  );
};
