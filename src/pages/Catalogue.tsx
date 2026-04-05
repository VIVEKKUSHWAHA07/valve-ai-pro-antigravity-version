import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Trash2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CatalogueItem {
  id: string;
  category: string;
  value: string;
  is_available: boolean;
}

const CATEGORIES = [
  { id: 'valve_type', label: 'Valve Types' },
  { id: 'size', label: 'Sizes (inches)' },
  { id: 'pressure_class', label: 'Pressure Classes' },
  { id: 'moc', label: 'Material of Construction (MOC)' },
  { id: 'standard', label: 'Standards' },
  { id: 'end_type', label: 'End Types' },
  { id: 'trim', label: 'Trim' },
];

export function Catalogue() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      loadCatalogue();
    }
  }, [user]);

  const loadCatalogue = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('catalogue_items')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Failed to load catalogue:', err);
      setError('Failed to load catalogue data.');
    } finally {
      setFetching(false);
    }
  };

  const handleAdd = async (category: string) => {
    const value = inputs[category]?.trim();
    if (!value || !user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase
        .from('catalogue_items')
        .insert({
          user_id: user.id,
          category,
          value,
          is_available: true
        })
        .select()
        .single();

      if (error) throw error;

      setItems(prev => [...prev, data]);
      setInputs(prev => ({ ...prev, [category]: '' }));
      setSuccess(`Added "${value}" to ${CATEGORIES.find(c => c.id === category)?.label}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('catalogue_items')
        .update({ is_available: !currentStatus })
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;

      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, is_available: !currentStatus } : item
      ));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('catalogue_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== id));
      setSuccess('Item deleted successfully.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderCategorySection = (category: { id: string, label: string }) => {
    const categoryItems = items.filter(item => item.category === category.id);

    return (
      <div key={category.id} className="bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-[#21262D] shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-[#E6EDF3] mb-4">{category.label}</h2>
        
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={inputs[category.id] || ''}
            onChange={(e) => setInputs(prev => ({ ...prev, [category.id]: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd(category.id)}
            placeholder={`Add new ${category.label.toLowerCase()}...`}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg text-sm text-slate-900 dark:text-[#E6EDF3] focus:outline-none focus:ring-2 focus:ring-[#00A8FF] dark:focus:ring-[#7EE787] focus:border-transparent"
            disabled={loading}
          />
          <button
            onClick={() => handleAdd(category.id)}
            disabled={loading || !inputs[category.id]?.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[#00A8FF] hover:bg-[#0090DB] dark:bg-[#238636] dark:hover:bg-[#2EA043] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        <div className="space-y-2">
          {categoryItems.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-[#8B949E] italic">No items added yet</p>
          ) : (
            <ul className="space-y-2">
              {categoryItems.map(item => (
                <li key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-[#30363D] rounded-lg group">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.is_available}
                      onChange={() => handleToggle(item.id, item.is_available)}
                      className="w-4 h-4 text-[#00A8FF] dark:text-[#7EE787] bg-white dark:bg-[#161B22] border-slate-300 dark:border-[#30363D] rounded focus:ring-[#00A8FF] dark:focus:ring-[#7EE787] focus:ring-2"
                    />
                    <span className={`text-sm ${item.is_available ? 'text-slate-900 dark:text-[#E6EDF3]' : 'text-slate-500 dark:text-[#8B949E] line-through'}`}>
                      {item.value}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-slate-400 hover:text-red-600 dark:hover:text-[#F85149] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto mt-8 px-6 space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-[#E6EDF3] flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-[#00A8FF] dark:text-[#7EE787]" />
          Product Catalogue
        </h1>
        <p className="text-slate-600 dark:text-[#8B949E] mt-1">
          Build your catalogue by adding items in each category.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-[#F85149]/10 border border-red-200 dark:border-[#F85149]/30 rounded-xl flex items-start gap-3 text-red-600 dark:text-[#F85149]">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-[rgba(126,231,135,0.1)] border border-green-200 dark:border-[#7EE787]/30 rounded-xl flex items-start gap-3 text-green-700 dark:text-[#7EE787]">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{success}</p>
        </div>
      )}

      {fetching ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A8FF] dark:text-[#7EE787]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.map(renderCategorySection)}
        </div>
      )}
    </div>
  );
}
