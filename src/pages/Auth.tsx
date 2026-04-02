import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { accessPending, setAuthState, user } = useAuth();
  
  // We need a local state to clear the pending screen if user wants to go back to sign in
  const [localAccessPending, setLocalAccessPending] = useState(false);

  const isPending = accessPending || localAccessPending;

  // Auto-redirect if already logged in
  React.useEffect(() => {
    if (user) {
      console.log('User already logged in, redirecting to dashboard...');
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        console.log('Attempting signInWithPassword...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log('signInWithPassword completed. Error:', error);
        if (error) throw error;
        
        if (data.session && data.user) {
          console.log('Setting auth state manually before navigation...');
          setAuthState(data.session, data.user);
        }
        
        console.log('Navigating to dashboard...');
        navigate('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setLocalAccessPending(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="max-w-md w-full mx-auto p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Access Pending</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Your account has been registered. Please wait for the administrator to approve your access.
            You will be notified once access is granted.
          </p>
          <p className="text-xs text-slate-400">Registered email: {email}</p>
          <button
            onClick={() => {
              setLocalAccessPending(false);
              // We can't easily clear the context's accessPending here without adding a method to context,
              // but reloading or just letting the user sign in again works.
              window.location.reload();
            }}
            className="text-sm text-purple-600 hover:underline"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00A8FF]/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-white dark:bg-[#0A1120]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-[#00A8FF] blur-lg opacity-40 rounded-full"></div>
            <Settings className="w-12 h-12 text-[#00A8FF] relative z-10" />
          </div>
        </div>
        
        <h2 className="text-2xl font-display font-bold text-center text-slate-900 dark:text-white mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8 text-sm">
          {isLogin ? 'Sign in to access your dashboard' : 'Sign up to start automating your workflows'}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-[#050B14] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-[#00A8FF] focus:border-transparent transition-all"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-[#050B14] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-[#00A8FF] focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-[#00A8FF] to-[#008DE6] hover:from-[#008DE6] hover:to-[#0070B8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00A8FF] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              isLogin ? 'Sign In' : 'Sign Up'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-[#00A8FF] hover:text-[#008DE6] font-medium transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
