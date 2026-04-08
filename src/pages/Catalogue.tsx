import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Trash2, Plus, Upload, Search, ChevronDown, ChevronRight, MoreVertical, Download, X, FolderPlus, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

interface CatalogueItem {
  id: string;
  category: string;
  value: string;
  is_available: boolean;
}

const PRIORITY_ORDER = [
  'ValveType', 'ValveSize', 'ValveClass', 'ValveMOC', 'Trim', 
  'END_DETAIL', 'OPERATOR', 'Bolting', 'Gasket', 'Packing_Stem_Seal', 
  'Model', 'STANDARD', 'SERVICE'
];

function formatCategoryName(cat: string) {
  return cat.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

// Toast Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-xl border shadow-lg flex items-center gap-3 z-50 animate-fade-up ${
      type === 'success' ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.2)] text-[var(--accent)]' 
      : 'bg-red-500/10 border-red-500/30 text-red-500'
    }`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClose} className="ml-2 hover:opacity-70"><X className="w-4 h-4" /></button>
    </div>
  );
};

export function Catalogue() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [emptyCategories, setEmptyCategories] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) loadCatalogue();
  }, [user]);

  const loadCatalogue = async () => {
    setFetching(true);
    setError(null);
    try {
      let allItems: CatalogueItem[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('catalogue_items')
          .select('id, category, value, is_available')
          .eq('user_id', user?.id)
          .range(from, from + batchSize - 1)
          .order('category', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) break;
        allItems = [...allItems, ...data];
        if (data.length < batchSize) break;
        from += batchSize;
      }
      
      console.log(`Total rows returned: ${allItems.length}`);
      const uniqueCategories = Array.from(new Set(allItems.map(item => item.category)));
      console.log('Unique categories:', uniqueCategories);

      setItems(allItems);
    } catch (err: any) {
      console.error('Failed to load catalogue:', err);
      setError('Failed to load catalogue data. Please try again.');
    } finally {
      setFetching(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    setError(null);

    try {
      // Always clear existing data for the user before importing
      const { error: deleteError } = await supabase.from('catalogue_items').delete().eq('user_id', user.id);
      if (deleteError) {
        console.error('Failed to clear old data', deleteError);
        throw new Error('Failed to clear existing catalogue data.');
      }

      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const newItems: any[] = [];
      const existingSet = new Set<string>();

      for (const row of rows) {
        const cat = String(row[0] ?? '').trim();
        const val = String(row[1] ?? '').trim();
        if (!cat || !val || val === '-') continue;

        const key = `${cat.toLowerCase()}|${val.toLowerCase()}`;
        if (!existingSet.has(key)) {
          newItems.push({
            user_id: user.id,
            category: cat,
            value: val,
            is_available: true,
          });
          existingSet.add(key);
        }
      }

      if (newItems.length === 0) {
        throw new Error('No new valid catalogue items found in the Excel file.');
      }

      const BATCH_SIZE = 200;
      let insertedCount = 0;

      for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
        const batch = newItems.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from('catalogue_items').insert(batch);
        if (insertError) throw new Error(`Batch insert failed: ${insertError.message}`);
        insertedCount += batch.length;
      }

      showToast(`Successfully imported ${insertedCount} items.`);
      await loadCatalogue();
    } catch (err: any) {
      console.error('Excel import failed:', err);
      setError(err.message || 'Failed to import from Excel.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddNewCategory = () => {
    if (!newCategoryName.trim()) return;
    setEmptyCategories(prev => new Set(prev).add(newCategoryName.trim()));
    setNewCategoryName('');
    setShowNewCategory(false);
    showToast(`Category "${newCategoryName}" created.`);
  };

  const groupedItems = useMemo(() => {
    const map = new Map<string, CatalogueItem[]>();
    
    PRIORITY_ORDER.forEach(cat => map.set(cat, []));
    emptyCategories.forEach(cat => map.set(cat, []));

    items.forEach(item => {
      // Find case-insensitive match in PRIORITY_ORDER or use raw category
      const priorityMatch = PRIORITY_ORDER.find(p => p.toLowerCase() === item.category.toLowerCase());
      const catKey = priorityMatch || item.category;

      if (!map.has(catKey)) {
        map.set(catKey, []);
      }
      if (!searchQuery || item.value.toLowerCase().includes(searchQuery.toLowerCase()) || catKey.toLowerCase().includes(searchQuery.toLowerCase())) {
        map.get(catKey)!.push(item);
      }
    });

    if (searchQuery) {
      for (const [cat, catItems] of map.entries()) {
        if (catItems.length === 0 && !cat.toLowerCase().includes(searchQuery.toLowerCase())) {
          map.delete(cat);
        }
      }
    }

    console.log('Total categories loaded: ' + map.size + ' — ' + Array.from(map.keys()).join(', '));

    return map;
  }, [items, searchQuery, emptyCategories]);

  const sortedCategories = useMemo(() => {
    const cats = Array.from(groupedItems.keys()) as string[];
    return cats.sort((a: string, b: string) => {
      const idxA = PRIORITY_ORDER.indexOf(a);
      const idxB = PRIORITY_ORDER.indexOf(b);
      
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [groupedItems]);

  return (
    <div className="max-w-7xl mx-auto mt-8 px-4 sm:px-6 space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--text)] flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-[var(--accent)]" />
            Catalogue Manager
          </h1>
          <p className="text-[var(--text3)] mt-1">
            Manage your dynamic product catalogue and categories.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`v-btn-ghost flex items-center gap-2 px-4 h-10 text-sm font-medium ${isEditMode ? 'text-[var(--accent)] bg-[rgba(34,197,94,0.1)]' : ''}`}
          >
            {isEditMode ? 'Done Editing' : 'Edit Mode'}
          </button>
          <button
            onClick={() => setShowNewCategory(true)}
            className="v-btn-ghost flex items-center gap-2 px-4 h-10 text-sm font-medium"
          >
            <FolderPlus className="w-4 h-4" />
            New Category
          </button>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="v-btn-primary flex items-center gap-2 px-4 h-10 text-sm font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import Excel
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 animate-fade-up delay-100">
        <div className="relative flex-1 flex items-center">
          <Search className="absolute left-3 w-5 h-5 text-[var(--text3)]" />
          <input
            type="text"
            placeholder="Search items or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="v-input w-full pl-10 pr-4 h-10"
          />
        </div>
        {showNewCategory && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Category name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNewCategory()}
              className="v-input px-4 py-2"
              autoFocus
            />
            <button onClick={handleAddNewCategory} className="p-2 bg-[rgba(34,197,94,0.1)] text-[var(--accent)] rounded-lg hover:bg-[rgba(34,197,94,0.2)] transition-colors">
              <CheckCircle2 className="w-5 h-5" />
            </button>
            <button onClick={() => setShowNewCategory(false)} className="p-2 bg-[var(--bg3)] text-[var(--text3)] rounded-lg hover:bg-[var(--border)] hover:text-[var(--text)] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between text-red-500 animate-fade-up">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
          <button onClick={loadCatalogue} className="v-btn-ghost flex items-center gap-2 px-3 py-1.5 text-sm">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {fetching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up delay-200">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="v-glow-card p-6 animate-pulse">
              <div className="h-6 bg-[var(--bg3)] rounded w-1/2 mb-4"></div>
              <div className="space-y-3">
                <div className="h-10 bg-[var(--bg3)] rounded"></div>
                <div className="h-10 bg-[var(--bg3)] rounded"></div>
                <div className="h-10 bg-[var(--bg3)] rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : sortedCategories.length === 0 ? (
        <div className="text-center py-20 v-glow-card animate-fade-up delay-200">
          <FileSpreadsheet className="w-12 h-12 text-[var(--text3)] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[var(--text)]">Catalogue is empty</h3>
          <p className="text-[var(--text3)] mt-2 mb-6">Import an Excel file or create a new category to get started.</p>
          <button onClick={() => fileInputRef.current?.click()} className="v-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
            <Upload className="w-4 h-4" /> Import Excel
          </button>
        </div>
      ) : (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 animate-fade-up delay-200">
          {sortedCategories.map(category => (
            <div key={category} className="break-inside-avoid mb-6">
              <CategoryCard 
                category={category} 
                items={groupedItems.get(category) || []} 
                onUpdate={loadCatalogue}
                showToast={showToast}
                onDeleteCategory={() => {
                  setEmptyCategories(prev => {
                    const next = new Set(prev);
                    next.delete(category);
                    return next;
                  });
                  loadCatalogue();
                }}
                isEditMode={isEditMode}
              />
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

const CategoryCard: React.FC<{ category: string, items: CatalogueItem[], onUpdate: () => Promise<void> | void, showToast: (msg: string, type?: 'success'|'error') => void, onDeleteCategory: () => void, isEditMode: boolean }> = ({ category, items, onUpdate, showToast, onDeleteCategory, isEditMode }) => {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [newItemValue, setNewItemValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleAdd = async () => {
    if (!newItemValue.trim() || !user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('catalogue_items').insert({
        user_id: user.id,
        category,
        value: newItemValue.trim(),
        is_available: true
      });
      if (error) throw error;
      showToast(`Added "${newItemValue}" to ${formatCategoryName(category)}`);
      setNewItemValue('');
      onUpdate();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from('catalogue_items').update({ is_available: !current }).eq('id', id);
      if (error) throw error;
      onUpdate();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('catalogue_items').delete().eq('id', id);
      if (error) throw error;
      showToast('Item deleted');
      onUpdate();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkToggle = async (enable: boolean) => {
    setShowMenu(false);
    if (!user) return;
    try {
      const ids = items.map(i => i.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from('catalogue_items').update({ is_available: enable }).in('id', ids);
      if (error) throw error;
      showToast(`All items ${enable ? 'enabled' : 'disabled'}`);
      onUpdate();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteCategory = async () => {
    setShowMenu(false);
    if (!user || !window.confirm(`Delete category "${formatCategoryName(category)}" and all its items?`)) return;
    try {
      const { error } = await supabase.from('catalogue_items').delete().eq('user_id', user.id).eq('category', category);
      if (error) throw error;
      showToast('Category deleted');
      onDeleteCategory();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleExport = () => {
    setShowMenu(false);
    const content = items.map(i => i.value).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${category}_items.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="v-glow-card flex flex-col h-fit max-h-[500px] p-0 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--surface)] z-10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight className="w-5 h-5 text-[var(--text3)]" /> : <ChevronDown className="w-5 h-5 text-[var(--text3)]" />}
          <h2 className="text-lg font-bold text-[var(--text)]">{formatCategoryName(category)}</h2>
          <span className="px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.1)] text-xs font-medium text-[var(--accent)]">
            {items.length}
          </span>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 hover:bg-[var(--bg3)] hover:text-[var(--text)] rounded-lg text-[var(--text3)] transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg z-30 py-1">
                <button onClick={() => handleBulkToggle(true)} className="w-full text-left px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg3)]">Enable All</button>
                <button onClick={() => handleBulkToggle(false)} className="w-full text-left px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg3)]">Disable All</button>
                <button onClick={handleExport} className="w-full text-left px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg3)] flex items-center justify-between">Export <Download className="w-4 h-4" /></button>
                <div className="h-px bg-[var(--border)] my-1" />
                <button onClick={handleDeleteCategory} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center justify-between">Delete Category <Trash2 className="w-4 h-4" /></button>
              </div>
            </>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[100px]">
          {items.length === 0 ? (
            <p className="text-sm text-[var(--text3)] italic text-center py-4">No items found</p>
          ) : (
            <ul className="space-y-2">
              {items.map(item => (
                <li key={item.id} className="flex items-center justify-between p-2.5 bg-[var(--bg3)] border border-[var(--border)] rounded-lg group hover:border-[var(--accent)] transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {isEditMode && (
                      <input
                        type="checkbox"
                        checked={item.is_available}
                        onChange={() => handleToggle(item.id, item.is_available)}
                        className="w-4 h-4 shrink-0 text-[var(--accent)] bg-[var(--surface)] border-[var(--border)] rounded focus:ring-[var(--accent)] focus:ring-2 cursor-pointer"
                      />
                    )}
                    <span className={`text-sm truncate ${item.is_available ? 'text-[var(--text)]' : 'text-[var(--text3)] line-through'}`} title={item.value}>
                      {item.value}
                    </span>
                  </div>
                  {isEditMode && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-[var(--text3)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1"
                      title="Delete item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!collapsed && isEditMode && (
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemValue}
              onChange={(e) => setNewItemValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add new item..."
              className="v-input flex-1 px-3 py-2"
              disabled={loading}
            />
            <button
              onClick={handleAdd}
              disabled={loading || !newItemValue.trim()}
              className="v-btn-primary p-2 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
