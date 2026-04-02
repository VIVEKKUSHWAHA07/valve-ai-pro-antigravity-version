import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accessPending: boolean;
  accessDenied: boolean;
  signOut: () => Promise<void>;
  setAuthState: (session: Session | null, user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessPending, setAccessPending] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const setAuthState = (newSession: Session | null, newUser: User | null) => {
    setSession(newSession);
    setUser(newUser);
  };

  const checkAccess = async (user: User) => {
    try {
      if (!user.email) return false;
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      );

      const queryPromise = supabase
        .from('app_access')
        .select('active, plan, custom_run_limit')
        .eq('email', user.email)
        .single();

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - user is not in app_access
          setAccessPending(true);
          console.log('checkAccess completed: No rows found in app_access');
          return false;
        }
        throw error;
      }

      if (!data || !data.active) {
        // Not approved yet
        setAccessPending(true);
        console.log('checkAccess completed: User not active');
        return false;
      }

      // Sync plan to user_usage
      await supabase
        .from('user_usage')
        .upsert({
          user_id: user.id,
          plan: data.plan || 'free',
          custom_run_limit: data.custom_run_limit
        }, { onConflict: 'user_id' });

      console.log('checkAccess completed: User has access', data);
      setAccessPending(false);
      setAccessDenied(false);
      return true;
    } catch (err: any) {
      console.error('Error in checkAccess:', err);
      if (err.message === 'TIMEOUT') {
        setAccessDenied(true);
      }
      console.log('checkAccess completed: Error occurred');
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session?.user) {
          if (mounted) {
            setSession(session);
            setUser(session.user);
          }
          // Run checkAccess in the background
          checkAccess(session.user);
        }
      } catch (err) {
        console.error('Failed to get session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('onAuthStateChange fired:', event, session?.user?.email);
      try {
        if (event === 'SIGNED_UP') {
          if (mounted) {
            setAccessPending(true);
            setSession(null);
            setUser(null);
            await supabase.auth.signOut();
          }
          return;
        }

        if (session?.user) {
          if (mounted) {
            setSession(session);
            setUser(session.user);
          }
          // Run checkAccess in the background
          checkAccess(session.user);
        } else {
          if (mounted) {
            setSession(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccessPending(false);
    setAccessDenied(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, accessPending, accessDenied, signOut, setAuthState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
