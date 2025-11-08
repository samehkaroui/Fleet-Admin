import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { supabase, Trip, Vehicle, Driver, GPSLocation } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Route, Play, Pause, SkipBack, SkipForward, Calendar, Clock, MapPin, Gauge } from 'lucide-react';
import L from 'leaflet';

export default function TripHistory() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [routePoints, setRoutePoints] = useState<GPSLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    loadTrips();
    loadVehicles();
    loadDrivers();
  }, [user]);

  useEffect(() => {
    if (selectedTrip) {
      const loadPoints = async () => {
        try {
          const { data, error } = await supabase
            .from('gps_locations')
            .select('*')
            .eq('vehicle_id', selectedTrip.vehicle_id)
            .gte('timestamp', selectedTrip.departure_time)
            .lte('timestamp', selectedTrip.arrival_time || new Date().toISOString())
            .order('timestamp', { ascending: true });

          if (error) throw error;
          setRoutePoints(data || []);
        } catch (error) {
          console.error('Error loading route points:', error);
        }
      };
      
      loadPoints();
      setCurrentPointIndex(0);
      setIsPlaying(false);
    }
  }, [selectedTrip]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && currentPointIndex < routePoints.length - 1) {
      interval = setInterval(() => {
        setCurrentPointIndex(prev => {
          if (prev >= routePoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }

    return () => clearInterval(interval);
  }, [isPlaying, currentPointIndex, routePoints.length, playbackSpeed]);

  const loadTrips = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .in('status', ['completed', 'in_progress'])
        .order('departure_time', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const { data } = await supabase.from('vehicles').select('*');
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadDrivers = async () => {
    try {
      const { data } = await supabase.from('drivers').select('*');
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };


  const getVehicleName = (vehicleId: string) => {
    return vehicles.find(v => v.id === vehicleId)?.name || 'Unknown';
  };

  const getDriverName = (driverId: string) => {
    return drivers.find(d => d.id === driverId)?.name || 'Unknown';
  };

  const calculateTripStats = (points: GPSLocation[]) => {
    if (points.length === 0) return null;

    let totalDistance = 0;
    let maxSpeed = 0;
    let totalSpeed = 0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      // Haversine formula for distance
      const R = 6371; // Earth radius in km
      const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
      const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += R * c;

      maxSpeed = Math.max(maxSpeed, curr.speed);
      totalSpeed += curr.speed;
    }

    const avgSpeed = totalSpeed / points.length;
    const duration = (new Date(points[points.length - 1].timestamp).getTime() - 
                     new Date(points[0].timestamp).getTime()) / (1000 * 60);

    return {
      distance: totalDistance.toFixed(2),
      maxSpeed: maxSpeed.toFixed(1),
      avgSpeed: avgSpeed.toFixed(1),
      duration: duration.toFixed(0),
    };
  };

  const stats = routePoints.length > 0 ? calculateTripStats(routePoints) : null;

  const createCustomIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Trip History & Playback</h2>
        <p className="text-slate-400">Review and replay completed trips</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-4">Recent Trips</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {trips.length === 0 ? (
                <div className="text-center py-8">
                  <Route className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No trips found</p>
                </div>
              ) : (
                trips.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => setSelectedTrip(trip)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      selectedTrip?.id === trip.id
                        ? 'bg-emerald-500/20 border border-emerald-500/50'
                        : 'bg-slate-900/50 border border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-white text-sm">{trip.destination}</p>
                        <p className="text-xs text-slate-400">{getVehicleName(trip.vehicle_id)}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        trip.status === 'completed' 
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {trip.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(trip.departure_time).toLocaleDateString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedTrip && stats && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-4">Trip Statistics</h3>
              <div className="space-y-3">
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-400 text-xs">Distance</span>
                  </div>
                  <p className="text-white font-semibold">{stats.distance} km</p>
                </div>

                <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-400 text-xs">Avg Speed</span>
                  </div>
                  <p className="text-white font-semibold">{stats.avgSpeed} km/h</p>
                </div>

                <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="w-4 h-4 text-orange-400" />
                    <span className="text-slate-400 text-xs">Max Speed</span>
                  </div>
                  <p className="text-white font-semibold">{stats.maxSpeed} km/h</p>
                </div>

                <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span className="text-slate-400 text-xs">Duration</span>
                  </div>
                  <p className="text-white font-semibold">{stats.duration} min</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4">
          {selectedTrip ? (
            <>
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedTrip.destination}</h3>
                    <p className="text-sm text-slate-400">
                      {getVehicleName(selectedTrip.vehicle_id)} • {getDriverName(selectedTrip.driver_id)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Departure</p>
                    <p className="text-white font-medium">
                      {new Date(selectedTrip.departure_time).toLocaleString()}
                    </p>
                  </div>
                </div>

                {routePoints.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPointIndex(0)}
                          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                        >
                          <SkipBack className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 text-white" />
                          ) : (
                            <Play className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <button
                          onClick={() => setCurrentPointIndex(routePoints.length - 1)}
                          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                        >
                          <SkipForward className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Speed:</span>
                        {[0.5, 1, 2, 4].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setPlaybackSpeed(speed)}
                            className={`px-3 py-1 rounded-lg text-sm transition ${
                              playbackSpeed === speed
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                      <input
                        type="range"
                        min="0"
                        max={routePoints.length - 1}
                        value={currentPointIndex}
                        onChange={(e) => setCurrentPointIndex(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                        <span>Point {currentPointIndex + 1} of {routePoints.length}</span>
                        {routePoints[currentPointIndex] && (
                          <span>
                            {new Date(routePoints[currentPointIndex].timestamp).toLocaleTimeString()} • 
                            {routePoints[currentPointIndex].speed.toFixed(1)} km/h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
                <MapContainer
                  center={routePoints.length > 0 
                    ? [routePoints[0].latitude, routePoints[0].longitude]
                    : [40.7128, -74.0060]
                  }
                  zoom={13}
                  style={{ height: '500px', width: '100%' }}
                  className="z-0"
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {routePoints.length > 0 && (
                    <>
                      <Polyline
                        positions={routePoints.map(p => [p.latitude, p.longitude])}
                        pathOptions={{ color: '#10b981', weight: 4, opacity: 0.7 }}
                      />

                      <Marker
                        position={[routePoints[0].latitude, routePoints[0].longitude]}
                        icon={createCustomIcon('#10b981')}
                      >
                        <Popup>
                          <div className="p-2">
                            <p className="font-bold">Start</p>
                            <p className="text-xs">{new Date(routePoints[0].timestamp).toLocaleString()}</p>
                          </div>
                        </Popup>
                      </Marker>

                      <Marker
                        position={[
                          routePoints[routePoints.length - 1].latitude,
                          routePoints[routePoints.length - 1].longitude
                        ]}
                        icon={createCustomIcon('#ef4444')}
                      >
                        <Popup>
                          <div className="p-2">
                            <p className="font-bold">End</p>
                            <p className="text-xs">
                              {new Date(routePoints[routePoints.length - 1].timestamp).toLocaleString()}
                            </p>
                          </div>
                        </Popup>
                      </Marker>

                      {routePoints[currentPointIndex] && (
                        <Marker
                          position={[
                            routePoints[currentPointIndex].latitude,
                            routePoints[currentPointIndex].longitude
                          ]}
                          icon={createCustomIcon('#3b82f6')}
                        >
                          <Popup>
                            <div className="p-2">
                              <p className="font-bold">Current Position</p>
                              <p className="text-xs">
                                Speed: {routePoints[currentPointIndex].speed.toFixed(1)} km/h
                              </p>
                              <p className="text-xs">
                                {new Date(routePoints[currentPointIndex].timestamp).toLocaleString()}
                              </p>
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </>
                  )}
                </MapContainer>
              </div>
            </>
          ) : (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-12 text-center">
              <Route className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Select a Trip</h3>
              <p className="text-slate-400">Choose a trip from the list to view its route and playback</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
