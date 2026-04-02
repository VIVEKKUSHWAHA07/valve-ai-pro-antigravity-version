import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, Plus, Trash2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface CustomRule {
  id: string;
  rule_name: string;
  conditions: Condition[];
  output_field: string;
  output_value: string;
  priority: number;
  active: boolean;
}

interface TestInput {
  valve_type: string;
  size: string;
  class: string;
  moc: string;
  end_type: string;
  trim: string;
}

export function RulesEditor() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('aliases');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [aliases, setAliases] = useState<any[]>([]);
  const [mocMappings, setMocMappings] = useState<any[]>([]);
  const [trimTable, setTrimTable] = useState<any[]>([]);
  const [operatorThresholds, setOperatorThresholds] = useState<any[]>([]);
  const [notMfg, setNotMfg] = useState<any[]>([]);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [testInput, setTestInput] = useState<TestInput>({ valve_type: '', size: '', class: '', moc: '', end_type: '', trim: '' });
  const [testOutput, setTestOutput] = useState<string[]>([]);

  useEffect(() => {
    loadAllRules();
  }, []);

  const loadAllRules = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDefaults();
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('engine_rules')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error loading rules:', error);
        // Fallback to defaults if table doesn't exist or error
        setDefaults();
        return;
      }

      if (data && data.length > 0) {
        setAliases(data.filter(r => r.rule_type === 'aliases').map(r => ({ id: r.id, ...r.rule_data })));
        setMocMappings(data.filter(r => r.rule_type === 'moc').map(r => ({ id: r.id, ...r.rule_data })));
        setTrimTable(data.filter(r => r.rule_type === 'trim').map(r => ({ id: r.id, ...r.rule_data })));
        setOperatorThresholds(data.filter(r => r.rule_type === 'operator').map(r => ({ id: r.id, ...r.rule_data })));
        setNotMfg(data.filter(r => r.rule_type === 'notmfg').map(r => ({ id: r.id, ...r.rule_data })));
        
        // Find latest updated_at
        const latest = data.reduce((max, r) => r.updated_at > max ? r.updated_at : max, data[0].updated_at);
        if (latest) setLastSaved(new Date(latest));
      } else {
        setDefaults();
      }

      // Load user custom rules
      const { data: customData, error: customError } = await supabase
        .from('user_custom_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: true });

      if (!customError && customData) {
        setCustomRules(customData);
      }
    } catch (err) {
      console.error('Failed to load rules', err);
      setDefaults();
    } finally {
      setLoading(false);
    }
  };

  const setDefaults = () => {
    setAliases([
      { id: '1', abbr: 'GTV', mapsTo: 'Gate Valve', layer: 1 },
      { id: '2', abbr: 'GLV', mapsTo: 'Globe Valve', layer: 1 },
      { id: '3', abbr: 'BV', mapsTo: 'Ball Valve', layer: 1 },
      { id: '4', abbr: 'CHK', mapsTo: 'Check Valve', layer: 1 },
      { id: '5', abbr: 'BFV', mapsTo: 'Butterfly Valve', layer: 1 },
    ]);
    setMocMappings([
      { id: '1', customerWrites: 'F44', resolvedMoc: 'ASTM A182 Gr.F44', type: 'Forged', flagIfSmall: false },
      { id: '2', customerWrites: 'CF8M', resolvedMoc: 'ASTM A351 Gr.CF8M', type: 'Cast', flagIfSmall: true },
      { id: '3', customerWrites: 'F316', resolvedMoc: 'ASTM A182 Gr.F316', type: 'Forged', flagIfSmall: false },
      { id: '4', customerWrites: 'WCB', resolvedMoc: 'ASTM A216 Gr.WCB', type: 'Cast', flagIfSmall: true },
    ]);
    setTrimTable([
      { id: '1', code: 'TRIM 8', wo: 'F6 / F6 - T1', ss: 'F6 & Hardfaced - T8', ssw: 'Hardfaced (410) - T5' },
      { id: '2', code: 'TRIM 12', wo: '316 - T10', ss: '316 and Hardfaced - T12', ssw: 'Hardfaced (316) - T16' },
      { id: '3', code: 'F51', wo: 'F51 - T79', ss: 'F51 and Hardfaced - T81', ssw: 'Hardfaced (F51) - T82' },
    ]);
    setOperatorThresholds([
      { id: '1', category: 'Gate / Globe', class: '150', threshold: '12"', below: 'Hand Wheel' },
      { id: '2', category: 'Gate / Globe', class: '300', threshold: '12"', below: 'Hand Wheel' },
      { id: '3', category: 'Ball Valve', class: '150', threshold: '6"', below: 'Lever' },
      { id: '4', category: 'Ball Valve', class: '600', threshold: '4"', below: 'Lever' },
    ]);
    setNotMfg([
      { id: '1', key: 'BUTTERFLY', label: 'Butterfly Valve', active: true },
      { id: '2', key: 'PLUG', label: 'Plug Valve', active: true },
      { id: '3', key: 'STRAINER', label: 'Strainer', active: true },
      { id: '4', key: 'DBB', label: 'Double Block & Bleed', active: true },
    ]);
  };

  const saveCustomRules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      for (const rule of customRules) {
        // Validate — skip rules with empty conditions or output
        if (!rule.output_field || !rule.output_value) continue;
        if (rule.conditions.some(c => !c.field || !c.value)) continue;

        const { error } = await supabase
          .from('user_custom_rules')
          .upsert({
            id: rule.id,
            user_id: user.id,
            rule_name: rule.rule_name,
            conditions: rule.conditions,
            output_field: rule.output_field,
            output_value: rule.output_value,
            priority: rule.priority,
            active: rule.active,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (error) throw error;
      }

      alert('Custom rules saved successfully');
    } catch (err: any) {
      alert(`Failed to save custom rules: ${err.message}`);
    }
  };

  const deleteCustomRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_custom_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCustomRules(customRules.filter(r => r.id !== id));
    } catch (err: any) {
      alert(`Failed to delete rule: ${err.message}`);
    }
  };

  const addCustomRule = () => {
    const newRule: CustomRule = {
      id: crypto.randomUUID(),
      rule_name: 'New Rule',
      conditions: [{ field: 'valve_type', operator: 'equals', value: '' }],
      output_field: 'operator',
      output_value: '',
      priority: customRules.length + 1,
      active: true,
    };
    setCustomRules([...customRules, newRule]);
  };

  const runTest = () => {
    const results: string[] = [];
    const input: Record<string, string> = { ...testInput };

    const activeRules = customRules
      .filter(r => r.active)
      .sort((a, b) => a.priority - b.priority);

    if (activeRules.length === 0) {
      setTestOutput(['No active custom rules to test.']);
      return;
    }

    for (const rule of activeRules) {
      const allMet = rule.conditions.every(cond => {
        const actual = input[cond.field] || '';
        switch (cond.operator) {
          case 'equals':     return actual.toLowerCase() === cond.value.toLowerCase();
          case 'not_equals': return actual.toLowerCase() !== cond.value.toLowerCase();
          case '>=':         return parseFloat(actual) >= parseFloat(cond.value);
          case '<=':         return parseFloat(actual) <= parseFloat(cond.value);
          case 'contains':   return actual.toLowerCase().includes(cond.value.toLowerCase());
          default:           return false;
        }
      });

      if (allMet) {
        results.push(`✅ Rule "${rule.rule_name}" MATCHED → ${rule.output_field} = "${rule.output_value}"`);
        input[rule.output_field] = rule.output_value; // apply it
      } else {
        results.push(`❌ Rule "${rule.rule_name}" did not match`);
      }
    }

    if (results.length === 0) {
      results.push('No rules matched the test input.');
    }

    setTestOutput(results);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Filter out blank rows before saving
      const validAliases = aliases.filter(r => r.abbr.trim() !== '');
      const validMoc = mocMappings.filter(r => r.customerWrites.trim() !== '');
      const validTrim = trimTable.filter(r => r.code.trim() !== '');
      const validOperator = operatorThresholds.filter(r => r.category.trim() !== '');
      const validNotMfg = notMfg.filter(r => r.key.trim() !== '');

      // Prepare all rules for upsert
      const allRules = [
        ...validAliases.map(r => ({ user_id: user.id, rule_type: 'aliases', rule_key: r.abbr, rule_data: { abbr: r.abbr, mapsTo: r.mapsTo, layer: r.layer } })),
        ...validMoc.map(r => ({ user_id: user.id, rule_type: 'moc', rule_key: r.customerWrites, rule_data: { customerWrites: r.customerWrites, resolvedMoc: r.resolvedMoc, type: r.type, flagIfSmall: r.flagIfSmall } })),
        ...validTrim.map(r => ({ user_id: user.id, rule_type: 'trim', rule_key: r.code, rule_data: { code: r.code, wo: r.wo, ss: r.ss, ssw: r.ssw } })),
        ...validOperator.map(r => ({ user_id: user.id, rule_type: 'operator', rule_key: `${r.category}-${r.class}`, rule_data: { category: r.category, class: r.class, threshold: r.threshold, below: r.below } })),
        ...validNotMfg.map(r => ({ user_id: user.id, rule_type: 'notmfg', rule_key: r.key, rule_data: { key: r.key, label: r.label, active: r.active } })),
      ];

      // Upsert to Supabase using the unique constraint
      const { error } = await supabase.from('engine_rules').upsert(allRules, { onConflict: 'rule_type, rule_key, user_id' });
      
      if (error) throw error;
      
      setLastSaved(new Date());
    } catch (err) {
      console.error('Error saving rules:', err);
      alert('Failed to save rules to database. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, type: string) => {
    try {
      const { error } = await supabase.from('engine_rules').delete().eq('id', id);
      if (error) throw error;
      
      // Update local state
      if (type === 'aliases') setAliases(aliases.filter(r => r.id !== id));
      if (type === 'moc') setMocMappings(mocMappings.filter(r => r.id !== id));
      if (type === 'trim') setTrimTable(trimTable.filter(r => r.id !== id));
      if (type === 'operator') setOperatorThresholds(operatorThresholds.filter(r => r.id !== id));
      if (type === 'notmfg') setNotMfg(notMfg.filter(r => r.id !== id));
      
    } catch (err) {
      console.error('Error deleting rule:', err);
    }
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addRow = (type: string) => {
    const newId = generateId();
    if (type === 'aliases') setAliases([...aliases, { id: newId, abbr: '', mapsTo: '', layer: 1 }]);
    if (type === 'moc') setMocMappings([...mocMappings, { id: newId, customerWrites: '', resolvedMoc: '', type: 'Forged', flagIfSmall: false }]);
    if (type === 'trim') setTrimTable([...trimTable, { id: newId, code: '', wo: '', ss: '', ssw: '' }]);
    if (type === 'operator') setOperatorThresholds([...operatorThresholds, { id: newId, category: '', class: '', threshold: '', below: '' }]);
    if (type === 'notmfg') setNotMfg([...notMfg, { id: newId, key: '', label: '', active: true }]);
  };

  const updateRow = (type: string, id: string, field: string, value: any) => {
    if (type === 'aliases') setAliases(aliases.map(r => r.id === id ? { ...r, [field]: value } : r));
    if (type === 'moc') setMocMappings(mocMappings.map(r => r.id === id ? { ...r, [field]: value } : r));
    if (type === 'trim') setTrimTable(trimTable.map(r => r.id === id ? { ...r, [field]: value } : r));
    if (type === 'operator') setOperatorThresholds(operatorThresholds.map(r => r.id === id ? { ...r, [field]: value } : r));
    if (type === 'notmfg') setNotMfg(notMfg.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>;
  }

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
            <Settings className="w-8 h-8 text-purple-500" />
            Rules Editor
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Manage engine logic and mappings</p>
        </div>
        <div className="flex items-center gap-4">
          {lastSaved && (
            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Last saved: {lastSaved.toLocaleTimeString()}
            </div>
          )}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? <AlertCircle className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {[
            { id: 'aliases', label: 'Valve Type Aliases' },
            { id: 'moc', label: 'MOC Mapping' },
            { id: 'trim', label: 'Trim Table' },
            { id: 'operator', label: 'Operator Thresholds' },
            { id: 'notmfg', label: 'Not-Manufactured' },
            { id: 'custom', label: 'Custom Rules' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'aliases' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => addRow('aliases')} className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                  <Plus className="w-4 h-4" /> Add Alias
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Abbreviation</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Maps To</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Layer</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {aliases.map((alias) => (
                      <tr key={alias.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3"><input type="text" value={alias.abbr} onChange={(e) => updateRow('aliases', alias.id, 'abbr', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="text" value={alias.mapsTo} onChange={(e) => updateRow('aliases', alias.id, 'mapsTo', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="number" value={alias.layer} onChange={(e) => updateRow('aliases', alias.id, 'layer', parseInt(e.target.value))} className="w-16 bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(alias.id, 'aliases')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'moc' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => addRow('moc')} className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                  <Plus className="w-4 h-4" /> Add MOC Mapping
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Customer Writes</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Resolved MOC</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Type</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Flag if &lt;2"</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {mocMappings.map((moc) => (
                      <tr key={moc.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3"><input type="text" value={moc.customerWrites} onChange={(e) => updateRow('moc', moc.id, 'customerWrites', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="text" value={moc.resolvedMoc} onChange={(e) => updateRow('moc', moc.id, 'resolvedMoc', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3">
                          <select value={moc.type} onChange={(e) => updateRow('moc', moc.id, 'type', e.target.value)} className="bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white dark:bg-slate-800">
                            <option value="Forged">Forged</option>
                            <option value="Cast">Cast</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={moc.flagIfSmall} onChange={(e) => updateRow('moc', moc.id, 'flagIfSmall', e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(moc.id, 'moc')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'trim' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => addRow('trim')} className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                  <Plus className="w-4 h-4" /> Add Trim Row
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Trim Code / Material</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Without Stellite (col_wo)</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">With Stellite on Seat (col_ss)</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Stellite on Seat+Wedge (col_ssw)</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {trimTable.map((trim) => (
                      <tr key={trim.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3"><input type="text" value={trim.code} onChange={(e) => updateRow('trim', trim.id, 'code', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="text" value={trim.wo} onChange={(e) => updateRow('trim', trim.id, 'wo', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="text" value={trim.ss} onChange={(e) => updateRow('trim', trim.id, 'ss', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="text" value={trim.ssw} onChange={(e) => updateRow('trim', trim.id, 'ssw', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(trim.id, 'trim')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'operator' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => addRow('operator')} className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                  <Plus className="w-4 h-4" /> Add Threshold
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Valve Category</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Class</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Gear Threshold (inches)</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Below Threshold</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {operatorThresholds.map((op) => (
                      <tr key={op.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3"><input type="text" value={op.category} onChange={(e) => updateRow('operator', op.id, 'category', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="text" value={op.class} onChange={(e) => updateRow('operator', op.id, 'class', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="text" value={op.threshold} onChange={(e) => updateRow('operator', op.id, 'threshold', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="text" value={op.below} onChange={(e) => updateRow('operator', op.id, 'below', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(op.id, 'operator')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'notmfg' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => addRow('notmfg')} className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                  <Plus className="w-4 h-4" /> Add Not-Manufactured Type
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Type Key</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Display Label</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Active</th>
                      <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {notMfg.map((type) => (
                      <tr key={type.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3"><input type="text" value={type.key} onChange={(e) => updateRow('notmfg', type.id, 'key', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3"><input type="text" value={type.label} onChange={(e) => updateRow('notmfg', type.id, 'label', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white" /></td>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={type.active} onChange={(e) => updateRow('notmfg', type.id, 'active', e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(type.id, 'notmfg')} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-6">

              {/* Header */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Rules are applied in priority order. They override default engine output for matching rows only.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={addCustomRule}
                    className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700"
                  >
                    <Plus className="w-4 h-4" /> Add Rule
                  </button>
                  <button
                    onClick={saveCustomRules}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <Save className="w-4 h-4" /> Save All Rules
                  </button>
                </div>
              </div>

              {/* Rule Cards */}
              {customRules.length === 0 && (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  No custom rules yet. Click "Add Rule" to create your first rule.
                </div>
              )}

              {customRules.map((rule, ruleIdx) => (
                <div key={rule.id} className={`border rounded-xl p-5 space-y-4 ${rule.active ? 'border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}>

                  {/* Rule header */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="text"
                      value={rule.rule_name}
                      onChange={e => setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, rule_name: e.target.value } : r))}
                      className="flex-1 font-semibold text-slate-900 dark:text-white bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none focus:border-purple-500 text-sm py-1"
                      placeholder="Rule name..."
                    />
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      Priority:
                      <input
                        type="number"
                        value={rule.priority}
                        onChange={e => setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, priority: parseInt(e.target.value) || 1 } : r))}
                        className="w-12 text-center bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5 text-xs"
                      />
                    </div>
                    <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.active}
                        onChange={e => setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, active: e.target.checked } : r))}
                        className="rounded"
                      />
                      Active
                    </label>
                    <button onClick={() => deleteCustomRule(rule.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* IF Conditions */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">IF</div>
                    {rule.conditions.map((cond, condIdx) => (
                      <div key={condIdx} className="flex items-center gap-2 flex-wrap">
                        {condIdx > 0 && <span className="text-xs font-bold text-purple-500 w-8">AND</span>}
                        {condIdx === 0 && <span className="w-8" />}

                        <select
                          value={cond.field}
                          onChange={e => {
                            const updated = rule.conditions.map((c, ci) => ci === condIdx ? { ...c, field: e.target.value } : c);
                            setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, conditions: updated } : r));
                          }}
                          className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
                        >
                          <option value="valve_type">Valve Type</option>
                          <option value="size">Size (inches)</option>
                          <option value="class">Class</option>
                          <option value="moc">MOC</option>
                          <option value="end_type">End Type</option>
                          <option value="trim">Trim</option>
                        </select>

                        <select
                          value={cond.operator}
                          onChange={e => {
                            const updated = rule.conditions.map((c, ci) => ci === condIdx ? { ...c, operator: e.target.value } : c);
                            setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, conditions: updated } : r));
                          }}
                          className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                          <option value=">=">≥ (greater or equal)</option>
                          <option value="<=">≤ (less or equal)</option>
                          <option value="contains">contains</option>
                        </select>

                        <input
                          type="text"
                          value={cond.value}
                          onChange={e => {
                            const updated = rule.conditions.map((c, ci) => ci === condIdx ? { ...c, value: e.target.value } : c);
                            setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, conditions: updated } : r));
                          }}
                          placeholder="value..."
                          className="flex-1 min-w-[100px] bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-purple-500"
                        />

                        <button
                          onClick={() => {
                            const updated = rule.conditions.filter((_, ci) => ci !== condIdx);
                            setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, conditions: updated } : r));
                          }}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const updated = [...rule.conditions, { field: 'valve_type', operator: 'equals', value: '' }];
                        setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, conditions: updated } : r));
                      }}
                      className="text-xs text-purple-500 hover:text-purple-600 flex items-center gap-1 ml-8 mt-1"
                    >
                      <Plus className="w-3 h-3" /> Add Condition
                    </button>
                  </div>

                  {/* THEN Output */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">THEN</div>
                    <div className="flex items-center gap-2 flex-wrap ml-8">
                      <select
                        value={rule.output_field}
                        onChange={e => setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, output_field: e.target.value } : r))}
                        className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <option value="operator">Operator</option>
                        <option value="model">Model</option>
                        <option value="standard">Standard</option>
                        <option value="trim">Trim</option>
                        <option value="gasket">Gasket</option>
                        <option value="packing">Packing</option>
                        <option value="bolting">Bolting</option>
                      </select>
                      <span className="text-sm text-slate-400">=</span>
                      <input
                        type="text"
                        value={rule.output_value}
                        onChange={e => setCustomRules(customRules.map((r, i) => i === ruleIdx ? { ...r, output_value: e.target.value } : r))}
                        placeholder="output value..."
                        className="flex-1 min-w-[150px] bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                </div>
              ))}

              {/* ── TEST PANEL ── */}
              <div className="mt-8 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  🧪 Test Custom Rules
                </h3>
                <p className="text-xs text-slate-500">Fill in the fields below and click Run Test to see which rules match.</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {['valve_type', 'size', 'class', 'moc', 'end_type', 'trim'].map(field => (
                    <div key={field}>
                      <label className="text-xs text-slate-500 capitalize mb-1 block">{field.replace('_', ' ')}</label>
                      <input
                        type="text"
                        value={testInput[field as keyof TestInput]}
                        onChange={e => setTestInput({ ...testInput, [field]: e.target.value })}
                        placeholder={field === 'valve_type' ? 'e.g. Gate Valve' : field === 'size' ? 'e.g. 6' : field === 'class' ? 'e.g. 150' : ''}
                        className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={runTest}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
                >
                  ▶ Run Test
                </button>

                {testOutput.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {testOutput.map((line, i) => (
                      <div key={i} className={`text-sm px-4 py-2 rounded-lg font-mono ${line.startsWith('✅') ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

