import { useEffect, useState, useCallback } from 'react';
import { supabase, Vehicle, MaintenanceRecord } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import {
  Truck,
  Wrench,
  MapPin,
  AlertCircle,
  TrendingUp,
  Users,
  Activity,
  Calendar,
  Route
} from 'lucide-react';

type DashboardStats = {
  totalVehicles: number;
  activeVehicles: number;
  maintenanceVehicles: number;
  upcomingMaintenance: number;
  totalDrivers: number;
  totalTrips: number;
  activeTrips: number;
  upcomingTrips: number;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { trips, getActiveTrips, getUpcomingTrips } = useFleet();
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    activeVehicles: 0,
    maintenanceVehicles: 0,
    upcomingMaintenance: 0,
    totalDrivers: 0,
    totalTrips: 0,
    activeTrips: 0,
    upcomingTrips: 0,
  });
  const [recentMaintenance, setRecentMaintenance] = useState<(MaintenanceRecord & { vehicle: Vehicle })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      const [vehiclesRes, maintenanceRes, driversRes] = await Promise.all([
        supabase.from('vehicles').select('*'),
        supabase
          .from('maintenance_records')
          .select('*, vehicle:vehicles(*)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('drivers').select('id'),
      ]);

      const vehicles = vehiclesRes.data || [];
      const maintenance = maintenanceRes.data || [];

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const upcoming = maintenance.filter(m => {
        const scheduledDate = new Date(m.scheduled_date);
        return m.status === 'scheduled' && scheduledDate >= now && scheduledDate <= thirtyDaysFromNow;
      });

      const activeTrips = getActiveTrips();
      const upcomingTrips = getUpcomingTrips();

      setStats({
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter(v => v.status === 'active').length,
        maintenanceVehicles: vehicles.filter(v => v.status === 'maintenance').length,
        upcomingMaintenance: upcoming.length,
        totalDrivers: driversRes.data?.length || 0,
        totalTrips: trips.length,
        activeTrips: activeTrips.length,
        upcomingTrips: upcomingTrips.length,
      });

      setRecentMaintenance(maintenance as (MaintenanceRecord & { vehicle: Vehicle })[]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [trips, getActiveTrips, getUpcomingTrips]);

  useEffect(() => {
    loadDashboardData();

    const vehiclesChannel = supabase
      .channel('vehicles-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'vehicles' },
        () => {
          console.log('Vehicle data changed, reloading...');
          loadDashboardData();
        }
      )
      .subscribe();

    const maintenanceChannel = supabase
      .channel('maintenance-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_records' },
        () => {
          console.log('Maintenance data changed, reloading...');
          loadDashboardData();
        }
      )
      .subscribe();

    const driversChannel = supabase
      .channel('drivers-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => {
          console.log('Driver data changed, reloading...');
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(vehiclesChannel);
      supabase.removeChannel(maintenanceChannel);
      supabase.removeChannel(driversChannel);
    };
  }, [user, loadDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const statCards = [
    {
      icon: Truck,
      label: 'Total Vehicles',
      value: stats.totalVehicles,
      color: 'bg-blue-500/10 text-blue-400',
      iconBg: 'bg-blue-500/20',
    },
    {
      icon: Activity,
      label: 'Active Vehicles',
      value: stats.activeVehicles,
      color: 'bg-emerald-500/10 text-emerald-400',
      iconBg: 'bg-emerald-500/20',
    },
    {
      icon: Route,
      label: 'Total Trips',
      value: stats.totalTrips,
      color: 'bg-indigo-500/10 text-indigo-400',
      iconBg: 'bg-indigo-500/20',
    },
    {
      icon: MapPin,
      label: 'Active Trips',
      value: stats.activeTrips,
      color: 'bg-green-500/10 text-green-400',
      iconBg: 'bg-green-500/20',
    },
    {
      icon: Calendar,
      label: 'Upcoming Trips',
      value: stats.upcomingTrips,
      color: 'bg-cyan-500/10 text-cyan-400',
      iconBg: 'bg-cyan-500/20',
    },
    {
      icon: Wrench,
      label: 'In Maintenance',
      value: stats.maintenanceVehicles,
      color: 'bg-amber-500/10 text-amber-400',
      iconBg: 'bg-amber-500/20',
    },
    {
      icon: Users,
      label: 'Total Drivers',
      value: stats.totalDrivers,
      color: 'bg-purple-500/10 text-purple-400',
      iconBg: 'bg-purple-500/20',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Dashboard</h2>
        <p className="text-sm sm:text-base text-slate-400">Overview of your fleet management system</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 sm:p-4 lg:p-6 hover:border-slate-600 transition"
          >
            <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-0">
              <div className="flex-1 min-w-0">
                <p className="text-slate-400 text-xs sm:text-sm mb-1 truncate">{stat.label}</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
              </div>
              <div className={`${stat.iconBg} p-2 sm:p-3 rounded-lg sm:rounded-xl`}>
                <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ${stat.color.split(' ')[1]}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          <span className="text-base sm:text-xl">Recent Maintenance Records</span>
        </h3>

        {recentMaintenance.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-slate-400">
            <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-sm sm:text-base">No maintenance records yet</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {recentMaintenance.map((record) => (
              <div
                key={record.id}
                className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 sm:p-4 hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <span className="font-semibold text-white text-sm sm:text-base truncate">
                        {record.vehicle?.name || 'Unknown Vehicle'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        record.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        record.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                        record.status === 'scheduled' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {record.status.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-1 bg-slate-700/50 rounded-full text-xs text-slate-300 whitespace-nowrap">
                        {record.type}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs sm:text-sm mb-2 line-clamp-2">{record.description}</p>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span className="hidden sm:inline">{new Date(record.scheduled_date).toLocaleDateString()}</span>
                        <span className="sm:hidden">{new Date(record.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </span>
                      {record.cost && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          ${record.cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
