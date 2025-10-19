import { useState } from 'react';
import { useFleet } from '../contexts/FleetContext';
import { useAuth } from '../contexts/AuthContext';
import { User, Truck, Plus, X, Calendar, FileText, Route, Clock } from 'lucide-react';

export default function VehicleAssignments() {
  const { user } = useAuth();
  const {
    vehicles,
    drivers,
    vehicleAssignments,
    loading,
    createAssignment,
    completeAssignment,
    getVehicleById,
    getDriverById,
    getActiveAssignments,
    getVehicleAssignment,
    getDriverAssignment,
  } = useFleet();

  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [formData, setFormData] = useState({
    vehicle_id: '',
    driver_id: '',
    assignment_type: 'general' as 'trip' | 'general',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const vehicleAssignment = getVehicleAssignment(formData.vehicle_id);
      const driverAssignment = getDriverAssignment(formData.driver_id);

      if (vehicleAssignment) {
        alert('Vehicle is already assigned.');
        return;
      }

      if (driverAssignment) {
        alert('Driver is already assigned to another vehicle.');
        return;
      }

      await createAssignment({
        ...formData,
        assigned_at: new Date().toISOString(),
        status: 'active',
      });

      resetForm();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Error creating assignment: ' + errorMessage);
    }
  };

  const handleComplete = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to complete this assignment?')) return;

    try {
      await completeAssignment(assignmentId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Error completing assignment: ' + errorMessage);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setFormData({
      vehicle_id: '',
      driver_id: '',
      assignment_type: 'general',
      notes: '',
    });
  };

  const filteredAssignments = vehicleAssignments.filter(assignment => {
    if (filter === 'all') return true;
    return assignment.status === filter;
  });

  const activeAssignments = getActiveAssignments();
  const availableVehicles = vehicles.filter(v => 
    v.status === 'active' && !getVehicleAssignment(v.id)
  );
  const availableDrivers = drivers.filter(d => 
    d.status === 'active' && !getDriverAssignment(d.id)
  );

  if (loading.assignments || loading.vehicles || loading.drivers) {
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
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Vehicle Assignments</h2>
          <p className="text-sm sm:text-base text-slate-400">Manage vehicle and driver assignments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm sm:text-base w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          New Assignment
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <div className="bg-emerald-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <User className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">Active</h3>
              <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Assignments</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{activeAssignments.length}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <div className="bg-blue-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <Truck className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">Available</h3>
              <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Vehicles</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{availableVehicles.length}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <div className="bg-purple-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <User className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">Available</h3>
              <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Drivers</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{availableDrivers.length}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <div className="bg-amber-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <Route className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">Trip</h3>
              <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Assignments</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {activeAssignments.filter(a => a.assignment_type === 'trip').length}
          </p>
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-1 sm:p-2 border border-slate-700/50">
        <div className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
          {(['active', 'completed', 'all'] as const).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl transition font-medium capitalize text-sm sm:text-base whitespace-nowrap ${
                filter === filterOption
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <h3 className="text-xl font-semibold text-white mb-6">Assignments</h3>
        
        {filteredAssignments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No assignments found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAssignments.map((assignment) => {
              const vehicle = getVehicleById(assignment.vehicle_id);
              const driver = getDriverById(assignment.driver_id);
              
              return (
                <div
                  key={assignment.id}
                  className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${
                        assignment.assignment_type === 'trip' 
                          ? 'bg-blue-500/10' 
                          : 'bg-emerald-500/10'
                      }`}>
                        {assignment.assignment_type === 'trip' ? (
                          <Route className="w-6 h-6 text-blue-400" />
                        ) : (
                          <User className="w-6 h-6 text-emerald-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">
                          {vehicle?.name || 'Unknown Vehicle'} → {driver?.name || 'Unknown Driver'}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(assignment.assigned_at).toLocaleDateString()}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            assignment.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-slate-500/10 text-slate-400'
                          }`}>
                            {assignment.status}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            assignment.assignment_type === 'trip'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-purple-500/10 text-purple-400'
                          }`}>
                            {assignment.assignment_type}
                          </span>
                        </div>
                        {assignment.notes && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                            <FileText className="w-3 h-3" />
                            <span>{assignment.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignment.status === 'active' && (
                        <button
                          onClick={() => handleComplete(assignment.id)}
                          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition text-sm font-medium"
                        >
                          Complete
                        </button>
                      )}
                      {assignment.returned_at && (
                        <div className="text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Returned: {new Date(assignment.returned_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-md my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">New Assignment</h3>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Vehicle
                </label>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                >
                  <option value="">Select Vehicle</option>
                  {availableVehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} ({vehicle.make} {vehicle.model})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Driver
                </label>
                <select
                  value={formData.driver_id}
                  onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                >
                  <option value="">Select Driver</option>
                  {availableDrivers.map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Assignment Type
                </label>
                <select
                  value={formData.assignment_type}
                  onChange={(e) => setFormData({ ...formData, assignment_type: e.target.value as 'trip' | 'general' })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="general">General Assignment</option>
                  <option value="trip">Trip Assignment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Assignment notes..."
                  rows={3}
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
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
