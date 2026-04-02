import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Play, Search, Activity, FileSpreadsheet, CheckCircle2, XCircle, Loader2, UploadCloud } from 'lucide-react';

export function TestPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('single');
  
  // Single Row Tester State
  const [singleInput, setSingleInput] = useState({
    desc: '',
    rating: '',
    size: '',
    body: '',
    trim: '',
    endType: '',
    construct: ''
  });
  const [singleResult, setSingleResult] = useState<any>(null);
  const [isSingleLoading, setIsSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);

  const handleSingleTest = async () => {
    setIsSingleLoading(true);
    setSingleError(null);
    setSingleResult(null);
    try {
      const response = await fetch('/api/test/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(singleInput)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to run test');
      
      setSingleResult(data.result);
    } catch (err: any) {
      setSingleError(err.message);
    } finally {
      setIsSingleLoading(false);
    }
  };

  // Batch Test State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Fuzzy Match State
  const [fuzzyInput, setFuzzyInput] = useState('');
  const [fuzzyResult, setFuzzyResult] = useState<any[] | null>(null);
  const [isFuzzyLoading, setIsFuzzyLoading] = useState(false);
  const [fuzzyError, setFuzzyError] = useState<string | null>(null);

  const handleFuzzyTest = async () => {
    if (!fuzzyInput.trim()) return;
    setIsFuzzyLoading(true);
    setFuzzyError(null);
    setFuzzyResult(null);
    try {
      const response = await fetch('/api/test/fuzzy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desc: fuzzyInput })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to run fuzzy match');
      setFuzzyResult(data.matches);
    } catch (err: any) {
      setFuzzyError(err.message);
    } finally {
      setIsFuzzyLoading(false);
    }
  };

  // Rule Trace State
  const [traceInput, setTraceInput] = useState('');
  const [traceResult, setTraceResult] = useState<string[] | null>(null);
  const [isTraceLoading, setIsTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  const handleTraceTest = async () => {
    if (!traceInput.trim()) return;
    setIsTraceLoading(true);
    setTraceError(null);
    setTraceResult(null);
    try {
      const response = await fetch('/api/test/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desc: traceInput })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to run rule trace');
      setTraceResult(data.trace);
    } catch (err: any) {
      setTraceError(err.message);
    } finally {
      setIsTraceLoading(false);
    }
  };

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBatchFile(e.target.files[0]);
    }
  };

  const handleBatchTest = async () => {
    if (!batchFile) return;
    
    setIsBatchLoading(true);
    setBatchError(null);
    setBatchResult(null);
    
    const formData = new FormData();
    formData.append('file', batchFile);

    try {
      const response = await fetch('/api/upload-rfq', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to run batch test');
      
      setBatchResult(data);
    } catch (err: any) {
      setBatchError(err.message);
    } finally {
      setIsBatchLoading(false);
    }
  };

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
            <Beaker className="w-8 h-8 text-green-500" />
            Test Panel
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Verify engine logic and catalogue matching</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {[
            { id: 'single', label: 'Section A: Single Row Tester' },
            { id: 'fuzzy', label: 'Section B: Fuzzy Match Tester' },
            { id: 'trace', label: 'Section C: Rule Trace' },
            { id: 'batch', label: 'Section D: Batch Test' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-green-500 text-green-600 dark:text-green-400 bg-white dark:bg-slate-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'single' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Input Data</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                      <input 
                        type="text" 
                        value={singleInput.desc}
                        onChange={(e) => setSingleInput({...singleInput, desc: e.target.value})}
                        className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-green-500 focus:border-green-500" 
                        placeholder="e.g. GTV 6&quot; CL600 A105 BWE REDUCED BORE" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rating</label>
                        <input 
                          type="text" 
                          value={singleInput.rating}
                          onChange={(e) => setSingleInput({...singleInput, rating: e.target.value})}
                          className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-green-500 focus:border-green-500" 
                          placeholder="150#" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Size</label>
                        <input 
                          type="text" 
                          value={singleInput.size}
                          onChange={(e) => setSingleInput({...singleInput, size: e.target.value})}
                          className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-green-500 focus:border-green-500" 
                          placeholder="6&quot;" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Body/MOC</label>
                        <input 
                          type="text" 
                          value={singleInput.body}
                          onChange={(e) => setSingleInput({...singleInput, body: e.target.value})}
                          className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-green-500 focus:border-green-500" 
                          placeholder="A105" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trim</label>
                        <input 
                          type="text" 
                          value={singleInput.trim}
                          onChange={(e) => setSingleInput({...singleInput, trim: e.target.value})}
                          className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-green-500 focus:border-green-500" 
                          placeholder="TRIM 8" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Type</label>
                        <input 
                          type="text" 
                          value={singleInput.endType}
                          onChange={(e) => setSingleInput({...singleInput, endType: e.target.value})}
                          className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-green-500 focus:border-green-500" 
                          placeholder="BWE" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Construction</label>
                        <input 
                          type="text" 
                          value={singleInput.construct}
                          onChange={(e) => setSingleInput({...singleInput, construct: e.target.value})}
                          className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-green-500 focus:border-green-500" 
                          placeholder="FLOAT" 
                        />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleSingleTest}
                    disabled={isSingleLoading}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isSingleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 
                    {isSingleLoading ? 'Running...' : 'Run Engine'}
                  </button>
                  {singleError && (
                    <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400">
                      {singleError}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Output Results</h3>
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 min-h-[400px]">
                    {singleResult ? (
                      <>
                        {[
                          { label: 'Valve Type', value: singleResult.processedRow.valveType, rule: 'Rule 2 — Valve Type Detection' },
                          { label: 'Size', value: singleResult.processedRow.size, rule: 'Size Parsing' },
                          { label: 'Class', value: singleResult.processedRow.class, rule: 'Rule 4 — Pressure Class' },
                          { label: 'Standard', value: singleResult.processedRow.standard, rule: 'Rule 5 — Standard' },
                          { label: 'Model', value: singleResult.processedRow.model, rule: 'Rule 6 — Model' },
                          { label: 'MOC', value: singleResult.processedRow.moc, rule: 'Rule 7 — MOC' },
                          { label: 'Trim', value: singleResult.processedRow.trim, rule: 'Rule 15 — Trim' },
                          { label: 'Gasket', value: singleResult.processedRow.gasket, rule: 'Rule 8 — Gasket' },
                          { label: 'Packing', value: singleResult.processedRow.packing, rule: 'Rule 9 — Packing' },
                          { label: 'Operator', value: singleResult.processedRow.operator, rule: 'Rule 10 — Operator' },
                          { label: 'End Detail', value: singleResult.processedRow.endDetail, rule: 'Rule 11 — End Detail' },
                          { label: 'Bolting', value: singleResult.processedRow.bolting, rule: 'Rule 12 — Bolting' },
                        ].map((item, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700/50 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 w-24">{item.label}</span>
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.value || '-'}</span>
                            </div>
                            <span className="text-xs text-green-600 dark:text-green-400 mt-1 sm:mt-0 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded">{item.rule}</span>
                          </div>
                        ))}
                        {singleResult.flags && singleResult.flags.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Flags Generated</h4>
                            <ul className="space-y-2">
                              {singleResult.flags.map((flag: any, idx: number) => (
                                <li key={idx} className={`text-xs px-2 py-1 rounded ${flag.type === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                  {flag.field}: {flag.message}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                        Run the engine to see results
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fuzzy' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={fuzzyInput}
                  onChange={(e) => setFuzzyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFuzzyTest()}
                  className="flex-grow rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-green-500 focus:border-green-500" 
                  placeholder="Paste valve description here..." 
                />
                <button 
                  onClick={handleFuzzyTest}
                  disabled={isFuzzyLoading || !fuzzyInput.trim()}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isFuzzyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 
                  {isFuzzyLoading ? 'Testing...' : 'Test Fuzzy Match'}
                </button>
              </div>
              
              {fuzzyError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {fuzzyError}
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Top Catalogue Matches</h3>
                {fuzzyResult ? (
                  fuzzyResult.length > 0 ? (
                    fuzzyResult.map((match, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border ${match.pass ? 'bg-green-50 dark:bg-green-500/5 border-green-200 dark:border-green-500/30' : 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/30'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {match.pass ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                            <span className={`font-bold ${match.pass ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>Score: {match.score} / 140</span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${match.pass ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                            {match.pass ? 'PASS' : 'FAIL (< 70)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                          <div><span className="text-slate-500 dark:text-slate-400 block text-xs">Type (+50)</span><span className="font-medium text-slate-900 dark:text-white">{match.type}</span></div>
                          <div><span className="text-slate-500 dark:text-slate-400 block text-xs">Size (+30)</span><span className="font-medium text-slate-900 dark:text-white">{match.size}</span></div>
                          <div><span className="text-slate-500 dark:text-slate-400 block text-xs">Class (+30)</span><span className="font-medium text-slate-900 dark:text-white">{match.class}</span></div>
                          <div><span className="text-slate-500 dark:text-slate-400 block text-xs">MOC (+10)</span><span className="font-medium text-slate-900 dark:text-white">{match.moc}</span></div>
                          <div><span className="text-slate-500 dark:text-slate-400 block text-xs">Trim (+10)</span><span className="font-medium text-slate-900 dark:text-white">{match.trim}</span></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 dark:text-slate-400">No matches found.</div>
                  )
                ) : (
                  <div className="text-slate-500 dark:text-slate-400">Enter a description and run the test to see matches.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={traceInput}
                  onChange={(e) => setTraceInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTraceTest()}
                  className="flex-grow rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-green-500 focus:border-green-500" 
                  placeholder="Paste valve description here..." 
                />
                <button 
                  onClick={handleTraceTest}
                  disabled={isTraceLoading || !traceInput.trim()}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isTraceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} 
                  {isTraceLoading ? 'Generating...' : 'Generate Trace'}
                </button>
              </div>
              
              {traceError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {traceError}
                </div>
              )}

              <div className="bg-slate-900 rounded-xl p-6 font-mono text-sm text-green-400 space-y-2 overflow-x-auto min-h-[200px]">
                {traceResult ? (
                  traceResult.map((step, idx) => (
                    <div key={idx} className={step.startsWith('>') ? '' : 'text-slate-400 mt-4'}>
                      {step}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">Enter a description and generate a trace to see the engine's step-by-step logic.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/50">
                <FileSpreadsheet className="w-10 h-10 text-green-500 mb-4" />
                <p className="text-slate-600 dark:text-slate-400 mb-4">Upload a small test RFQ (5-10 rows) to compare engine output against expected output.</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleBatchFileChange} 
                  className="hidden" 
                  accept=".xlsx,.xls"
                />
                <div className="flex gap-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    Select Test File
                  </button>
                  <button 
                    onClick={handleBatchTest}
                    disabled={!batchFile || isBatchLoading}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isBatchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run Batch Test
                  </button>
                </div>
                {batchFile && (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                    Selected: {batchFile.name}
                  </p>
                )}
                {batchError && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400">
                    {batchError}
                  </div>
                )}
              </div>
              
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Batch Test Results</h3>
                  {batchResult && (
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Processed {batchResult.processed} / {batchResult.total_rows} rows
                    </span>
                  )}
                </div>
                <div className="p-4">
                  {batchResult ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Rows</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">{batchResult.total_rows}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Processed</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{batchResult.processed}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Not Mfg</div>
                          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{batchResult.not_manufactured}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Flags</div>
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{batchResult.flags.length}</div>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                              <th className="px-4 py-3">Valve Type</th>
                              <th className="px-4 py-3">Size</th>
                              <th className="px-4 py-3">Class</th>
                              <th className="px-4 py-3">MOC</th>
                              <th className="px-4 py-3">Trim</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchResult.processed_rows.slice(0, 5).map((row: any, idx: number) => (
                              <tr key={idx} className="border-b border-slate-200 dark:border-slate-700">
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.valveType}</td>
                                <td className="px-4 py-3">{row.size}</td>
                                <td className="px-4 py-3">{row.class}</td>
                                <td className="px-4 py-3">{row.moc}</td>
                                <td className="px-4 py-3">{row.trim}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {batchResult.processed_rows.length > 5 && (
                          <div className="text-center py-3 text-sm text-slate-500 dark:text-slate-400">
                            Showing first 5 rows of {batchResult.processed_rows.length}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 dark:text-slate-400 py-12">
                      Upload a file to see cell-by-cell comparison.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
