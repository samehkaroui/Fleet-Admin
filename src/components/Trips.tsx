import { useState } from 'react';
import { Clock, MapPin, Truck, Plus, Route, Users } from 'lucide-react';
import { useFleet } from '../contexts/FleetContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type TripView = 'overview' | 'upcoming' | 'schedule';

export default function Trips() {
  const { user } = useAuth();
  const { 
    trips, 
    vehicles, 
    drivers, 
    loading, 
    refreshTrips,
    getUpcomingTrips,
    getVehicleById,
    getDriverById,
    createAssignment,
    getVehicleAssignment,
    getDriverAssignment
  } = useFleet();
  
  const [currentView, setCurrentView] = useState<TripView>('overview');
  const [newTrip, setNewTrip] = useState({
    destination: '',
    departure_time: '',
    arrival_time: '',
    vehicle_id: '',
    driver_id: '',
    distance: 0,
    notes: ''
  });

  const navigation = [
    { id: 'overview' as TripView, label: 'Overview' },
    { id: 'upcoming' as TripView, label: 'Upcoming Trip' },
    { id: 'schedule' as TripView, label: 'Schedule Trip' },
  ];

  const handleScheduleTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      // Check if vehicle or driver is already assigned
      const vehicleAssignment = getVehicleAssignment(newTrip.vehicle_id);
      const driverAssignment = getDriverAssignment(newTrip.driver_id);
      
      if (vehicleAssignment) {
        alert('Vehicle is already assigned to another trip or task.');
        return;
      }
      
      if (driverAssignment) {
        alert('Driver is already assigned to another vehicle.');
        return;
      }
      
      // Create the trip
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert([{
          ...newTrip,
          user_id: user.id,
          status: 'scheduled'
        }])
        .select()
        .single();
      
      if (tripError) throw tripError;
      
      // Create vehicle assignment for the trip
      await createAssignment({
        vehicle_id: newTrip.vehicle_id,
        driver_id: newTrip.driver_id,
        trip_id: tripData.id,
        assigned_at: newTrip.departure_time,
        status: 'active',
        assignment_type: 'trip',
        notes: `Trip to ${newTrip.destination}`
      });
      
      // Reset form
      setNewTrip({
        destination: '',
        departure_time: '',
        arrival_time: '',
        vehicle_id: '',
        driver_id: '',
        distance: 0,
        notes: ''
      });
      
      refreshTrips();
      setCurrentView('overview');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Error scheduling trip: ' + errorMessage);
    }
  };

  const renderOverview = () => {
    const totalTrips = trips.length;
    const completedTrips = trips.filter(t => t.status === 'completed').length;
    const totalDistance = trips.reduce((sum, trip) => sum + (trip.distance || 0), 0);
    const onTimeRate = completedTrips > 0 ? Math.round((completedTrips / totalTrips) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-500/10 p-2 sm:p-3 rounded-lg sm:rounded-xl">
                <Route className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">Total Trips</h3>
                <p className="text-slate-400 text-sm">All time</p>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{totalTrips}</p>
            <p className="text-emerald-400 text-sm mt-2">Active fleet operations</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-500/10 p-3 rounded-xl">
                <Clock className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Completion Rate</h3>
                <p className="text-slate-400 text-sm">Trip success</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{onTimeRate}%</p>
            <p className="text-emerald-400 text-sm mt-2">{completedTrips} completed</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-500/10 p-3 rounded-xl">
                <MapPin className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Distance</h3>
                <p className="text-slate-400 text-sm">Total kilometers</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{totalDistance.toLocaleString()}</p>
            <p className="text-emerald-400 text-sm mt-2">km traveled</p>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-6">Recent Trips</h3>
          {loading.trips ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Route className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No trips scheduled yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trips.slice(0, 5).map((trip) => {
                const vehicle = getVehicleById(trip.vehicle_id);
                const driver = getDriverById(trip.driver_id);
                return (
                  <div key={trip.id} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/10 p-2 rounded-lg">
                          <Truck className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{trip.destination}</h4>
                          <p className="text-slate-400 text-sm">
                            {vehicle?.name || 'Unknown Vehicle'} • {driver?.name || 'Unknown Driver'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm">
                          {trip.distance ? `${trip.distance} km` : 'Distance TBD'}
                        </p>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          trip.status === 'scheduled' ? 'bg-blue-500/10 text-blue-400' :
                          trip.status === 'in_progress' ? 'bg-yellow-500/10 text-yellow-400' :
                          trip.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {trip.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderUpcomingTrip = () => {
    const upcomingTrips = getUpcomingTrips();
    const nextTrip = upcomingTrips[0];
    
    if (!nextTrip) {
      return (
        <div className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
            <div className="text-center py-12 text-slate-400">
              <Route className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-white mb-2">No Upcoming Trips</h3>
              <p className="mb-6">Schedule your first trip to get started</p>
              <button
                onClick={() => setCurrentView('schedule')}
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl transition"
              >
                <Plus className="w-5 h-5" />
                Schedule Trip
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    const vehicle = getVehicleById(nextTrip.vehicle_id);
    const driver = getDriverById(nextTrip.driver_id);
    
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-6">Next Scheduled Trip</h3>
          
          <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-xl p-6 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-2xl font-bold text-white">{nextTrip.destination}</h4>
                <p className="text-slate-400">Trip ID: {nextTrip.id}</p>
              </div>
              <div className="bg-emerald-500/10 p-3 rounded-xl">
                <MapPin className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-slate-400 text-sm">Departure</p>
                    <p className="text-white font-medium">
                      {new Date(nextTrip.departure_time).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-slate-400 text-sm">Arrival</p>
                    <p className="text-white font-medium">
                      {new Date(nextTrip.arrival_time).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-slate-400 text-sm">Vehicle</p>
                    <p className="text-white font-medium">{vehicle?.name || 'Unknown Vehicle'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-slate-400 text-sm">Driver</p>
                    <p className="text-white font-medium">{driver?.name || 'Unknown Driver'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Distance</p>
                  <p className="text-white font-medium">
                    {nextTrip.distance ? `${nextTrip.distance} km` : 'TBD'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Status</p>
                  <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400">
                    {nextTrip.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-6">Trip Timeline</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
              <div>
                <p className="text-white font-medium">Trip Scheduled</p>
                <p className="text-slate-400 text-sm">January 10, 2024 at 2:30 PM</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-slate-600 rounded-full"></div>
              <div>
                <p className="text-slate-400">Vehicle Assignment</p>
                <p className="text-slate-500 text-sm">Pending</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-slate-600 rounded-full"></div>
              <div>
                <p className="text-slate-400">Pre-trip Inspection</p>
                <p className="text-slate-500 text-sm">Pending</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderScheduleTrip = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <h3 className="text-xl font-semibold text-white mb-6">Schedule New Trip</h3>
        
        <form onSubmit={handleScheduleTrip} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Destination
              </label>
              <input
                type="text"
                value={newTrip.destination}
                onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                placeholder="Enter destination"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Vehicle
              </label>
              <select
                value={newTrip.vehicle_id}
                onChange={(e) => setNewTrip({ ...newTrip, vehicle_id: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                required
              >
                <option value="">Select Vehicle</option>
                {vehicles.filter(v => v.status === 'active').map(vehicle => {
                  const assignment = getVehicleAssignment(vehicle.id);
                  const isAssigned = assignment !== undefined;
                  return (
                    <option key={vehicle.id} value={vehicle.id} disabled={isAssigned}>
                      {vehicle.name} ({vehicle.make} {vehicle.model})
                      {isAssigned ? ' - Currently Assigned' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Departure Time
              </label>
              <input
                type="datetime-local"
                value={newTrip.departure_time}
                onChange={(e) => setNewTrip({ ...newTrip, departure_time: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Arrival Time
              </label>
              <input
                type="datetime-local"
                value={newTrip.arrival_time}
                onChange={(e) => setNewTrip({ ...newTrip, arrival_time: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Driver
              </label>
              <select
                value={newTrip.driver_id}
                onChange={(e) => setNewTrip({ ...newTrip, driver_id: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                required
              >
                <option value="">Select Driver</option>
                {drivers.filter(d => d.status === 'active').map(driver => {
                  const assignment = getDriverAssignment(driver.id);
                  const isAssigned = assignment !== undefined;
                  return (
                    <option key={driver.id} value={driver.id} disabled={isAssigned}>
                      {driver.name}
                      {isAssigned ? ' - Currently Assigned' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition font-medium"
            >
              <Plus className="w-5 h-5" />
              Schedule Trip
            </button>
            <button
              type="button"
              className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Trips</h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1">Manage and track your fleet trips</p>
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-1 sm:p-2 border border-slate-700/50">
        <div className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl transition font-medium text-sm sm:text-base whitespace-nowrap ${
                currentView === item.id
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {currentView === 'overview' && renderOverview()}
      {currentView === 'upcoming' && renderUpcomingTrip()}
      {currentView === 'schedule' && renderScheduleTrip()}
    </div>
  );
}
