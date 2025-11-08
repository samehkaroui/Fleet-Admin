import { useState, useEffect } from 'react';
import { supabase, Alert, Vehicle } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle, Filter, Eye, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  useEffect(() => {
    loadAlerts();
    loadVehicles();
    
    // Subscribe to real-time alerts
    const subscription = supabase
      .channel('alerts_channel')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'alerts', filter: `user_id=eq.${user?.id}` },
        (payload) => {
          setAlerts(prev => [payload.new as Alert, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const loadAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const { data } = await supabase
        .from('vehicles')
        .select('*');
      
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const getVehicleName = (vehicleId: string) => {
    return vehicles.find(v => v.id === vehicleId)?.name || 'Unknown Vehicle';
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;
      loadAlerts();
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const markAsAcknowledged = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ 
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id
        })
        .eq('id', alertId);

      if (error) throw error;
      loadAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Delete this alert?')) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      loadAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'high':
        return <AlertCircle className="w-5 h-5 text-orange-400" />;
      case 'medium':
        return <Info className="w-5 h-5 text-yellow-400" />;
      default:
        return <Bell className="w-5 h-5 text-blue-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/10';
      case 'high':
        return 'border-orange-500/50 bg-orange-500/10';
      case 'medium':
        return 'border-yellow-500/50 bg-yellow-500/10';
      default:
        return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'unread' && alert.is_read) return false;
    if (filter === 'critical' && alert.severity !== 'critical') return false;
    if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) return false;
    return true;
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_acknowledged).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Alerts & Notifications</h2>
          <p className="text-slate-400">Monitor all system alerts and warnings</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
              <span className="text-blue-400 font-semibold">{unreadCount}</span>
              <span className="text-slate-400 text-sm ml-1">Unread</span>
            </div>
            {criticalCount > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-pulse">
                <span className="text-red-400 font-semibold">{criticalCount}</span>
                <span className="text-slate-400 text-sm ml-1">Critical</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-400">Filter:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                filter === 'all'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                filter === 'unread'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setFilter('critical')}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                filter === 'critical'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Critical
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Severity:</span>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-12 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">All Clear!</h3>
            <p className="text-slate-400">No alerts to display</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-slate-800/50 backdrop-blur-sm border rounded-xl p-4 transition hover:border-slate-600 ${
                getSeverityColor(alert.severity)
              } ${!alert.is_read ? 'border-l-4' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {getSeverityIcon(alert.severity)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{alert.title}</h3>
                        {!alert.is_read && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                            New
                          </span>
                        )}
                        {alert.is_acknowledged && (
                          <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">
                            Acknowledged
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{alert.message}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          {getVehicleName(alert.vehicle_id)}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </span>
                        {alert.speed && (
                          <span>Speed: {alert.speed.toFixed(1)} km/h</span>
                        )}
                        {alert.location_lat && alert.location_lon && (
                          <span>
                            Location: {alert.location_lat.toFixed(4)}, {alert.location_lon.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!alert.is_read && (
                        <button
                          onClick={() => markAsRead(alert.id)}
                          className="p-2 hover:bg-slate-700/50 rounded-lg transition"
                          title="Mark as read"
                        >
                          <Eye className="w-4 h-4 text-slate-400 hover:text-white" />
                        </button>
                      )}
                      {alert.is_read && !alert.is_acknowledged && alert.severity !== 'low' && (
                        <button
                          onClick={() => markAsAcknowledged(alert.id)}
                          className="p-2 hover:bg-emerald-500/10 rounded-lg transition"
                          title="Acknowledge"
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                    <div className="mt-2 p-2 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-slate-400 font-mono">
                        {JSON.stringify(alert.metadata, null, 2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
