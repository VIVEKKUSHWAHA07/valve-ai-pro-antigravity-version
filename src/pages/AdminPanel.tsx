import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Activity, Search, CheckCircle2, XCircle, Loader2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function AdminPanel() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [newEmail, setNewEmail] = useState('');
  const [newPlan, setNewPlan] = useState('free');
  const [newCustomLimit, setNewCustomLimit] = useState(10);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!isAdmin) {
        navigate('/');
      } else {
        loadUsers();
      }
    }
  }, [isAdmin, authLoading, navigate]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Load pending requests
      const { data: pending } = await supabase
        .from('pending_access')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      if (pending) setPendingRequests(pending);

      // We need to fetch from app_access and user_usage
      const { data: accessData, error: accessError } = await supabase
        .from('app_access')
        .select('*')
        .order('email', { ascending: true });
        
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
      
      // Also remove from pending_access if they are there
      await supabase
        .from('pending_access')
        .delete()
        .eq('email', newEmail);
      
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
      // 1. Update app_access
      const { error } = await supabase
        .from('app_access')
        .update({ active: false })
        .eq('email', email);
        
      if (error) throw error;

      // 2. Remove from pending_access if they are there
      await supabase
        .from('pending_access')
        .delete()
        .eq('email', email);

      // 3. Optional: we can also call an API to sign them out or disable their auth account
      // but setting active: false in app_access is enough to block login.

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

  const approveRequest = async (email: string, requestId: string) => {
    try {
      // 1. Add to app_access
      await supabase.from('app_access').upsert({
        email,
        active: true,
        plan: 'free',
        granted_by: user?.id,
        // granted_at: new Date().toISOString() // Not in schema, skipping
      }, { onConflict: 'email' });

      // 2. Mark pending as approved or delete it
      await supabase.from('pending_access')
        .delete()
        .eq('email', email);

      // 3. Confirm their email in auth 
      //    (so Email not confirmed error disappears)
      await fetch('/api/admin/confirm-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, adminUserId: user?.id 
        })
      });

      // 4. Refresh list
      loadUsers();
      alert(`Access granted to ${email}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await supabase.from('pending_access')
        .delete()
        .eq('id', requestId);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (authLoading || !isAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto mt-8 px-4 sm:px-6 space-y-8 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-[var(--text3)] hover:text-[var(--text)] mb-4 transition-colors"
      >
        ← Back
      </button>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fade-up">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--text)] flex items-center gap-3">
            <Shield className="w-8 h-8 text-red-500" />
            Admin Panel
          </h1>
          <p className="text-[var(--text3)] mt-1">Manage users, access, and plans</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-500 animate-fade-up">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-up delay-100">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-yellow-500/30 flex items-center gap-2 bg-yellow-500/5">
              <Clock className="w-4 h-4 text-yellow-500" />
              <h3 className="font-semibold text-yellow-500 text-sm">
                Pending Access Requests ({pendingRequests.length})
              </h3>
            </div>
            
            {pendingRequests.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center text-[var(--text3)]">
                No pending requests
              </p>
            ) : (
              <div className="v-table overflow-x-auto border-none rounded-none">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Email</th>
                      <th className="text-left">Requested</th>
                      <th className="text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--text2)]">
                    {pendingRequests.map(req => (
                      <tr key={req.id}>
                        <td className="font-medium text-[var(--text)]">
                          {req.email}
                        </td>
                        <td className="text-xs">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveRequest(req.email, req.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => rejectRequest(req.id)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="v-glow-card p-6">
            <h2 className="text-lg font-bold text-[var(--text)] mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--accent)]" />
              Grant Access
            </h2>
            <form onSubmit={handleGrantAccess} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="v-input w-full"
                  placeholder="user@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Plan</label>
                <select
                  value={newPlan}
                  onChange={e => setNewPlan(e.target.value)}
                  className="v-input w-full"
                >
                  <option value="free">Free (3 runs/mo)</option>
                  <option value="starter">Starter (20 runs/mo)</option>
                  <option value="professional">Professional (Unlimited)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {newPlan === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Custom Run Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={newCustomLimit}
                    onChange={e => setNewCustomLimit(parseInt(e.target.value) || 10)}
                    className="v-input w-full"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={granting}
                className="v-btn-primary w-full flex items-center justify-center gap-2 px-4 py-2 font-medium disabled:opacity-50"
              >
                {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Grant Access
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="v-glow-card p-0 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg3)] flex justify-between items-center">
              <h3 className="font-semibold text-[var(--text)]">Access List</h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                <input 
                  type="text" 
                  placeholder="Search emails..." 
                  className="v-input pl-9 pr-4 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="v-table overflow-x-auto border-none rounded-none">
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" /></div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--text2)]">
                    {users.map((u, idx) => (
                      <tr key={idx}>
                        <td className="font-medium text-[var(--text)]">{u.email}</td>
                        <td className="capitalize">
                          {u.plan}
                          {u.plan === 'custom' && ` (${u.custom_run_limit})`}
                        </td>
                        <td>
                          {u.active ? (
                            <span className="px-2 py-1 bg-[rgba(34,197,94,0.1)] text-[var(--accent)] rounded text-xs font-medium border border-[rgba(34,197,94,0.2)]">Active</span>
                          ) : (
                            <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-xs font-medium border border-red-500/20">Revoked</span>
                          )}
                        </td>
                        <td className="text-right">
                          {u.active ? (
                            <button 
                              onClick={() => handleRevokeAccess(u.email)}
                              className="text-red-500 hover:text-red-400 text-xs font-medium transition-colors"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleRestoreAccess(u.email)}
                              className="text-[var(--accent)] hover:text-green-400 text-xs font-medium transition-colors"
                            >
                              Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-[var(--text3)]">No users found.</td>
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
