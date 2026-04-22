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
    // Initial mock session check
    const savedUserStr = localStorage.getItem('mock_user_session');
    let hasMockSession = false;
    if (savedUserStr) {
      try {
        const parsedUser = JSON.parse(savedUserStr);
        setUser(parsedUser);
        setIsAdmin(parsedUser.user_metadata?.display_name === 'Admin');
        hasMockSession = true;
      } catch(e) {}
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setSession(session);
          setUser(session.user);
          await checkRole(session.user.id);
        } else {
          setIsAdmin(false);
          if (!localStorage.getItem('mock_user_session')) {
            setUser(null);
          }
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        await checkRole(session.user.id);
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
    localStorage.removeItem('mock_user_session');
    try {
      await supabase.auth.signOut();
    } catch(e) {}
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, signOut, setMockUser }}>
      {children}
    </AuthContext.Provider>
  );
};
