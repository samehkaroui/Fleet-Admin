import { useEffect, useState } from 'react';
import { supabase, Vehicle, MaintenanceRecord } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { Wrench, Plus, Calendar, DollarSign, User, FileText, AlertCircle, Route, Clock } from 'lucide-react';

type MaintenanceWithVehicle = MaintenanceRecord & {
  vehicle?: Vehicle;
};

export default function Maintenance() {
  const { user } = useAuth();
  const { getVehicleTrips } = useFleet();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'completed'>('all');
  const [formData, setFormData] = useState({
    vehicle_id: '',
    type: 'routine' as 'routine' | 'repair' | 'inspection',
    description: '',
    status: 'scheduled' as 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
    scheduled_date: new Date().toISOString().split('T')[0],
    completed_date: '',
    odometer_reading: 0,
    cost: '',
    technician: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [vehiclesRes, maintenanceRes] = await Promise.all([
        supabase.from('vehicles').select('*').order('name'),
        supabase
          .from('maintenance_records')
          .select('*, vehicle:vehicles(*)')
          .order('scheduled_date', { ascending: false }),
      ]);

      setVehicles(vehiclesRes.data || []);
      setMaintenance((maintenanceRes.data as MaintenanceWithVehicle[]) || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        odometer_reading: formData.odometer_reading || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        completed_date: formData.completed_date || null,
        technician: formData.technician || null,
        notes: formData.notes || null,
      };

      const { error } = await supabase.from('maintenance_records').insert([data]);
      if (error) throw error;

      resetForm();
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(errorMessage);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'completed' && !maintenance.find(m => m.id === id)?.completed_date) {
        updateData.completed_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('maintenance_records')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(errorMessage);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setFormData({
      vehicle_id: '',
      type: 'routine',
      description: '',
      status: 'scheduled',
      scheduled_date: new Date().toISOString().split('T')[0],
      completed_date: '',
      odometer_reading: 0,
      cost: '',
      technician: '',
      notes: '',
    });
  };

  const filteredMaintenance = maintenance.filter((m) => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const upcomingMaintenance = maintenance.filter(m => {
    const scheduledDate = new Date(m.scheduled_date);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return m.status === 'scheduled' && scheduledDate >= now && scheduledDate <= thirtyDaysFromNow;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Maintenance</h2>
          <p className="text-sm sm:text-base text-slate-400">Schedule and track vehicle maintenance</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm sm:text-base w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Schedule Maintenance</span>
          <span className="sm:hidden">Schedule</span>
        </button>
      </div>

      {upcomingMaintenance.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-400 mb-1">
                {upcomingMaintenance.length} Maintenance {upcomingMaintenance.length === 1 ? 'Task' : 'Tasks'} Due Soon
              </p>
              <p className="text-sm text-amber-300/80">
                You have maintenance scheduled in the next 30 days
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {(['all', 'scheduled', 'in_progress', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              filter === status
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {filteredMaintenance.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-12 text-center">
          <Wrench className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            No maintenance records
          </h3>
          <p className="text-slate-400 mb-6">
            {filter === 'all'
              ? 'Start by scheduling maintenance for your vehicles'
              : `No ${filter.replace('_', ' ')} maintenance records`}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              <Plus className="w-5 h-5" />
              Schedule First Maintenance
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMaintenance.map((record) => (
            <div
              key={record.id}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-white">
                      {record.vehicle?.name || 'Unknown Vehicle'}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      record.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      record.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      record.status === 'scheduled' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {record.status.replace('_', ' ')}
                    </span>
                    <span className="px-3 py-1 bg-slate-700/50 rounded-full text-xs text-slate-300 capitalize">
                      {record.type}
                    </span>
                  </div>
                  <p className="text-slate-300 mb-3">{record.description}</p>

                  {(() => {
                    if (!record.vehicle_id) return null;
                    const vehicleTrips = getVehicleTrips(record.vehicle_id);
                    const scheduledDate = new Date(record.scheduled_date);
                    const conflictingTrips = vehicleTrips.filter(trip => {
                      const tripStart = new Date(trip.departure_time);
                      const tripEnd = new Date(trip.arrival_time);
                      return trip.status === 'scheduled' && 
                             scheduledDate >= tripStart && 
                             scheduledDate <= tripEnd;
                    });
                    
                    if (conflictingTrips.length > 0 && record.status === 'scheduled') {
                      return (
                        <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <div className="flex items-center gap-2 text-sm text-amber-400 mb-1">
                            <Route className="w-4 h-4" />
                            <span className="font-medium">Trip Conflict Warning</span>
                          </div>
                          <p className="text-amber-300 text-sm">
                            Vehicle has scheduled trip to {conflictingTrips[0].destination} on this date
                          </p>
                          <div className="flex items-center gap-2 text-xs text-amber-400 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(conflictingTrips[0].departure_time).toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-slate-500 text-xs">Scheduled</p>
                        <p className="text-white">{new Date(record.scheduled_date).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {record.completed_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <div>
                          <p className="text-slate-500 text-xs">Completed</p>
                          <p className="text-white">{new Date(record.completed_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )}

                    {record.cost && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-slate-500 text-xs">Cost</p>
                          <p className="text-white">${record.cost.toFixed(2)}</p>
                        </div>
                      </div>
                    )}

                    {record.technician && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-slate-500 text-xs">Technician</p>
                          <p className="text-white">{record.technician}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {record.notes && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <div className="flex items-start gap-2 text-sm">
                        <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-slate-500 text-xs mb-1">Notes</p>
                          <p className="text-slate-300">{record.notes}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {record.status !== 'completed' && record.status !== 'cancelled' && (
                <div className="flex gap-2 pt-4 border-t border-slate-700/50">
                  {record.status === 'scheduled' && (
                    <button
                      onClick={() => updateStatus(record.id, 'in_progress')}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition text-sm font-medium"
                    >
                      Start Work
                    </button>
                  )}
                  {record.status === 'in_progress' && (
                    <button
                      onClick={() => updateStatus(record.id, 'completed')}
                      className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition text-sm font-medium"
                    >
                      Mark Complete
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(record.id, 'cancelled')}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8">
            <h3 className="text-2xl font-bold text-white mb-6">Schedule Maintenance</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Vehicle
                </label>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Select a vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} - {vehicle.license_plate}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'routine' | 'repair' | 'inspection' })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="routine">Routine</option>
                    <option value="repair">Repair</option>
                    <option value="inspection">Inspection</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 h-24 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Odometer Reading (optional)
                  </label>
                  <input
                    type="number"
                    value={formData.odometer_reading || ''}
                    onChange={(e) => setFormData({ ...formData, odometer_reading: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Estimated Cost (optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Technician (optional)
                </label>
                <input
                  type="text"
                  value={formData.technician}
                  onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 h-24 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition"
                >
                  Schedule Maintenance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
