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
    if (!file) return;
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
      
      const res = await fetch('/api/upload-rfq', {
        method: 'POST',
        body: formData
      });
      
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to process file');
        setResult(data);

        if (user) {
          // Save to processing_history with download data
          await supabase.from('processing_history').insert({
            user_id: user.id,
            filename: file.name,
            total_rows: data.total_rows,
            matched_rows: data.processed_rows.filter((r: any) => r.catalogueConfidence === 'high' || r.catalogueConfidence === 'medium').length,
            unmatched_rows: data.processed_rows.filter((r: any) => r.catalogueConfidence === 'none' || !r.catalogueConfidence).length,
            flag_count: data.flags?.length || 0,
            download_data: JSON.stringify(data.processed_rows)
          });

          // Increment usage counter
          await supabase.rpc('increment_usage', { p_user_id: user.id });
        }

      } else {
        const text = await res.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned an unexpected response (${res.status}). Please try again.`);
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
    <div className="max-w-7xl mx-auto mt-12 px-6 space-y-10 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-[#E6EDF3] mb-4"
      >
        ← Back
      </button>
      <header className="text-center space-y-4 mb-16">
        <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
          ValveIQ <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00A8FF] to-blue-400">Pro</span>
        </h2>
        <p className="text-slate-600 dark:text-[#8B949E] max-w-2xl mx-auto text-lg">
          Upload your RFQ Excel file and let our deterministic engineering rules engine auto-fill your technical working sheet.
        </p>
      </header>

      <div className="bg-white dark:bg-[#161B22] p-8 rounded-2xl border border-slate-200 dark:border-[#21262D] shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-4 h-4 hidden dark:block border-t-2 border-l-2 border-[#7EE787] opacity-40 rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 hidden dark:block border-b-2 border-r-2 border-[#7EE787] opacity-40 rounded-br-2xl" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00A8FF] dark:via-[#7EE787] to-transparent opacity-0 dark:opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-[rgba(126,231,135,0.1)] border border-blue-100 dark:border-[rgba(126,231,135,0.2)]">
            <FileSpreadsheet className="w-5 h-5 text-[#00A8FF] dark:text-[#7EE787]" />
          </div>
          <h2 className="text-xl font-display font-semibold text-slate-900 dark:text-[#E6EDF3] tracking-wide">Upload RFQ Excel</h2>
        </div>
        
        <div className="border-2 border-dashed border-slate-300 dark:border-[#30363D] rounded-xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-[#0D1117] hover:bg-slate-100 dark:hover:bg-[#161B22] hover:border-[#00A8FF]/30 dark:hover:border-[#7EE787]/50 transition-all group/dropzone">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-[rgba(126,231,135,0.05)] flex items-center justify-center mb-4 group-hover/dropzone:scale-110 transition-transform duration-300">
            <UploadIcon className="w-8 h-8 text-[#00A8FF]/70 dark:text-[#7EE787]/70 group-hover/dropzone:text-[#00A8FF] dark:group-hover/dropzone:text-[#7EE787]" />
          </div>
          <p className="text-sm text-slate-500 dark:text-[#8B949E] mb-6 max-w-md">Upload an Excel file containing RFQ descriptions. Ensure columns like Item Description, Size, Rating, and Body/MOC are present.</p>
          
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            ref={fileInputRef}
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-white dark:bg-[#21262D] hover:bg-slate-50 dark:hover:bg-[#30363D] border border-slate-200 dark:border-[#30363D] rounded-lg text-sm font-medium text-slate-700 dark:text-[#E6EDF3] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/50 dark:focus:ring-[#7EE787]/50 shadow-sm"
          >
            Select File
          </button>
          
          {file && (
            <div className="mt-6 px-4 py-2 bg-blue-50 dark:bg-[rgba(126,231,135,0.1)] border border-blue-100 dark:border-[rgba(126,231,135,0.2)] rounded-lg flex items-center gap-2 max-w-full">
              <FileSpreadsheet className="w-4 h-4 text-[#00A8FF] dark:text-[#7EE787] shrink-0" />
              <p className="text-sm font-medium text-blue-600 dark:text-[#7EE787] truncate">
                {file.name}
              </p>
            </div>
          )}
        </div>

        <button 
          onClick={handleProcessRFQ}
          disabled={loading || !file}
          className="mt-8 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00A8FF] to-[#008DE6] hover:from-[#008DE6] hover:to-[#0070B8] dark:from-[#238636] dark:to-[#2EA043] dark:hover:from-[#2EA043] dark:hover:to-[#3FB950] text-white px-6 py-3.5 rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(0,168,255,0.3)] hover:shadow-[0_0_30px_rgba(0,168,255,0.5)] dark:shadow-[0_0_20px_rgba(126,231,135,0.2)] dark:hover:shadow-[0_0_30px_rgba(126,231,135,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
          PROCESS RFQ
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-[#3D0000] border border-red-200 dark:border-[#F85149] text-red-600 dark:text-[#F85149] px-6 py-4 rounded-xl flex items-start gap-4 backdrop-blur-sm">
          <XCircle className="w-6 h-6 shrink-0" />
          <div>
            <h3 className="font-semibold text-red-700 dark:text-[#F85149]">System Error</h3>
            <p className="text-sm mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {result.catalogue_count === 0 && (
            <div className="bg-yellow-50 dark:bg-[#341A00] border border-yellow-200 dark:border-[#F0883E] text-yellow-800 dark:text-[#F0883E] px-6 py-4 rounded-xl flex items-start gap-4 mb-8">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-semibold">No Product Catalogue Uploaded</h3>
                <p className="text-sm mt-1">We processed the RFQ using standard industry rules, but we couldn't match products to your specific catalogue. Upload your catalogue in the Catalogue tab for better results.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-[#161B22] p-6 rounded-xl border border-slate-200 dark:border-[#21262D] shadow-sm relative">
              <div className="absolute top-0 left-0 w-3 h-3 hidden dark:block border-t-2 border-l-2 border-[#7EE787] opacity-40 rounded-tl-xl" />
              <div className="absolute bottom-0 right-0 w-3 h-3 hidden dark:block border-b-2 border-r-2 border-[#7EE787] opacity-40 rounded-br-xl" />
              <div className="text-xs font-semibold text-slate-500 dark:text-[#8B949E] uppercase tracking-widest mb-2">Total Rows</div>
              <div className="text-4xl font-display font-bold text-slate-900 dark:text-[#E6EDF3]">{result.total_rows}</div>
            </div>
            <div className="bg-white dark:bg-[#161B22] p-6 rounded-xl border border-slate-200 dark:border-[#21262D] shadow-sm relative">
              <div className="absolute top-0 left-0 w-3 h-3 hidden dark:block border-t-2 border-l-2 border-[#7EE787] opacity-40 rounded-tl-xl" />
              <div className="absolute bottom-0 right-0 w-3 h-3 hidden dark:block border-b-2 border-r-2 border-[#7EE787] opacity-40 rounded-br-xl" />
              <div className="text-xs font-semibold text-slate-500 dark:text-[#8B949E] uppercase tracking-widest mb-2">Matched</div>
              <div className="text-4xl font-display font-bold text-[#00A8FF] dark:text-[#7EE787]">
                {result.processed_rows.filter((r: any) => r.catalogueConfidence === 'high' || r.catalogueConfidence === 'medium').length}
              </div>
            </div>
            <div className="bg-white dark:bg-[#161B22] p-6 rounded-xl border border-slate-200 dark:border-[#21262D] shadow-sm relative">
              <div className="absolute top-0 left-0 w-3 h-3 hidden dark:block border-t-2 border-l-2 border-[#7EE787] opacity-40 rounded-tl-xl" />
              <div className="absolute bottom-0 right-0 w-3 h-3 hidden dark:block border-b-2 border-r-2 border-[#7EE787] opacity-40 rounded-br-xl" />
              <div className="text-xs font-semibold text-slate-500 dark:text-[#8B949E] uppercase tracking-widest mb-2">Unmatched</div>
              <div className="text-4xl font-display font-bold text-slate-500 dark:text-[#8B949E]">
                {result.processed_rows.filter((r: any) => r.catalogueConfidence === 'none' || !r.catalogueConfidence).length}
              </div>
            </div>
            <div className="bg-white dark:bg-[#161B22] p-6 rounded-xl border border-slate-200 dark:border-[#21262D] shadow-sm relative">
              <div className="absolute top-0 left-0 w-3 h-3 hidden dark:block border-t-2 border-l-2 border-[#7EE787] opacity-40 rounded-tl-xl" />
              <div className="absolute bottom-0 right-0 w-3 h-3 hidden dark:block border-b-2 border-r-2 border-[#7EE787] opacity-40 rounded-br-xl" />
              <div className="text-xs font-semibold text-slate-500 dark:text-[#8B949E] uppercase tracking-widest mb-2">Flags</div>
              <div className="text-4xl font-display font-bold text-yellow-500 dark:text-[#F0883E]">{result.flags?.length || 0}</div>
            </div>
          </div>

          {result.flags && result.flags.length > 0 && (
            <div className="bg-white dark:bg-[#161B22] p-8 rounded-2xl border border-yellow-200 dark:border-[#F0883E]/50 shadow-lg relative">
              <div className="absolute top-0 left-0 w-4 h-4 hidden dark:block border-t-2 border-l-2 border-[#F0883E] opacity-40 rounded-tl-2xl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 hidden dark:block border-b-2 border-r-2 border-[#F0883E] opacity-40 rounded-br-2xl" />
              <div className="flex items-center gap-3 mb-6 text-yellow-600 dark:text-[#F0883E]">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-display font-bold tracking-wide">Engineering Flags</h3>
              </div>
              <div className="space-y-3">
                {result.flags.map((flag: any, idx: number) => (
                  <div key={idx} className={`p-4 rounded-lg border flex items-start gap-3 ${flag.type === 'critical' ? 'bg-red-50 dark:bg-[#3D0000] border-red-200 dark:border-[#F85149] text-red-800 dark:text-[#F85149]' : 'bg-yellow-50 dark:bg-[#341A00] border-yellow-200 dark:border-[#F0883E] text-yellow-800 dark:text-[#F0883E]'}`}>
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

          <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200 dark:border-[#21262D] shadow-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-[#21262D] flex justify-between items-center bg-slate-50 dark:bg-[#0D1117]">
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-[#E6EDF3] tracking-wide">Working Sheet Results</h3>
              <button 
                onClick={handleDownload}
                className="flex items-center gap-2 bg-slate-900 dark:bg-[#238636] text-white dark:text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 dark:hover:bg-[#2EA043] transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-[#0D1117] text-slate-600 dark:text-[#8B949E] font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Row</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Valve Type</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Size</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Class</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Standard</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Catalogue Match</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Score</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">MOC</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Trim</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Gasket</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Packing</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Operator</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">End Detail</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Bolting</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-[#21262D]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#21262D] text-slate-700 dark:text-[#E6EDF3]">
                  {result.processed_rows.map((row: any, idx: number) => {
                    const hasFlag = result.flags.some((f: any) => f.row === idx + 1);
                    return (
                      <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-[rgba(126,231,135,0.04)] transition-colors ${hasFlag ? 'bg-yellow-50/50 dark:bg-[rgba(240,136,62,0.1)]' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-[#8B949E]">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-[#E6EDF3]">{row.valveType}</td>
                        <td className="px-4 py-3">{row.size}</td>
                        <td className="px-4 py-3">{row.class}</td>
                        <td className="px-4 py-3 text-xs">{row.standard}</td>
                        <td className="px-4 py-3 text-xs font-medium">{row.catalogueModel || row.model}</td>
                        <td className="px-4 py-3 text-xs">
                          {row.catalogueConfidence === 'high' && <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">{row.catalogueMatchScore} (High)</span>}
                          {row.catalogueConfidence === 'medium' && <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">{row.catalogueMatchScore} (Med)</span>}
                          {row.catalogueConfidence === 'low' && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">{row.catalogueMatchScore} (Low)</span>}
                          {(!row.catalogueConfidence || row.catalogueConfidence === 'none') && <span className="px-2 py-1 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 rounded-full">0 (None)</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">{row.moc}</td>
                        <td className="px-4 py-3 text-xs">{row.trim}</td>
                        <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={row.gasket}>{row.gasket}</td>
                        <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={row.packing}>{row.packing}</td>
                        <td className="px-4 py-3 text-xs">{row.operator}</td>
                        <td className="px-4 py-3 text-xs">{row.endDetail}</td>
                        <td className="px-4 py-3 text-xs">{row.bolting}</td>
                        <td className="px-4 py-3 text-xs">
                          {row.catalogueConfidence === 'high' || row.catalogueConfidence === 'medium' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
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
