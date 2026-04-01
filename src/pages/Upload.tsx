import React, { useState, useRef, useEffect } from 'react';
import { Play, CheckCircle2, XCircle, Loader2, Upload as UploadIcon, FileSpreadsheet, AlertTriangle, Download, Settings2, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Upload() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showMapping, setShowMapping] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, number>>({});
  
  const systemFields = [
    { key: 'desc', label: 'Item Description' },
    { key: 'size', label: 'Size' },
    { key: 'rating', label: 'Rating / Class' },
    { key: 'body', label: 'Body / MOC' },
    { key: 'trim', label: 'Trim' },
    { key: 'endType', label: 'End Type' },
    { key: 'construct', label: 'Construction' },
    { key: 'qty', label: 'Quantity' }
  ];

  // Load saved mapping on mount
  useEffect(() => {
    const loadSavedMapping = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('engine_rules')
          .select('rule_data')
          .eq('user_id', user.id)
          .eq('rule_type', 'column_mapping')
          .eq('rule_key', 'default')
          .single();
          
        if (data && data.rule_data) {
          // We'll use this as a base when headers are extracted
          // But we can't apply it yet because we don't know the header indices of the new file
        }
      } catch (err) {
        console.error('Failed to load saved mapping', err);
      }
    };
    loadSavedMapping();
  }, [user]);

  const handleExtractHeaders = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/extract-headers', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract headers');
      
      setHeaders(data.headers);
      
      // Try to load saved mapping to match by header name
      let savedMappingByName: Record<string, string> = {};
      if (user) {
        const { data: savedData } = await supabase
          .from('engine_rules')
          .select('rule_data')
          .eq('user_id', user.id)
          .eq('rule_type', 'column_mapping')
          .eq('rule_key', 'default')
          .single();
          
        if (savedData && savedData.rule_data) {
          savedMappingByName = savedData.rule_data;
        }
      }

      // Initialize column map
      const initialMap: Record<string, number> = {};
      
      systemFields.forEach(field => {
        // 1. Try saved mapping by name
        if (savedMappingByName[field.key]) {
          const idx = data.headers.indexOf(savedMappingByName[field.key]);
          if (idx !== -1) {
            initialMap[field.key] = idx;
            return;
          }
        }
        
        // 2. Try auto-detected mapping
        if (data.detectedMap && data.detectedMap[field.key] !== undefined) {
          initialMap[field.key] = data.detectedMap[field.key];
        }
      });
      
      setColumnMap(initialMap);
      setShowMapping(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRFQ = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    
    try {
      // Save mapping for future use (save by header name, not index)
      if (user) {
        const mappingByName: Record<string, string> = {};
        Object.entries(columnMap).forEach(([key, idx]) => {
          if (idx !== undefined && idx !== -1 && headers[idx]) {
            mappingByName[key] = headers[idx];
          }
        });
        
        await supabase.from('engine_rules').upsert({
          user_id: user.id,
          rule_type: 'column_mapping',
          rule_key: 'default',
          rule_data: mappingByName
        }, { onConflict: 'rule_type,rule_key,user_id' });
      }

      const formData = new FormData();
      formData.append('file', file);
      if (user) formData.append('user_id', user.id);
      formData.append('columnMap', JSON.stringify(columnMap));
      
      const res = await fetch('/api/upload-rfq', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process file');
      
      setResult(data);
      setShowMapping(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result || !result.download_url) return;
    const a = document.createElement('a');
    a.href = result.download_url;
    a.download = `Working_Sheet_${new Date().getTime()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleMappingChange = (fieldKey: string, colIdxStr: string) => {
    const colIdx = parseInt(colIdxStr, 10);
    setColumnMap(prev => {
      const newMap = { ...prev };
      if (isNaN(colIdx) || colIdx === -1) {
        delete newMap[fieldKey];
      } else {
        newMap[fieldKey] = colIdx;
      }
      return newMap;
    });
  };

  const renderMappingRow = (field: { key: string, label: string }) => {
    const colIdx = columnMap[field.key];
    const isMapped = colIdx !== undefined && colIdx !== -1;
    
    return (
      <tr key={field.key} className="border-b border-slate-200 dark:border-slate-800/50 last:border-0">
        <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">{field.label}</td>
        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
          <select 
            value={isMapped ? colIdx : -1}
            onChange={(e) => handleMappingChange(field.key, e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00A8FF]/50 outline-none"
          >
            <option value={-1}>-- Not Mapped --</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
            ))}
          </select>
        </td>
        <td className="py-3 px-4 text-center">
          {isMapped ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" /> : <span className="text-slate-400">-</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-7xl mx-auto mt-12 px-6 space-y-10 pb-20">
      <header className="text-center space-y-4 mb-16">
        <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
          ValveIQ <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00A8FF] to-blue-400">Pro</span>
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg">
          Upload your RFQ Excel file and let our deterministic engineering rules engine auto-fill your technical working sheet.
        </p>
      </header>

      <div className="bg-white dark:bg-[#0A1120]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-200 dark:border-blue-500/20 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00A8FF] to-transparent opacity-0 dark:opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
            <FileSpreadsheet className="w-5 h-5 text-[#00A8FF]" />
          </div>
          <h2 className="text-xl font-display font-semibold text-slate-900 dark:text-white tracking-wide">Upload RFQ Excel</h2>
        </div>
        
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-[#050B14]/50 hover:bg-slate-100 dark:hover:bg-[#050B14] hover:border-[#00A8FF]/30 transition-all group/dropzone">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-500/5 flex items-center justify-center mb-4 group-hover/dropzone:scale-110 transition-transform duration-300">
            <UploadIcon className="w-8 h-8 text-[#00A8FF]/70 group-hover/dropzone:text-[#00A8FF]" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">Upload an Excel file containing RFQ descriptions. Ensure columns like Item Description, Size, Rating, and Body/MOC are present.</p>
          
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            ref={fileInputRef}
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/50 shadow-sm"
          >
            Select File
          </button>
          
          {file && (
            <div className="mt-6 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-lg flex items-center gap-2 max-w-full">
              <FileSpreadsheet className="w-4 h-4 text-[#00A8FF] shrink-0" />
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                {file.name}
              </p>
            </div>
          )}
        </div>

        <button 
          onClick={handleExtractHeaders}
          disabled={loading || !file}
          className="mt-8 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00A8FF] to-[#008DE6] hover:from-[#008DE6] hover:to-[#0070B8] text-white px-6 py-3.5 rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(0,168,255,0.3)] hover:shadow-[0_0_30px_rgba(0,168,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings2 className="w-5 h-5" />}
          EXTRACT HEADERS
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl flex items-start gap-4 backdrop-blur-sm">
          <XCircle className="w-6 h-6 shrink-0" />
          <div>
            <h3 className="font-semibold text-red-700 dark:text-red-300">System Error</h3>
            <p className="text-sm mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {showMapping && (
        <div className="bg-white dark:bg-[#0A1120]/90 backdrop-blur-xl p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
              <Settings2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-wide">Format Detected</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Please map the columns to the system fields.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/50 mb-8">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-800/50">Field</th>
                  <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-800/50">Detected Column</th>
                  <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-800/50 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                {systemFields.map(field => renderMappingRow(field))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <button 
              onClick={() => setShowMapping(false)}
              className="px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleProcessRFQ}
              disabled={loading}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Process RFQ'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {result && !showMapping && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-[#0A1120]/90 backdrop-blur-xl p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Total Rows</div>
              <div className="text-4xl font-display font-bold text-slate-900 dark:text-white">{result.total_rows}</div>
            </div>
            <div className="bg-white dark:bg-[#0A1120]/90 backdrop-blur-xl p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Processed</div>
              <div className="text-4xl font-display font-bold text-[#00A8FF]">{result.processed}</div>
            </div>
            <div className="bg-white dark:bg-[#0A1120]/90 backdrop-blur-xl p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Not Manufactured</div>
              <div className="text-4xl font-display font-bold text-yellow-500">{result.not_manufactured}</div>
            </div>
          </div>

          {result.flags && result.flags.length > 0 && (
            <div className="bg-white dark:bg-[#0A1120]/90 backdrop-blur-xl p-8 rounded-2xl border border-yellow-200 dark:border-yellow-500/30 shadow-lg">
              <div className="flex items-center gap-3 mb-6 text-yellow-600 dark:text-yellow-500">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-display font-bold tracking-wide">Engineering Flags</h3>
              </div>
              <div className="space-y-3">
                {result.flags.map((flag: any, idx: number) => (
                  <div key={idx} className={`p-4 rounded-lg border flex items-start gap-3 ${flag.type === 'critical' ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300' : 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-800 dark:text-yellow-300'}`}>
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm">Row {flag.row}: {flag.field}</div>
                      <div className="text-sm opacity-90">{flag.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#0A1120]/90 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#050B14]/50">
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-wide">Working Sheet Results</h3>
              <button 
                onClick={handleDownload}
                className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Row</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Valve Type</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Size</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Class</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Standard</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Model</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">MOC</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Trim</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Gasket</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Packing</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Operator</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">End Detail</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Bolting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
                  {result.processed_rows.map((row: any, idx: number) => {
                    const hasFlag = result.flags.some((f: any) => f.row === idx + 1);
                    return (
                      <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${hasFlag ? 'bg-yellow-50/50 dark:bg-yellow-500/5' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.valveType}</td>
                        <td className="px-4 py-3">{row.size}</td>
                        <td className="px-4 py-3">{row.class}</td>
                        <td className="px-4 py-3 text-xs">{row.standard}</td>
                        <td className="px-4 py-3 text-xs">{row.model}</td>
                        <td className="px-4 py-3 text-xs">{row.moc}</td>
                        <td className="px-4 py-3 text-xs">{row.trim}</td>
                        <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={row.gasket}>{row.gasket}</td>
                        <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={row.packing}>{row.packing}</td>
                        <td className="px-4 py-3 text-xs">{row.operator}</td>
                        <td className="px-4 py-3 text-xs">{row.endDetail}</td>
                        <td className="px-4 py-3 text-xs">{row.bolting}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
