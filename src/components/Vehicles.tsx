import { useEffect, useState } from 'react';
import { supabase, Vehicle } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { Truck, Plus, Edit2, Trash2, Gauge, Fuel, Calendar, Route, User } from 'lucide-react';

export default function Vehicles() {
  const { user } = useAuth();
  const { getVehicleTrips, getDriverById, trips, getVehicleAssignment, vehicleAssignments } = useFleet();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'truck',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    license_plate: '',
    status: 'active' as 'active' | 'maintenance' | 'inactive',
    odometer: 0,
    fuel_type: 'diesel',
  });

  useEffect(() => {
    loadVehicles();
  }, [user, trips, vehicleAssignments]);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingVehicle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehicles')
          .insert([{ ...formData, user_id: user!.id }]);
        if (error) throw error;
      }

      resetForm();
      loadVehicles();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(errorMessage);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      name: vehicle.name,
      type: vehicle.type,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin,
      license_plate: vehicle.license_plate,
      status: vehicle.status,
      odometer: vehicle.odometer,
      fuel_type: vehicle.fuel_type,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;

    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;
      loadVehicles();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(errorMessage);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingVehicle(null);
    setFormData({
      name: '',
      type: 'truck',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      vin: '',
      license_plate: '',
      status: 'active',
      odometer: 0,
      fuel_type: 'diesel',
    });
  };

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
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Vehicles</h2>
          <p className="text-sm sm:text-base text-slate-400">Manage your fleet vehicles</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm sm:text-base w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Add Vehicle
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-12 text-center">
          <Truck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No vehicles yet</h3>
          <p className="text-slate-400 mb-6">Get started by adding your first vehicle to the fleet</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl transition"
          >
            <Plus className="w-5 h-5" />
            Add Your First Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/10 p-3 rounded-xl">
                    <Truck className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{vehicle.name}</h3>
                    <p className="text-sm text-slate-400">
                      {vehicle.make} {vehicle.model}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  vehicle.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                  vehicle.status === 'maintenance' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {vehicle.status}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">License Plate</span>
                  <span className="text-white font-medium">{vehicle.license_plate}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Year
                  </span>
                  <span className="text-white font-medium">{vehicle.year}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    Odometer
                  </span>
                  <span className="text-white font-medium">{vehicle.odometer.toLocaleString()} km</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Fuel className="w-3 h-3" />
                    Fuel Type
                  </span>
                  <span className="text-white font-medium capitalize">{vehicle.fuel_type}</span>
                </div>
              </div>

              {(() => {
                const assignment = getVehicleAssignment(vehicle.id);
                const vehicleTrips = getVehicleTrips(vehicle.id);
                const activeTrip = vehicleTrips.find(t => t.status === 'in_progress');
                const upcomingTrip = vehicleTrips.find(t => t.status === 'scheduled');
                
                if (assignment) {
                  const driver = getDriverById(assignment.driver_id);
                  const assignedTrip = assignment.trip_id ? vehicleTrips.find(t => t.id === assignment.trip_id) : null;
                  
                  return (
                    <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-emerald-400 mb-1">
                        <User className="w-4 h-4" />
                        <span className="font-medium">Currently Assigned</span>
                      </div>
                      <p className="text-white font-medium text-sm">
                        Driver: {driver?.name || 'Unknown Driver'}
                      </p>
                      {assignedTrip && (
                        <>
                          <div className="flex items-center gap-2 text-xs text-emerald-400 mt-1">
                            <Route className="w-3 h-3" />
                            <span>Trip to {assignedTrip.destination}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(assignedTrip.departure_time).toLocaleDateString()}</span>
                          </div>
                        </>
                      )}
                      {assignment.assignment_type === 'general' && (
                        <p className="text-xs text-slate-400 mt-1">
                          {assignment.notes || 'General assignment'}
                        </p>
                      )}
                    </div>
                  );
                } else if (activeTrip) {
                  const driver = getDriverById(activeTrip.driver_id);
                  return (
                    <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-blue-400 mb-1">
                        <Route className="w-4 h-4" />
                        <span className="font-medium">Active Trip</span>
                      </div>
                      <p className="text-white font-medium text-sm">{activeTrip.destination}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <User className="w-3 h-3" />
                        <span>{driver?.name || 'Unknown Driver'}</span>
                      </div>
                    </div>
                  );
                } else if (upcomingTrip) {
                  const driver = getDriverById(upcomingTrip.driver_id);
                  return (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-amber-400 mb-1">
                        <Route className="w-4 h-4" />
                        <span className="font-medium">Upcoming Trip</span>
                      </div>
                      <p className="text-white font-medium text-sm">{upcomingTrip.destination}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <User className="w-3 h-3" />
                        <span>{driver?.name || 'Unknown Driver'}</span>
                        <Calendar className="w-3 h-3 ml-2" />
                        <span>{new Date(upcomingTrip.departure_time).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                } else if (vehicle.status === 'active') {
                  return (
                    <div className="mb-4 p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Route className="w-4 h-4" />
                        <span>Available for assignment</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex gap-2 pt-4 border-t border-slate-700/50">
                <button
                  onClick={() => handleEdit(vehicle)}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(vehicle.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg transition text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8">
            <h3 className="text-2xl font-bold text-white mb-6">
              {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Vehicle Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="truck">Truck</option>
                    <option value="van">Van</option>
                    <option value="car">Car</option>
                    <option value="bus">Bus</option>
                    <option value="trailer">Trailer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Make
                  </label>
                  <input
                    type="text"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Model
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    VIN
                  </label>
                  <input
                    type="text"
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    License Plate
                  </label>
                  <input
                    type="text"
                    value={formData.license_plate}
                    onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'maintenance' | 'inactive' })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Odometer (km)
                  </label>
                  <input
                    type="number"
                    value={formData.odometer}
                    onChange={(e) => setFormData({ ...formData, odometer: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Fuel Type
                  </label>
                  <select
                    value={formData.fuel_type}
                    onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="diesel">Diesel</option>
                    <option value="gasoline">Gasoline</option>
                    <option value="electric">Electric</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
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
                  {editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
