import { useState, useEffect } from 'react';
import { supabase, FuelLog, Vehicle, VehicleSettings } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Fuel, Plus, TrendingUp, TrendingDown, DollarSign, Droplet, Calendar, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function FuelMonitoring() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [, setVehicleSettings] = useState<VehicleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [formData, setFormData] = useState({
    fuel_volume_liters: 0,
    cost_per_liter: 0,
    odometer_reading: 0,
    notes: '',
  });

  useEffect(() => {
    loadVehicles();
  }, [user]);

  useEffect(() => {
    if (selectedVehicle) {
      loadFuelLogs(selectedVehicle.id);
      loadVehicleSettings(selectedVehicle.id);
    }
    
    // Real-time subscription for fuel logs
    if (!selectedVehicle) return;
    
    const fuelLogsSubscription = supabase
      .channel('fuel_logs_realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'fuel_logs', filter: `vehicle_id=eq.${selectedVehicle.id}` },
        (payload) => {
          console.log('Fuel log update received:', payload);
          loadFuelLogs(selectedVehicle.id);
        }
      )
      .subscribe();
    
    return () => {
      fuelLogsSubscription.unsubscribe();
    };
  }, [selectedVehicle]);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setVehicles(data || []);
      if (data && data.length > 0) {
        setSelectedVehicle(data[0]);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFuelLogs = async (vehicleId: string) => {
    try {
      const { data, error } = await supabase
        .from('fuel_logs')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('recorded_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setFuelLogs(data || []);
    } catch (error) {
      console.error('Error loading fuel logs:', error);
    }
  };

  const loadVehicleSettings = async (vehicleId: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_settings')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setVehicleSettings(data);
    } catch (error) {
      console.error('Error loading vehicle settings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    try {
      const totalCost = formData.fuel_volume_liters * formData.cost_per_liter;
      
      const { error } = await supabase
        .from('fuel_logs')
        .insert([{
          vehicle_id: selectedVehicle.id,
          fuel_volume_liters: formData.fuel_volume_liters,
          cost_per_liter: formData.cost_per_liter,
          total_cost: totalCost,
          odometer_reading: formData.odometer_reading,
          source: 'manual',
          notes: formData.notes,
          recorded_at: new Date().toISOString(),
        }]);

      if (error) throw error;

      loadFuelLogs(selectedVehicle.id);
      setShowAddForm(false);
      setFormData({
        fuel_volume_liters: 0,
        cost_per_liter: 0,
        odometer_reading: 0,
        notes: '',
      });
    } catch (error) {
      console.error('Error adding fuel log:', error);
      alert('Failed to add fuel log');
    }
  };

  const calculateStats = () => {
    if (fuelLogs.length === 0) return null;

    const totalFuel = fuelLogs.reduce((sum, log) => sum + (log.fuel_volume_liters || 0), 0);
    const totalCost = fuelLogs.reduce((sum, log) => sum + (log.total_cost || 0), 0);
    const avgCostPerLiter = totalCost / totalFuel;

    const logsWithOdometer = fuelLogs.filter(log => log.odometer_reading && log.fuel_volume_liters);
    let avgConsumption = 0;
    
    if (logsWithOdometer.length >= 2) {
      const sorted = [...logsWithOdometer].sort((a, b) => 
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      );
      
      let totalDistance = 0;
      let totalFuelForDistance = 0;
      
      for (let i = 1; i < sorted.length; i++) {
        const distance = (sorted[i].odometer_reading || 0) - (sorted[i - 1].odometer_reading || 0);
        if (distance > 0) {
          totalDistance += distance;
          totalFuelForDistance += sorted[i].fuel_volume_liters || 0;
        }
      }
      
      if (totalDistance > 0) {
        avgConsumption = (totalFuelForDistance / totalDistance) * 100;
      }
    }

    return {
      totalFuel: totalFuel.toFixed(2),
      totalCost: totalCost.toFixed(2),
      avgCostPerLiter: avgCostPerLiter.toFixed(2),
      avgConsumption: avgConsumption.toFixed(2),
      logCount: fuelLogs.length,
    };
  };

  const getChartData = () => {
    return fuelLogs
      .slice(0, 10)
      .reverse()
      .map(log => ({
        date: new Date(log.recorded_at).toLocaleDateString(),
        liters: log.fuel_volume_liters || 0,
        cost: log.total_cost || 0,
      }));
  };

  const stats = calculateStats();

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
          <h2 className="text-2xl font-bold text-white mb-2">Fuel Monitoring</h2>
          <p className="text-slate-400">Track fuel consumption and costs</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Fuel Log
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-12 text-center">
          <Fuel className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No vehicles available</h3>
          <p className="text-slate-400">Add vehicles to start tracking fuel</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {vehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                onClick={() => setSelectedVehicle(vehicle)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                  selectedVehicle?.id === vehicle.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {vehicle.name}
              </button>
            ))}
          </div>

          {showAddForm && selectedVehicle && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Add Fuel Log for {selectedVehicle.name}</h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Fuel Volume (Liters)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fuel_volume_liters}
                    onChange={(e) => setFormData({ ...formData, fuel_volume_liters: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Cost per Liter
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_per_liter}
                    onChange={(e) => setFormData({ ...formData, cost_per_liter: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Odometer Reading (km)
                  </label>
                  <input
                    type="number"
                    value={formData.odometer_reading}
                    onChange={(e) => setFormData({ ...formData, odometer_reading: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-2 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-medium"
                  >
                    Add Log
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <Droplet className="w-8 h-8 text-blue-400" />
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalFuel} L</p>
                <p className="text-sm text-slate-400">Total Fuel</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-8 h-8 text-emerald-400" />
                  <TrendingDown className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-white">${stats.totalCost}</p>
                <p className="text-sm text-slate-400">Total Cost</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-white">${stats.avgCostPerLiter}</p>
                <p className="text-sm text-slate-400">Avg Cost/Liter</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <Fuel className="w-8 h-8 text-orange-400" />
                </div>
                <p className="text-2xl font-bold text-white">{stats.avgConsumption} L/100km</p>
                <p className="text-sm text-slate-400">Avg Consumption</p>
              </div>
            </div>
          )}

          {fuelLogs.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Fuel Volume Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="liters" stroke="#10b981" strokeWidth={2} name="Liters" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Cost Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Legend />
                    <Bar dataKey="cost" fill="#3b82f6" name="Cost ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Recent Fuel Logs</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Volume</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Cost/L</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Total Cost</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Odometer</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {fuelLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        No fuel logs yet
                      </td>
                    </tr>
                  ) : (
                    fuelLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                        <td className="py-3 px-4 text-white">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {new Date(log.recorded_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white">{log.fuel_volume_liters?.toFixed(2)} L</td>
                        <td className="py-3 px-4 text-white">${log.cost_per_liter?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-emerald-400 font-semibold">${log.total_cost?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-white">{log.odometer_reading?.toLocaleString()} km</td>
                        <td className="py-3 px-4 text-slate-400 text-sm">{log.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
