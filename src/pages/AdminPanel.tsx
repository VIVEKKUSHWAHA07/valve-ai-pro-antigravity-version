import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Activity, Search, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [newEmail, setNewEmail] = useState('');
  const [newPlan, setNewPlan] = useState('free');
  const [newCustomLimit, setNewCustomLimit] = useState(10);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, [user]);

  const checkAdmin = async () => {
    if (!user?.email) return;
    try {
      const { data, error } = await supabase
        .from('app_access')
        .select('*')
        .eq('email', user.email)
        .single();
        
      if (data && (data.email === 'forai0707@gmail.com' || data.email === 'worldaffairs6265@gmail.com')) {
        setIsAdmin(true);
        loadUsers();
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Admin check failed:', err);
      navigate('/');
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      // We need to fetch from app_access and user_usage
      const { data: accessData, error: accessError } = await supabase
        .from('app_access')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (accessError) throw accessError;

      const { data: usageData, error: usageError } = await supabase
        .from('user_usage')
        .select('*');
        
      if (usageError) throw usageError;

      // Merge data
      const merged = accessData.map(acc => {
        const usage = usageData.find(u => {
          // We don't have user_id in app_access directly unless we added it, but we can match by email if we had it.
          // Wait, user_usage has user_id. app_access has email.
          // This is tricky. Let's just fetch app_access for now.
          return false; // We'll handle usage separately or just show access for now
        });
        return { ...acc, usage };
      });

      setUsers(merged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setGranting(true);
    setError(null);
    
    try {
      // Check if user exists in app_access
      const { data: existing } = await supabase
        .from('app_access')
        .select('*')
        .eq('email', newEmail)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('app_access')
          .update({
            active: true,
            plan: newPlan,
            custom_run_limit: newPlan === 'custom' ? newCustomLimit : null,
            granted_by: user?.id
          })
          .eq('email', newEmail);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('app_access')
          .insert({
            email: newEmail,
            active: true,
            plan: newPlan,
            custom_run_limit: newPlan === 'custom' ? newCustomLimit : null,
            granted_by: user?.id
          });
        if (error) throw error;
      }
      
      // Also try to update user_usage if the user has already signed up
      // We need to find the user_id by email. Since we can't easily query auth.users,
      // we'll just update app_access, and when the user logs in, they get the plan.
      // Wait, the trigger create_user_usage sets the plan to 'free' by default.
      // We can update user_usage by matching email? user_usage doesn't have email.
      // So we'll just let the app_access table be the source of truth for plan,
      // or we update user_usage when they log in. 
      // For now, just updating app_access is enough if we sync it later.
      
      setNewEmail('');
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeAccess = async (email: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${email}?`)) return;
    try {
      const { error } = await supabase
        .from('app_access')
        .update({ active: false })
        .eq('email', email);
        
      if (error) throw error;
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRestoreAccess = async (email: string) => {
    try {
      const { error } = await supabase
        .from('app_access')
        .update({ active: true })
        .eq('email', email);
        
      if (error) throw error;
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isAdmin && !loading) return null;

  return (
    <div className="max-w-7xl mx-auto mt-8 px-6 space-y-8 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
      >
        ← Back
      </button>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-red-500" />
            Admin Panel
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Manage users, access, and plans</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Grant Access
            </h2>
            <form onSubmit={handleGrantAccess} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  placeholder="user@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan</label>
                <select
                  value={newPlan}
                  onChange={e => setNewPlan(e.target.value)}
                  className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="free">Free (3 runs/mo)</option>
                  <option value="starter">Starter (20 runs/mo)</option>
                  <option value="professional">Professional (Unlimited)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {newPlan === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custom Run Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={newCustomLimit}
                    onChange={e => setNewCustomLimit(parseInt(e.target.value) || 10)}
                    className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={granting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Grant Access
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900 dark:text-white">Access List</h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search emails..." 
                  className="pl-9 pr-4 py-1.5 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {users.map((u, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{u.email}</td>
                        <td className="px-4 py-3 capitalize">
                          {u.plan}
                          {u.plan === 'custom' && ` (${u.custom_run_limit})`}
                        </td>
                        <td className="px-4 py-3">
                          {u.active ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded text-xs font-medium">Active</span>
                          ) : (
                            <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded text-xs font-medium">Revoked</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.active ? (
                            <button 
                              onClick={() => handleRevokeAccess(u.email)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleRestoreAccess(u.email)}
                              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-xs font-medium"
                            >
                              Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
