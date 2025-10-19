import { useEffect, useState } from 'react';
import { supabase, Driver } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { User, Plus, Edit2, Trash2, Phone, CreditCard, Calendar, AlertCircle, Route } from 'lucide-react';

export default function Drivers() {
  const { user } = useAuth();
  const { getDriverAssignment, getDriverTrips, vehicleAssignments, vehicles, createAssignment, completeAssignment, getVehicleById, getVehicleAssignment } = useFleet();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    license_number: '',
    license_expiry: '',
    status: 'active' as 'active' | 'inactive' | 'suspended',
  });

  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [assignmentFormData, setAssignmentFormData] = useState({
    vehicle_id: '',
    assignment_type: 'general' as 'trip' | 'general',
    notes: '',
  });

  useEffect(() => {
    loadDrivers();
  }, [user, vehicleAssignments]);

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDriver) {
        const { error } = await supabase
          .from('drivers')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingDriver.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('drivers')
          .insert([{ ...formData, user_id: user!.id }]);
        if (error) throw error;
      }

      resetForm();
      loadDrivers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(errorMessage);
    }
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      license_number: driver.license_number,
      license_expiry: driver.license_expiry,
      status: driver.status,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    try {
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) throw error;
      loadDrivers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(errorMessage);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingDriver(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      license_number: '',
      license_expiry: '',
      status: 'active',
    });
  };

  const handleAssignVehicle = (driver: Driver) => {
    setSelectedDriver(driver);
    setShowAssignmentModal(true);
  };

  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) return;

    try {
      // Check if vehicle is already assigned
      const vehicleAssignment = getVehicleAssignment(assignmentFormData.vehicle_id);
      if (vehicleAssignment) {
        alert('Vehicle is already assigned to another driver.');
        return;
      }

      await createAssignment({
        vehicle_id: assignmentFormData.vehicle_id,
        driver_id: selectedDriver.id,
        assigned_at: new Date().toISOString(),
        status: 'active',
        assignment_type: assignmentFormData.assignment_type,
        notes: assignmentFormData.notes,
      });

      resetAssignmentForm();
      loadDrivers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Error creating assignment: ' + errorMessage);
    }
  };

  const handleCompleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to complete this assignment?')) return;

    try {
      await completeAssignment(assignmentId);
      loadDrivers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Error completing assignment: ' + errorMessage);
    }
  };

  const resetAssignmentForm = () => {
    setShowAssignmentModal(false);
    setSelectedDriver(null);
    setAssignmentFormData({
      vehicle_id: '',
      assignment_type: 'general',
      notes: '',
    });
  };

  const isLicenseExpiring = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry <= thirtyDaysFromNow;
  };

  const isLicenseExpired = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    return expiry < now;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const activeDrivers = drivers.filter(d => d.status === 'active');
  const assignedDrivers = activeDrivers.filter(d => getDriverAssignment(d.id));
  const expiringLicenses = drivers.filter(d => isLicenseExpiring(d.license_expiry) && !isLicenseExpired(d.license_expiry));
  const expiredLicenses = drivers.filter(d => isLicenseExpired(d.license_expiry));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Drivers</h2>
          <p className="text-sm sm:text-base text-slate-400">Manage your fleet drivers</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm sm:text-base w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Add Driver
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <div className="bg-blue-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <User className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">Total Drivers</h3>
              <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">All drivers</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{drivers.length}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <div className="bg-emerald-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <User className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">Active Drivers</h3>
              <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Available</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{activeDrivers.length}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <div className="bg-purple-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <Route className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">Assigned</h3>
              <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Currently working</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{assignedDrivers.length}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <div className="bg-amber-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">License Issues</h3>
              <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Expiring/Expired</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{expiringLicenses.length + expiredLicenses.length}</p>
        </div>
      </div>

      {(expiredLicenses.length > 0 || expiringLicenses.length > 0) && (
        <div className="space-y-4">
          {expiredLicenses.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Expired Licenses</span>
              </div>
              <div className="text-red-300 text-sm">
                {expiredLicenses.map(driver => driver.name).join(', ')} - Immediate action required
              </div>
            </div>
          )}
          
          {expiringLicenses.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Licenses Expiring Soon</span>
              </div>
              <div className="text-amber-300 text-sm">
                {expiringLicenses.map(driver => driver.name).join(', ')} - Renew within 30 days
              </div>
            </div>
          )}
        </div>
      )}

      {drivers.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-12 text-center">
          <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No drivers yet</h3>
          <p className="text-slate-400 mb-6">Get started by adding your first driver to the fleet</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl transition"
          >
            <Plus className="w-5 h-5" />
            Add Your First Driver
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {drivers.map((driver) => {
            const assignment = getDriverAssignment(driver.id);
            const driverTrips = getDriverTrips(driver.id);
            const activeTrips = driverTrips.filter(t => t.status === 'in_progress');
            const upcomingTrips = driverTrips.filter(t => t.status === 'scheduled');
            const licenseExpired = isLicenseExpired(driver.license_expiry);
            const licenseExpiring = isLicenseExpiring(driver.license_expiry) && !licenseExpired;

            return (
              <div
                key={driver.id}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-3 rounded-xl">
                      <User className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{driver.name}</h3>
                      <p className="text-sm text-slate-400">{driver.email}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    driver.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                    driver.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {driver.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Phone
                    </span>
                    <span className="text-white font-medium">{driver.phone}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      License
                    </span>
                    <span className="text-white font-medium">{driver.license_number}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Expires
                    </span>
                    <span className={`font-medium ${
                      licenseExpired ? 'text-red-400' :
                      licenseExpiring ? 'text-amber-400' :
                      'text-white'
                    }`}>
                      {new Date(driver.license_expiry).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {assignment ? (
                  <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm text-emerald-400">
                        <Route className="w-4 h-4" />
                        <span className="font-medium">Currently Assigned</span>
                      </div>
                      <button
                        onClick={() => handleCompleteAssignment(assignment.id)}
                        className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded text-xs font-medium transition"
                      >
                        Complete
                      </button>
                    </div>
                    <p className="text-white text-sm mb-1">
                      Vehicle: {getVehicleById(assignment.vehicle_id)?.name || 'Unknown Vehicle'}
                    </p>
                    <p className="text-slate-300 text-xs">
                      {assignment.assignment_type === 'trip' ? 'Trip Assignment' : 'General Assignment'}
                    </p>
                    {assignment.notes && (
                      <p className="text-xs text-slate-400 mt-1">{assignment.notes}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : activeTrips.length > 0 ? (
                  <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-blue-400 mb-1">
                      <Route className="w-4 h-4" />
                      <span className="font-medium">Active Trip</span>
                    </div>
                    <p className="text-white text-sm">{activeTrips[0].destination}</p>
                  </div>
                ) : upcomingTrips.length > 0 ? (
                  <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-amber-400 mb-1">
                      <Route className="w-4 h-4" />
                      <span className="font-medium">Upcoming Trip</span>
                    </div>
                    <p className="text-white text-sm">{upcomingTrips[0].destination}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(upcomingTrips[0].departure_time).toLocaleDateString()}
                    </p>
                  </div>
                ) : driver.status === 'active' ? (
                  <div className="mb-4 p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <User className="w-4 h-4" />
                        <span>Available for assignment</span>
                      </div>
                      <button
                        onClick={() => handleAssignVehicle(driver)}
                        className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded text-xs font-medium transition"
                      >
                        Assign Vehicle
                      </button>
                    </div>
                  </div>
                ) : null}

                {(licenseExpired || licenseExpiring) && (
                  <div className={`mb-4 p-3 rounded-lg border ${
                    licenseExpired 
                      ? 'bg-red-500/10 border-red-500/20' 
                      : 'bg-amber-500/10 border-amber-500/20'
                  }`}>
                    <div className={`flex items-center gap-2 text-sm ${
                      licenseExpired ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">
                        {licenseExpired ? 'License Expired' : 'License Expiring Soon'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-slate-700/50">
                  <button
                    onClick={() => handleEdit(driver)}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  {!assignment && driver.status === 'active' && (
                    <button
                      onClick={() => handleAssignVehicle(driver)}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg transition text-sm font-medium"
                    >
                      <Route className="w-4 h-4" />
                      Assign
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(driver.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg transition text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8">
            <h3 className="text-2xl font-bold text-white mb-6">
              {editingDriver ? 'Edit Driver' : 'Add New Driver'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Full Name
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
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    License Number
                  </label>
                  <input
                    type="text"
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    License Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.license_expiry}
                    onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'suspended' })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
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
                  {editingDriver ? 'Update Driver' : 'Add Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignmentModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-md my-8">
            <h3 className="text-2xl font-bold text-white mb-6">
              Assign Vehicle to {selectedDriver.name}
            </h3>

            <form onSubmit={handleAssignmentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Vehicle
                </label>
                <select
                  value={assignmentFormData.vehicle_id}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, vehicle_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.filter(v => v.status === 'active' && !getVehicleAssignment(v.id)).map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} ({vehicle.make} {vehicle.model})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Assignment Type
                </label>
                <select
                  value={assignmentFormData.assignment_type}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, assignment_type: e.target.value as 'trip' | 'general' })}
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
                  value={assignmentFormData.notes}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Assignment notes..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetAssignmentForm}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition"
                >
                  Assign Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
