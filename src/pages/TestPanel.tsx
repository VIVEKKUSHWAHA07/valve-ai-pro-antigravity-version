import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Play, Search, Activity, FileSpreadsheet, CheckCircle2, XCircle, Loader2, UploadCloud } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function TestPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
        body: JSON.stringify({ ...singleInput, user_id: user?.id })
      });
      
      const data = await response.json();
      console.log('Engine response raw:', data);
      
      if (!response.ok) throw new Error(data.error || 'Failed to run test');
      
      if (!data || !data.result) {
        console.error('Invalid engine response:', data);
        setSingleError('Engine returned invalid response');
        return;
      }
      
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
        body: JSON.stringify({ desc: fuzzyInput, user_id: user?.id })
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
        body: JSON.stringify({ desc: traceInput, user_id: user?.id })
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
            <Beaker className="w-8 h-8 text-[var(--accent)]" />
            Test Panel
          </h1>
          <p className="text-[var(--text3)] mt-1">Verify engine logic and catalogue matching</p>
        </div>
      </div>

      <div className="v-glow-card flex flex-col p-0 overflow-hidden animate-fade-up delay-100">
        <div className="flex overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)]">
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
                  ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] bg-[var(--bg3)]'
                  : 'text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg3)]'
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
                  <h3 className="text-lg font-semibold text-[var(--text)]">Input Data</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text)] mb-1">Description</label>
                      <input 
                        type="text" 
                        value={singleInput.desc}
                        onChange={(e) => setSingleInput({...singleInput, desc: e.target.value})}
                        className="v-input w-full" 
                        placeholder="e.g. GTV 6&quot; CL600 A105 BWE REDUCED BORE" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)] mb-1">Rating</label>
                        <input 
                          type="text" 
                          value={singleInput.rating}
                          onChange={(e) => setSingleInput({...singleInput, rating: e.target.value})}
                          className="v-input w-full" 
                          placeholder="150#" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)] mb-1">Size</label>
                        <input 
                          type="text" 
                          value={singleInput.size}
                          onChange={(e) => setSingleInput({...singleInput, size: e.target.value})}
                          className="v-input w-full" 
                          placeholder="6&quot;" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)] mb-1">Body/MOC</label>
                        <input 
                          type="text" 
                          value={singleInput.body}
                          onChange={(e) => setSingleInput({...singleInput, body: e.target.value})}
                          className="v-input w-full" 
                          placeholder="A105" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)] mb-1">Trim</label>
                        <input 
                          type="text" 
                          value={singleInput.trim}
                          onChange={(e) => setSingleInput({...singleInput, trim: e.target.value})}
                          className="v-input w-full" 
                          placeholder="TRIM 8" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)] mb-1">End Type</label>
                        <input 
                          type="text" 
                          value={singleInput.endType}
                          onChange={(e) => setSingleInput({...singleInput, endType: e.target.value})}
                          className="v-input w-full" 
                          placeholder="BWE" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)] mb-1">Construction</label>
                        <input 
                          type="text" 
                          value={singleInput.construct}
                          onChange={(e) => setSingleInput({...singleInput, construct: e.target.value})}
                          className="v-input w-full" 
                          placeholder="FLOAT" 
                        />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleSingleTest}
                    disabled={isSingleLoading}
                    className="v-btn-primary w-full flex items-center justify-center gap-2 px-4 py-2.5 font-medium disabled:opacity-50"
                  >
                    {isSingleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 
                    {isSingleLoading ? 'Running...' : 'Run Engine'}
                  </button>
                  {singleError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                      {singleError}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[var(--text)]">Output Results</h3>
                  <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4 space-y-3 min-h-[400px]">
                    {singleResult ? (
                      <>
                        {[
                          { label: 'Valve Type', value: singleResult?.valveType ?? '-', matchInfo: singleResult?.valveType_match_info ?? 'Unknown' },
                          { label: 'Size', value: singleResult?.size ?? '-', matchInfo: singleResult?.size_match_info ?? 'Unknown' },
                          { label: 'Class', value: singleResult?.pressureClass ?? '-', matchInfo: singleResult?.pressureClass_match_info ?? 'Unknown' },
                          { label: 'Standard', value: singleResult?.standard ?? '-', matchInfo: singleResult?.standard_match_info ?? 'Unknown' },
                          { label: 'Model', value: singleResult?.model ?? '-', matchInfo: singleResult?.valveType_match_info ?? 'Unknown' }, // Model uses valveType match info
                          { label: 'MOC', value: singleResult?.moc ?? '-', matchInfo: singleResult?.moc_match_info ?? 'Unknown' },
                          { label: 'Trim', value: singleResult?.trim ?? '-', matchInfo: singleResult?.trim_match_info ?? 'Unknown' },
                          { label: 'Gasket', value: singleResult?.gasket ?? '-', matchInfo: 'Rule 8 — Gasket' },
                          { label: 'Packing', value: singleResult?.packing ?? '-', matchInfo: 'Rule 9 — Packing' },
                          { label: 'Operator', value: singleResult?.operator ?? '-', matchInfo: 'Rule 10 — Operator' },
                          { label: 'End Detail', value: singleResult?.endDetail ?? '-', matchInfo: singleResult?.endType_match_info ?? 'Unknown' },
                          { label: 'Bolting', value: singleResult?.bolting ?? '-', matchInfo: 'Rule 12 — Bolting' },
                        ].map((item, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--text3)] w-24">{item.label}</span>
                              <span className="text-sm font-semibold text-[var(--text)]">{item.value}</span>
                            </div>
                            <span className="text-xs text-[var(--accent)] mt-1 sm:mt-0 bg-[rgba(34,197,94,0.1)] px-2 py-1 rounded">
                              {item.matchInfo}
                            </span>
                          </div>
                        ))}
                        {singleResult.flags && singleResult.flags.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-[var(--border)]">
                            <h4 className="text-sm font-semibold text-[var(--text)] mb-2">Flags Generated</h4>
                            <ul className="space-y-2">
                              {singleResult.flags.map((flag: any, idx: number) => (
                                <li key={idx} className={`text-xs px-2 py-1 rounded ${flag.type === 'critical' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                  {flag.field}: {flag.message}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-[var(--text3)]">
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
                  className="v-input flex-grow" 
                  placeholder="Paste valve description here..." 
                />
                <button 
                  onClick={handleFuzzyTest}
                  disabled={isFuzzyLoading || !fuzzyInput.trim()}
                  className="v-btn-primary flex items-center gap-2 px-6 py-2.5 font-medium disabled:opacity-50"
                >
                  {isFuzzyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 
                  {isFuzzyLoading ? 'Testing...' : 'Test Fuzzy Match'}
                </button>
              </div>
              
              {fuzzyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                  {fuzzyError}
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[var(--text)]">Top Catalogue Matches</h3>
                {fuzzyResult ? (
                  fuzzyResult.length > 0 ? (
                    fuzzyResult.map((match, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border ${match.pass ? 'bg-[rgba(34,197,94,0.05)] border-[rgba(34,197,94,0.3)]' : 'bg-red-500/5 border-red-500/30'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {match.pass ? <CheckCircle2 className="w-5 h-5 text-[var(--accent)]" /> : <XCircle className="w-5 h-5 text-red-500" />}
                            <span className={`font-bold ${match.pass ? 'text-[var(--accent)]' : 'text-red-500'}`}>Score: {match.score} / 140</span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${match.pass ? 'bg-[rgba(34,197,94,0.1)] text-[var(--accent)]' : 'bg-red-500/10 text-red-500'}`}>
                            {match.pass ? 'PASS' : 'FAIL (< 70)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                          <div><span className="text-[var(--text3)] block text-xs">Type (+50)</span><span className="font-medium text-[var(--text)]">{match.type}</span></div>
                          <div><span className="text-[var(--text3)] block text-xs">Size (+30)</span><span className="font-medium text-[var(--text)]">{match.size}</span></div>
                          <div><span className="text-[var(--text3)] block text-xs">Class (+30)</span><span className="font-medium text-[var(--text)]">{match.class}</span></div>
                          <div><span className="text-[var(--text3)] block text-xs">MOC (+10)</span><span className="font-medium text-[var(--text)]">{match.moc}</span></div>
                          <div><span className="text-[var(--text3)] block text-xs">Trim (+10)</span><span className="font-medium text-[var(--text)]">{match.trim}</span></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[var(--text3)]">No matches found.</div>
                  )
                ) : (
                  <div className="text-[var(--text3)]">Enter a description and run the test to see matches.</div>
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
                  className="v-input flex-grow" 
                  placeholder="Paste valve description here..." 
                />
                <button 
                  onClick={handleTraceTest}
                  disabled={isTraceLoading || !traceInput.trim()}
                  className="v-btn-primary flex items-center gap-2 px-6 py-2.5 font-medium disabled:opacity-50"
                >
                  {isTraceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} 
                  {isTraceLoading ? 'Generating...' : 'Generate Trace'}
                </button>
              </div>
              
              {traceError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                  {traceError}
                </div>
              )}

              <div className="bg-[var(--bg3)] rounded-xl p-6 font-mono text-sm text-[var(--accent)] space-y-2 overflow-x-auto min-h-[200px]">
                {traceResult ? (
                  traceResult.map((step, idx) => (
                    <div key={idx} className={step.startsWith('>') ? '' : 'text-[var(--text3)] mt-4'}>
                      {step}
                    </div>
                  ))
                ) : (
                  <div className="text-[var(--text3)]">Enter a description and generate a trace to see the engine's step-by-step logic.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="space-y-6">
              <div className="v-drop-zone p-8 flex flex-col items-center justify-center text-center">
                <FileSpreadsheet className="w-10 h-10 text-[var(--accent)] mb-4" />
                <p className="text-[var(--text3)] mb-4">Upload a small test RFQ (5-10 rows) to compare engine output against expected output.</p>
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
                    className="v-btn-ghost px-6 py-2.5 text-sm font-medium"
                  >
                    Select Test File
                  </button>
                  <button 
                    onClick={handleBatchTest}
                    disabled={!batchFile || isBatchLoading}
                    className="v-btn-primary px-6 py-2.5 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    {isBatchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run Batch Test
                  </button>
                </div>
                {batchFile && (
                  <p className="mt-4 text-sm text-[var(--text3)]">
                    Selected: {batchFile.name}
                  </p>
                )}
                {batchError && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                    {batchError}
                  </div>
                )}
              </div>
              
              <div className="v-glow-card p-0 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[var(--border)] bg-[var(--bg3)] flex justify-between items-center">
                  <h3 className="font-semibold text-[var(--text)]">Batch Test Results</h3>
                  {batchResult && (
                    <span className="text-sm font-medium text-[var(--accent)]">
                      Processed {batchResult.processed} / {batchResult.total_rows} rows
                    </span>
                  )}
                </div>
                <div className="p-4">
                  {batchResult ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="v-stat-card p-4">
                          <div className="text-sm text-[var(--text3)] mb-1">Total Rows</div>
                          <div className="text-2xl font-bold text-[var(--text)]">{batchResult.total_rows}</div>
                        </div>
                        <div className="v-stat-card p-4">
                          <div className="text-sm text-[var(--text3)] mb-1">Processed</div>
                          <div className="text-2xl font-bold text-[var(--accent)]">{batchResult.processed}</div>
                        </div>
                        <div className="v-stat-card p-4">
                          <div className="text-sm text-[var(--text3)] mb-1">Not Mfg</div>
                          <div className="text-2xl font-bold text-yellow-500">{batchResult.not_manufactured}</div>
                        </div>
                        <div className="v-stat-card p-4">
                          <div className="text-sm text-[var(--text3)] mb-1">Flags</div>
                          <div className="text-2xl font-bold text-red-500">{batchResult.flags.length}</div>
                        </div>
                      </div>
                      
                      <div className="v-table overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr>
                              <th>Valve Type</th>
                              <th>Size</th>
                              <th>Class</th>
                              <th>MOC</th>
                              <th>Trim</th>
                            </tr>
                          </thead>
                          <tbody className="text-[var(--text2)]">
                            {batchResult.processed_rows.slice(0, 5).map((row: any, idx: number) => (
                              <tr key={idx}>
                                <td className="font-medium text-[var(--text)]">{row.valveType}</td>
                                <td>{row.size}</td>
                                <td>{row.class}</td>
                                <td>{row.moc}</td>
                                <td>{row.trim}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {batchResult.processed_rows.length > 5 && (
                          <div className="text-center py-3 text-sm text-[var(--text3)]">
                            Showing first 5 rows of {batchResult.processed_rows.length}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-[var(--text3)] py-12">
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
