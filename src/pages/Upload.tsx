import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, CheckCircle2, XCircle, Loader2, Upload as UploadIcon, FileSpreadsheet, AlertTriangle, Download, Settings2, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, number>>({});
  const [mappingConfirmed, setMappingConfirmed] = useState(false);

  const REQUIRED_FIELDS = [
    { id: 'desc', label: 'Description' },
    { id: 'size', label: 'Size' },
    { id: 'rating', label: 'Rating/Class' },
    { id: 'body', label: 'Body MOC' },
    { id: 'endType', label: 'End Type' },
    { id: 'trim', label: 'Trim' }
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setResult(null);
    setError('');
    setMappingConfirmed(false);
    setColumnMap({});
    setHeaders([]);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const res = await fetch('/api/extract-headers', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to extract headers');
        } else {
          const text = await res.text();
          throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}`);
        }
      }
      
      const data = await res.json();
      setHeaders(data.headers.map((h: any) => String(h).trim()));
      setColumnMap(data.columnMap || {});
    } catch (err: any) {
      console.error('Error reading headers:', err);
      setError(err.message || 'Failed to read Excel file headers.');
    }
  };

  const checkUsageLimit = async (): Promise<boolean> => {
    if (!user) return false;
    const { data: usage } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!usage) return true;

    const limit =
      usage.plan === 'free' ? 3 :
      usage.plan === 'starter' ? 20 :
      usage.plan === 'professional' ? 999 :
      usage.plan === 'custom' ? (usage.custom_run_limit || 10) :
      3;

    if (usage.runs_this_month >= limit) {
      setError(`Monthly limit reached (${limit} runs on ${usage.plan} plan). Please upgrade to continue.`);
      return false;
    }
    return true;
  };

  const handleProcessRFQ = async () => {
    if (!file || !mappingConfirmed) return;
    setLoading(true);
    setError('');
    
    try {
      const canProceed = await checkUsageLimit();
      if (!canProceed) {
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (user) formData.append('user_id', user.id);
      formData.append('columnMap', JSON.stringify(columnMap));
      
      const response = await fetch('/api/upload-rfq', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const err = await response.json();
          throw new Error(err.message || err.error || 'Processing failed');
        } else {
          const text = await response.text();
          throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
        }
      }
      
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/vnd.openxmlformats') ||
          contentType.includes('application/octet-stream')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'RFQ_Output.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        console.log('Process result:', data);
        setResult(data);

        if (user) {
          await supabase.from('processing_history').insert({
            user_id: user.id,
            filename: file.name,
            total_rows: data.total_rows,
            matched_rows: data.processed_rows.filter((r: any) => r.catalogueConfidence === 'high' || r.catalogueConfidence === 'medium').length,
            unmatched_rows: data.processed_rows.filter((r: any) => r.catalogueConfidence === 'none' || !r.catalogueConfidence).length,
            flag_count: data.flags?.length || 0,
            download_data: JSON.stringify(data.processed_rows)
          });

          await supabase.rpc('increment_usage', { p_user_id: user.id });
        }
      }
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

  return (
    <div className="max-w-7xl mx-auto mt-12 px-4 sm:px-6 space-y-10 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-[var(--text3)] hover:text-[var(--text)] mb-4 transition-colors"
      >
        ← Back
      </button>
      <header className="text-center space-y-4 mb-16 animate-fade-up">
        <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-[var(--text)]">
          ValveIQ <span className="text-[var(--accent)]">Pro</span>
        </h2>
        <p className="text-[var(--text3)] max-w-2xl mx-auto text-lg">
          Upload your RFQ Excel file and let our deterministic engineering rules engine auto-fill your technical working sheet.
        </p>
      </header>

      <div className="v-glow-card-wrapper animate-fade-up delay-100">
        <div className="v-glow-card">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-[var(--bg3)]">
              <FileSpreadsheet className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-display font-semibold text-[var(--text)] tracking-wide">Upload RFQ Excel</h2>
          </div>
          
          <div className="v-drop-zone p-12 flex flex-col items-center justify-center text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg3)] flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-110">
              <UploadIcon className="w-8 h-8 text-[var(--text3)]" />
            </div>
            <p className="text-sm text-[var(--text3)] mb-6 max-w-md">Upload an Excel file containing RFQ descriptions. Ensure columns like Item Description, Size, Rating, and Body/MOC are present.</p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls"
              onChange={handleFileSelect}
              className="hidden"
              ref={fileInputRef}
            />
            
            <button 
              className="v-btn-ghost px-6 py-2.5 text-sm font-medium"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              Select File
            </button>
            
            {file && !mappingConfirmed && (
              <div className="mt-6 px-4 py-2 bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.2)] rounded-lg flex items-center gap-2 max-w-full">
                <FileSpreadsheet className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <p className="text-sm font-medium text-[var(--accent)] truncate">
                  {file.name}
                </p>
              </div>
            )}
          </div>

          {file && headers.length > 0 && !mappingConfirmed && (
            <div className="mt-8 w-full text-left bg-[var(--bg3)] p-6 rounded-xl border border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-[var(--accent)]" />
                Map Columns
              </h3>
              <p className="text-sm text-[var(--text3)] mb-6">
                We've auto-detected some columns. Please verify and map the required fields to your Excel columns.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REQUIRED_FIELDS.map(field => (
                  <div key={field.id} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[var(--text)]">
                      {field.label}
                    </label>
                    <select
                      value={columnMap[field.id] !== undefined ? columnMap[field.id] : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setColumnMap(prev => {
                          const next = { ...prev };
                          if (val === '') delete next[field.id];
                          else next[field.id] = parseInt(val, 10);
                          return next;
                        });
                      }}
                      className="v-input w-full"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setMappingConfirmed(true)}
                  className="v-btn-primary flex items-center gap-2 px-6 py-2 text-sm font-medium"
                >
                  Confirm Mapping <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {file && mappingConfirmed && (
            <div className="mt-6 v-status-strip p-3 justify-between w-full">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--accent)]">
                    {file.name}
                  </p>
                  <p className="text-xs text-[var(--accent)] opacity-80">
                    Columns mapped successfully
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setMappingConfirmed(false)}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Edit Mapping
              </button>
            </div>
          )}

          <button 
            onClick={handleProcessRFQ}
            disabled={loading || !file || !mappingConfirmed}
            className="mt-8 w-full v-btn-primary flex items-center justify-center gap-2 px-6 py-3.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            PROCESS RFQ
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-6 py-4 rounded-xl flex items-start gap-4 animate-fade-up">
          <XCircle className="w-6 h-6 shrink-0" />
          <div>
            <h3 className="font-semibold">System Error</h3>
            <p className="text-sm mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-8 animate-fade-up delay-200">
          
          {result.catalogue_count === 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-6 py-4 rounded-xl flex items-start gap-4 mb-8">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-semibold">No Product Catalogue Uploaded</h3>
                <p className="text-sm mt-1">We processed the RFQ using standard industry rules, but we couldn't match products to your specific catalogue. Upload your catalogue in the Catalogue tab for better results.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="v-stat-card">
              <div className="text-xs font-semibold text-[var(--text3)] uppercase tracking-widest mb-2">Total Rows</div>
              <div className="v-stat-number text-4xl text-[var(--text)]">{result.total_rows}</div>
            </div>
            <div className="v-stat-card">
              <div className="text-xs font-semibold text-[var(--text3)] uppercase tracking-widest mb-2">Matched</div>
              <div className="v-stat-number text-4xl text-[var(--accent)]">
                {result.processed_rows.filter((r: any) => r.score >= 70).length}
              </div>
            </div>
            <div className="v-stat-card">
              <div className="text-xs font-semibold text-[var(--text3)] uppercase tracking-widest mb-2">Unmatched</div>
              <div className="v-stat-number text-4xl text-[var(--text3)]">
                {result.processed_rows.filter((r: any) => r.score < 70).length}
              </div>
            </div>
            <div className="v-stat-card">
              <div className="text-xs font-semibold text-[var(--text3)] uppercase tracking-widest mb-2">Flags</div>
              <div className="v-stat-number text-4xl text-yellow-500">{result.flags?.length || 0}</div>
            </div>
          </div>

          {result.flags && result.flags.length > 0 && (
            <div className="v-glow-card-wrapper" style={{ '--ga': '0deg', background: 'transparent' } as any}>
              <div className="v-glow-card border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-center gap-3 mb-6 text-yellow-500">
                  <AlertTriangle className="w-6 h-6" />
                  <h3 className="text-lg font-display font-bold tracking-wide">Engineering Flags</h3>
                </div>
                <div className="space-y-3">
                  {result.flags.map((flag: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-lg border flex items-start gap-3 ${flag.type === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'}`}>
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-sm">Row {flag.row}: {flag.field}</div>
                        <div className="text-sm opacity-90">{flag.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="v-glow-card p-0 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg3)]">
              <h3 className="text-lg font-display font-bold text-[var(--text)] tracking-wide">Working Sheet Results</h3>
              <button 
                onClick={handleDownload}
                className="v-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold"
              >
                <Download className="w-4 h-4" />
                Download Excel
              </button>
            </div>
            <div className="v-table overflow-x-auto border-none rounded-none">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Valve Type</th>
                    <th>Size</th>
                    <th>Class</th>
                    <th>Standard</th>
                    <th>Catalogue Match</th>
                    <th>Score</th>
                    <th>MOC</th>
                    <th>Trim</th>
                    <th>Seat</th>
                    <th>Gasket</th>
                    <th>Packing</th>
                    <th>Operator</th>
                    <th>End Detail</th>
                    <th>Bolting</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text2)]">
                  {result.processed_rows.map((row: any, idx: number) => {
                    const hasFlag = result.flags.some((f: any) => f.row === idx + 1);
                    return (
                      <tr key={idx} className={hasFlag ? 'bg-yellow-500/5' : ''}>
                        <td className="font-mono text-xs text-[var(--text3)]">{idx + 1}</td>
                        <td className="font-medium text-[var(--text)]">{row.valveType}</td>
                        <td>{row.size}</td>
                        <td>{row.class}</td>
                        <td className="text-xs">{row.standard}</td>
                        <td className="text-xs font-medium">{row.catalogueModel || row.model}</td>
                        <td className="text-xs">
                          {row.score >= 70 && <span className="v-badge-match">{row.score} (Match)</span>}
                          {row.score >= 40 && row.score < 70 && <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded-full">{row.score} (Review)</span>}
                          {row.score < 40 && <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded-full">{row.score} (Fail)</span>}
                        </td>
                        <td className="text-xs">{row.moc}</td>
                        <td className="text-xs">{row.trim}</td>
                        <td className="text-xs">{row.seat}</td>
                        <td className="text-xs max-w-[150px] truncate" title={row.gasket}>{row.gasket}</td>
                        <td className="text-xs max-w-[150px] truncate" title={row.packing}>{row.packing}</td>
                        <td className="text-xs">{row.operator}</td>
                        <td className="text-xs">{row.endDetail}</td>
                        <td className="text-xs">{row.bolting}</td>
                        <td>
                          {row.score >= 70 ? (
                            <CheckCircle2 className="w-5 h-5 text-[var(--accent)]" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          )}
                        </td>
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
