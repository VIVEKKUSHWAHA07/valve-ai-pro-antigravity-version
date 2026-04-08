import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Settings, Beaker, Activity, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const { user, accessPending, accessDenied } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [statsData, setStatsData] = useState({
    totalProcessed: 0,
    rowsAutoFilled: 0,
    flagsRaised: 0,
    notManufactured: 0,
    catalogueSize: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;
      
      try {
        setIsLoading(true);
        // Fetch recent activity
        const { data: history, error } = await supabase
          .from('processing_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch catalogue size
        const { count: catalogueCount } = await supabase
          .from('product_catalogue')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching history:', error);
        } else if (history) {
          setRecentActivity(history);
          
          let totalProcessed = 0;
          let flagsRaised = 0;
          let notManufactured = 0;
          
          history.forEach(job => {
            totalProcessed += job.total_rows || 0;
            flagsRaised += job.flags_count || 0;
            notManufactured += job.not_manufactured_count || 0;
          });
          
          setStatsData({
            totalProcessed,
            rowsAutoFilled: totalProcessed - flagsRaised - notManufactured,
            flagsRaised,
            notManufactured,
            catalogueSize: catalogueCount || 0
          });
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, [user]);

  const matchRate = statsData.totalProcessed > 0 
    ? Math.round((statsData.rowsAutoFilled / statsData.totalProcessed) * 100) 
    : 0;

  const stats = [
    { label: 'Total RFQs Processed', value: statsData.totalProcessed.toLocaleString(), icon: <FileSpreadsheet className="w-5 h-5 text-blue-500" /> },
    { label: 'Rows Auto-filled', value: statsData.rowsAutoFilled.toLocaleString(), icon: <CheckCircle2 className="w-5 h-5 text-[var(--accent)]" /> },
    { label: 'Flags Raised', value: statsData.flagsRaised.toLocaleString(), icon: <AlertTriangle className="w-5 h-5 text-yellow-500" /> },
    { label: 'Not-Manufactured', value: statsData.notManufactured.toLocaleString(), icon: <XCircle className="w-5 h-5 text-red-500" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto mt-8 px-4 sm:px-6 space-y-8 pb-20">
      {/* Access Restricted Banner */}
      {(accessPending || accessDenied) && (
        <div className="v-status-strip p-4 border-yellow-500/30 bg-yellow-500/10">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                Access Restricted
              </h3>
              <p className="mt-1 text-sm text-yellow-600/80 dark:text-yellow-400/80">
                Your account is currently pending approval or lacks an active subscription. 
                Some features may be limited until an administrator approves your access.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Greeting */}
      <div className="animate-fade-up">
        <h1 className="text-3xl font-display font-bold text-[var(--text)]">
          Welcome back, <span className="text-[var(--accent)]">{user?.user_metadata?.full_name?.split(' ')[0] || 'Engineer'}</span>
        </h1>
        <p className="text-[var(--text3)] mt-2">Here's what's happening with your valve engineering workflows today.</p>
        
        <div className="flex flex-wrap gap-6 mt-6">
          <div className="flex items-center gap-3">
            <div className="text-4xl font-display font-bold text-[var(--text)]">{isLoading ? '-' : recentActivity.length}</div>
            <div className="text-sm text-[var(--text3)] leading-tight">RFQs<br/>Processed</div>
          </div>
          <div className="w-px h-10 bg-[var(--border)]"></div>
          <div className="flex items-center gap-3">
            <div className="text-4xl font-display font-bold text-[var(--accent)]">{isLoading ? '-' : `${matchRate}%`}</div>
            <div className="text-sm text-[var(--text3)] leading-tight">Average<br/>Match Rate</div>
          </div>
          <div className="w-px h-10 bg-[var(--border)]"></div>
          <div className="flex items-center gap-3">
            <div className="text-4xl font-display font-bold text-blue-500">{isLoading ? '-' : statsData.catalogueSize}</div>
            <div className="text-sm text-[var(--text3)] leading-tight">Catalogue<br/>Items</div>
          </div>
        </div>
      </div>

      <div className="v-divider animate-fade-up delay-100">Quick Actions</div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up delay-100">
        <Link to="/upload" className="v-glow-card-wrapper group">
          <div className="v-glow-card flex items-center gap-4 h-full">
            <div className="p-3 rounded-lg bg-[var(--bg3)] text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-[var(--text)]">Upload RFQ</div>
              <div className="text-sm text-[var(--text3)]">Process new Excel file</div>
            </div>
          </div>
        </Link>
        
        <Link to="/rules" className="v-glow-card-wrapper group">
          <div className="v-glow-card flex items-center gap-4 h-full">
            <div className="p-3 rounded-lg bg-[var(--bg3)] text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-[var(--text)]">View Rules</div>
              <div className="text-sm text-[var(--text3)]">Manage engine logic</div>
            </div>
          </div>
        </Link>
        
        <Link to="/test" className="v-glow-card-wrapper group">
          <div className="v-glow-card flex items-center gap-4 h-full">
            <div className="p-3 rounded-lg bg-[var(--bg3)] text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              <Beaker className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-[var(--text)]">Run Test</div>
              <div className="text-sm text-[var(--text3)]">Test engine accuracy</div>
            </div>
          </div>
        </Link>
      </div>

      <div className="v-divider animate-fade-up delay-200">Processing Stats</div>

      {/* Stats Cards (Bento grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up delay-200">
        {stats.map((stat, idx) => (
          <div key={idx} className="v-stat-card flex flex-col items-center justify-center py-6">
            <div className="mb-3">{stat.icon}</div>
            <div className="v-stat-number text-3xl text-[var(--text)] mb-1">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-[var(--text3)] mx-auto" /> : stat.value}
            </div>
            <div className="text-xs text-[var(--text3)] uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="v-divider animate-fade-up delay-300">Recent Activity</div>

      {/* Recent Activity */}
      <div className="v-glow-card p-0 overflow-hidden flex flex-col animate-fade-up delay-300">
        <div className="p-5 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg3)]">
          <Activity className="w-5 h-5 text-[var(--text3)]" />
          <h3 className="text-sm font-display font-bold text-[var(--text)] uppercase tracking-wider">Processing History</h3>
        </div>
        <div className="v-table overflow-x-auto border-none rounded-none">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Date</th>
                <th>Rows</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text2)]">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--text3)]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading activity...
                  </td>
                </tr>
              ) : recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--text3)]">
                    No recent activity found. Upload an RFQ to get started.
                  </td>
                </tr>
              ) : (
                recentActivity.map((activity) => (
                  <tr key={activity.id}>
                    <td className="font-medium text-[var(--text)] flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[var(--text3)]" />
                      {activity.filename}
                    </td>
                    <td>{new Date(activity.created_at).toLocaleDateString()}</td>
                    <td>{activity.total_rows}</td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                        activity.status === 'Completed' 
                          ? 'bg-[rgba(34,197,94,0.1)] text-[var(--accent)]' 
                          : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {activity.status || 'Completed'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
