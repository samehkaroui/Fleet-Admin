import { useEffect, useState, useCallback } from 'react';
import { supabase, Vehicle, GPSLocation } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import WorldMap from './WorldMap';
import { MapPin, Navigation, Gauge, Clock, ChevronDown, Route, Map, List, Maximize2 } from 'lucide-react';

type VehicleWithLocation = Vehicle & {
  latest_location?: GPSLocation;
};

export default function GPSTracking() {
  const { user } = useAuth();
  const { getActiveTrips, getDriverById } = useFleet();
  const [vehicles, setVehicles] = useState<VehicleWithLocation[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithLocation | null>(null);
  const [locationHistory, setLocationHistory] = useState<GPSLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadVehiclesWithLocations = useCallback(async () => {
    try {
      console.log('🔄 Loading vehicles with GPS locations...');
      
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'active')
        .order('name');

      console.log('Found vehicles:', vehiclesData?.length || 0);

      if (vehiclesData) {
        const vehiclesWithLocations = await Promise.all(
          vehiclesData.map(async (vehicle) => {
            // Get latest GPS location (only from last 24 hours to avoid old data)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            
            const { data: location, error } = await supabase
              .from('gps_locations')
              .select('*')
              .eq('vehicle_id', vehicle.id)
              .gte('timestamp', twentyFourHoursAgo)
              .order('timestamp', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (error) {
              console.error(`Error loading location for ${vehicle.name}:`, error);
            }

            if (location) {
              console.log(`📍 ${vehicle.name}:`, {
                lat: location.latitude,
                lon: location.longitude,
                speed: location.speed,
                timestamp: location.timestamp,
                age: Math.round((Date.now() - new Date(location.timestamp).getTime()) / 1000 / 60) + ' minutes ago'
              });
            } else {
              console.log(`⚠️ ${vehicle.name}: No recent GPS data (last 24h)`);
            }

            return {
              ...vehicle,
              latest_location: location || undefined,
            };
          })
        );

        setVehicles(vehiclesWithLocations);
        if (vehiclesWithLocations.length > 0 && !selectedVehicle) {
          setSelectedVehicle(vehiclesWithLocations[0]);
        }
        
        console.log('✅ Vehicles loaded with locations');
      }
    } catch (error) {
      console.error('❌ Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicle]);

  useEffect(() => {
    loadVehiclesWithLocations();
    
    // Real-time subscription for GPS location updates
    if (!user) return;
    
    const gpsSubscription = supabase
      .channel('gps_realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'gps_locations' },
        (payload) => {
          console.log('GPS Update received:', payload);
          loadVehiclesWithLocations();
          if (selectedVehicle && payload.new && 
              (payload.new as GPSLocation).vehicle_id === selectedVehicle.id) {
            loadLocationHistory(selectedVehicle.id);
          }
        }
      )
      .subscribe();
    
    return () => {
      gpsSubscription.unsubscribe();
    };
  }, [user, loadVehiclesWithLocations, selectedVehicle]);

  useEffect(() => {
    if (selectedVehicle) {
      loadLocationHistory(selectedVehicle.id);
    }
  }, [selectedVehicle]);

  const loadLocationHistory = async (vehicleId: string) => {
    try {
      const { data } = await supabase
        .from('gps_locations')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('timestamp', { ascending: false })
        .limit(20);

      setLocationHistory(data || []);
    } catch (error) {
      console.error('Error loading location history:', error);
    }
  };

  const simulateGPSUpdate = async (vehicleId: string) => {
    const baseLocation = {
      latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
      longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
      speed: Math.random() * 80,
      heading: Math.random() * 360,
      accuracy: 5 + Math.random() * 10,
    };

    try {
      const { error } = await supabase.from('gps_locations').insert([
        {
          vehicle_id: vehicleId,
          ...baseLocation,
          timestamp: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      loadVehiclesWithLocations();
      if (selectedVehicle?.id === vehicleId) {
        loadLocationHistory(vehicleId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(errorMessage);
    }
  };

  const startSimulation = (vehicleId: string) => {
    setIsSimulating(true);
    const interval = setInterval(() => {
      simulateGPSUpdate(vehicleId);
    }, 5000);

    setTimeout(() => {
      clearInterval(interval);
      setIsSimulating(false);
    }, 30000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">GPS Tracking</h2>
          <p className="text-sm sm:text-base text-slate-400 hidden sm:block">Monitor real-time location of your fleet</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                viewMode === 'map'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">Map View</span>
              <span className="sm:hidden">Map</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List View</span>
              <span className="sm:hidden">List</span>
            </button>
          </div>
          
          
          {viewMode === 'map' && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white rounded-xl transition border border-slate-700/50 text-sm"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="hidden md:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
          )}
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-12 text-center">
          <MapPin className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No active vehicles</h3>
          <p className="text-slate-400">Add vehicles to start tracking their locations</p>
        </div>
      ) : viewMode === 'map' ? (
        <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-4' : ''}`}>
          {isFullscreen && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">GPS Tracking - Fullscreen</h2>
              <button
                onClick={() => setIsFullscreen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
              >
                Exit Fullscreen
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 h-full">
            <div className={`${isFullscreen ? 'lg:col-span-3' : 'lg:col-span-3'} ${isFullscreen ? 'h-[calc(100vh-8rem)]' : 'h-[400px] sm:h-[500px] md:h-[600px]'}`}>
              <WorldMap
                vehicles={vehicles}
                selectedVehicle={selectedVehicle}
                onVehicleSelect={setSelectedVehicle}
                activeTrips={getActiveTrips()}
                getDriverById={getDriverById}
              />
            </div>
            
            <div className={`lg:col-span-1 space-y-4 ${isFullscreen ? 'h-[calc(100vh-8rem)] overflow-y-auto' : ''}`}>
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
                <h3 className="text-lg font-bold text-white mb-4">Active Vehicles</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vehicles.map((vehicle) => {
                    const activeTrips = getActiveTrips();
                    const vehicleTrip = activeTrips.find(trip => trip.vehicle_id === vehicle.id);
                    
                    return (
                      <button
                        key={vehicle.id}
                        onClick={() => setSelectedVehicle(vehicle)}
                        className={`w-full text-left p-3 rounded-lg transition ${
                          selectedVehicle?.id === vehicle.id
                            ? 'bg-emerald-500/20 border border-emerald-500/50'
                            : 'bg-slate-900/50 border border-slate-700/50 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-white text-sm">{vehicle.name}</p>
                            <p className="text-xs text-slate-400">
                              {vehicle.make} {vehicle.model}
                            </p>
                            {vehicle.latest_location && (
                              <div className="mt-1 flex items-center gap-2 text-xs">
                                <span className={`inline-flex items-center gap-1 ${
                                  vehicle.latest_location.speed > 5 ? 'text-green-400' : 'text-slate-400'
                                }`}>
                                  <Gauge className="w-3 h-3" />
                                  {vehicle.latest_location.speed.toFixed(0)} km/h
                                </span>
                              </div>
                            )}
                            {vehicleTrip && (
                              <div className="mt-1 flex items-center gap-1 text-xs text-blue-400">
                                <Route className="w-3 h-3" />
                                <span>{vehicleTrip.destination}</span>
                              </div>
                            )}
                          </div>
                          {selectedVehicle?.id === vehicle.id && (
                            <ChevronDown className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {selectedVehicle && selectedVehicle.latest_location && (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">{selectedVehicle.name}</h3>
                    <button
                      onClick={() => startSimulation(selectedVehicle.id)}
                      disabled={isSimulating}
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white rounded text-xs font-medium transition"
                    >
                      {isSimulating ? 'Simulating...' : 'Simulate'}
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-400 text-sm">Location</span>
                      </div>
                      <p className="text-white text-sm font-mono">
                        {selectedVehicle.latest_location.latitude.toFixed(6)}, {selectedVehicle.latest_location.longitude.toFixed(6)}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Gauge className="w-4 h-4 text-blue-400" />
                          <span className="text-slate-400 text-xs">Speed</span>
                        </div>
                        <p className="text-white font-semibold">
                          {selectedVehicle.latest_location.speed.toFixed(1)} km/h
                        </p>
                      </div>
                      
                      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Navigation className="w-4 h-4 text-purple-400" />
                          <span className="text-slate-400 text-xs">Heading</span>
                        </div>
                        <p className="text-white font-semibold">
                          {selectedVehicle.latest_location.heading.toFixed(0)}°
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className="text-slate-400 text-xs">Last Update</span>
                      </div>
                      <p className="text-white text-sm">
                        {new Date(selectedVehicle.latest_location.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-4">Active Vehicles</h3>
              <div className="space-y-2">
                {vehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={`w-full text-left p-4 rounded-lg transition ${
                      selectedVehicle?.id === vehicle.id
                        ? 'bg-emerald-500/20 border border-emerald-500/50'
                        : 'bg-slate-900/50 border border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-white">{vehicle.name}</p>
                        <p className="text-sm text-slate-400">
                          {vehicle.make} {vehicle.model}
                        </p>
                        {vehicle.latest_location && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-emerald-400">
                              <MapPin className="w-3 h-3" />
                              <span>
                                {vehicle.latest_location.latitude.toFixed(4)}, {vehicle.latest_location.longitude.toFixed(4)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(vehicle.latest_location.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            {(() => {
                              const activeTrips = getActiveTrips();
                              const vehicleTrip = activeTrips.find(trip => trip.vehicle_id === vehicle.id);
                              return vehicleTrip ? (
                                <div className="flex items-center gap-2 text-xs text-blue-400">
                                  <Route className="w-3 h-3" />
                                  <span>En route to {vehicleTrip.destination}</span>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                        {!vehicle.latest_location && (
                          <p className="text-xs text-slate-500 mt-2">No GPS data</p>
                        )}
                      </div>
                      {selectedVehicle?.id === vehicle.id && (
                        <ChevronDown className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {selectedVehicle && (
              <>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedVehicle.name}</h3>
                      <p className="text-slate-400">
                        {selectedVehicle.make} {selectedVehicle.model}
                      </p>
                      {(() => {
                        const activeTrips = getActiveTrips();
                        const vehicleTrip = activeTrips.find(trip => trip.vehicle_id === selectedVehicle.id);
                        const driver = vehicleTrip ? getDriverById(vehicleTrip.driver_id) : null;
                        return vehicleTrip ? (
                          <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-blue-400 mb-1">
                              <Route className="w-4 h-4" />
                              <span className="font-medium">Active Trip</span>
                            </div>
                            <p className="text-white font-medium">{vehicleTrip.destination}</p>
                            <p className="text-slate-400 text-sm">
                              Driver: {driver?.name || 'Unknown'} • 
                              Departure: {new Date(vehicleTrip.departure_time).toLocaleString()}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2 p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <Route className="w-4 h-4" />
                              <span>No active trip</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <button
                      onClick={() => startSimulation(selectedVehicle.id)}
                      disabled={isSimulating}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white rounded-lg transition text-sm font-medium"
                    >
                      {isSimulating ? 'Simulating...' : 'Simulate GPS'}
                    </button>
                  </div>

                  {selectedVehicle.latest_location ? (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-8">
                        <div className="flex items-center justify-center mb-6">
                          <div className="relative">
                            <div className="absolute inset-0 bg-emerald-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
                            <MapPin className="relative w-16 h-16 text-emerald-400" />
                          </div>
                        </div>
                        <div className="text-center space-y-2">
                          <p className="text-2xl font-bold text-white">
                            {selectedVehicle.latest_location.latitude.toFixed(6)}, {selectedVehicle.latest_location.longitude.toFixed(6)}
                          </p>
                          <p className="text-slate-400">Current Location</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <Gauge className="w-5 h-5 text-blue-400" />
                            <span className="text-slate-400 text-sm">Speed</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {selectedVehicle.latest_location.speed.toFixed(1)} <span className="text-sm text-slate-400">km/h</span>
                          </p>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <Navigation className="w-5 h-5 text-purple-400" />
                            <span className="text-slate-400 text-sm">Heading</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {selectedVehicle.latest_location.heading.toFixed(0)}° <span className="text-sm text-slate-400">direction</span>
                          </p>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <MapPin className="w-5 h-5 text-emerald-400" />
                            <span className="text-slate-400 text-sm">Accuracy</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {selectedVehicle.latest_location.accuracy.toFixed(1)} <span className="text-sm text-slate-400">m</span>
                          </p>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <Clock className="w-5 h-5 text-amber-400" />
                            <span className="text-slate-400 text-sm">Last Update</span>
                          </div>
                          <p className="text-lg font-bold text-white">
                            {new Date(selectedVehicle.latest_location.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 mb-4">No GPS data available</p>
                      <button
                        onClick={() => startSimulation(selectedVehicle.id)}
                        disabled={isSimulating}
                        className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white rounded-lg transition font-medium"
                      >
                        {isSimulating ? 'Simulating...' : 'Simulate GPS Data'}
                      </button>
                    </div>
                  )}
                </div>

                {locationHistory.length > 0 && (
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Location History</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {locationHistory.map((location) => (
                        <div
                          key={location.id}
                          className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 hover:border-slate-600 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <MapPin className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm text-white font-medium">
                                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Gauge className="w-3 h-3" />
                                  {location.speed.toFixed(1)} km/h
                                </span>
                                <span className="flex items-center gap-1">
                                  <Navigation className="w-3 h-3" />
                                  {location.heading.toFixed(0)}°
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(location.timestamp).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
