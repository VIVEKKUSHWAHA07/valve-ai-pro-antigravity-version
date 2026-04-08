import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Building2, Briefcase, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    role: '',
  });

  useEffect(() => {
    if (user?.user_metadata) {
      setFormData({
        fullName: user.user_metadata.full_name || '',
        companyName: user.user_metadata.company_name || '',
        role: user.user_metadata.role || '',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: formData.fullName,
          company_name: formData.companyName,
          role: formData.role,
        }
      });

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto mt-12 px-4 sm:px-6 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-[var(--text3)] hover:text-[var(--text)] mb-4 transition-colors"
      >
        ← Back
      </button>
      <div className="mb-10 animate-fade-up">
        <h1 className="text-3xl font-display font-bold text-[var(--text)] mb-2">Profile Settings</h1>
        <p className="text-[var(--text3)]">Manage your account details and preferences.</p>
      </div>

      <div className="v-glow-card p-0 overflow-hidden shadow-lg animate-fade-up delay-100">
        <div className="p-8 border-b border-[var(--border)] bg-[var(--bg3)]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 shrink-0 rounded-full bg-gradient-to-br from-[var(--accent)] to-green-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <h2 className="text-xl font-bold text-[var(--text)] truncate">{formData.fullName || 'User'}</h2>
              <p className="text-[var(--text3)] truncate">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--accent)]">Profile updated successfully!</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-[var(--text3)]" />
                  </div>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="v-input block w-full pl-10 h-10 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Company Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-[var(--text3)]" />
                  </div>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="v-input block w-full pl-10 h-10 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    placeholder="Acme Corp"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Role / Title</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-5 w-5 text-[var(--text3)]" />
                  </div>
                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="v-input block w-full pl-10 h-10 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    placeholder="Procurement Engineer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="v-btn-primary flex items-center justify-center gap-2 px-6 h-10 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
