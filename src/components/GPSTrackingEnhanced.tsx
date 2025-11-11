import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents } from 'react-leaflet';
import { supabase, Vehicle, GPSLocation, Geofence } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { MapPin, Navigation, Gauge, Clock, Shield, Plus, Trash2, Check, X, Layers } from 'lucide-react';
import L from 'leaflet';

type VehicleWithLocation = Vehicle & {
  latest_location?: GPSLocation;
};

export default function GPSTrackingEnhanced() {
  const { user } = useAuth();
  const { getActiveTrips, getDriverById } = useFleet();
  const [vehicles, setVehicles] = useState<VehicleWithLocation[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithLocation | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showGeofenceForm, setShowGeofenceForm] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);

  const [geofenceForm, setGeofenceForm] = useState({
    name: '',
    description: '',
    center_lat: 40.7128,
    center_lon: -74.0060,
    radius_meters: 1000,
    alert_on_enter: true,
    alert_on_exit: true,
    color: '#10b981',
  });

  useEffect(() => {
    loadVehiclesWithLocations();
    loadGeofences();

    // Real-time GPS updates
    const gpsChannel = supabase
      .channel('gps_updates')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'gps_locations' },
        () => {
          loadVehiclesWithLocations();
        }
      )
      .subscribe();

    return () => {
      gpsChannel.unsubscribe();
    };
  }, [user]);

  const loadVehiclesWithLocations = useCallback(async () => {
    try {
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (vehiclesData) {
        const vehiclesWithLocations = await Promise.all(
          vehiclesData.map(async (vehicle) => {
            const { data: location } = await supabase
              .from('gps_locations')
              .select('*')
              .eq('vehicle_id', vehicle.id)
              .order('timestamp', { ascending: false })
              .limit(1)
              .maybeSingle();

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
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicle]);

  const loadGeofences = async () => {
    try {
      const { data, error } = await supabase
        .from('geofences')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGeofences(data || []);
    } catch (error) {
      console.error('Error loading geofences:', error);
    }
  };

  const handleGeofenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingGeofence) {
        const { error } = await supabase
          .from('geofences')
          .update({
            ...geofenceForm,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingGeofence.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('geofences')
          .insert([{
            ...geofenceForm,
            user_id: user?.id,
            zone_type: 'circle',
            is_active: true,
          }]);

        if (error) throw error;
      }

      loadGeofences();
      resetGeofenceForm();
    } catch (error) {
      console.error('Error saving geofence:', error);
      alert('Failed to save geofence');
    }
  };

  const deleteGeofence = async (id: string) => {
    if (!confirm('Delete this geofence?')) return;

    try {
      const { error } = await supabase
        .from('geofences')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadGeofences();
    } catch (error) {
      console.error('Error deleting geofence:', error);
    }
  };

  const toggleGeofenceStatus = async (geofence: Geofence) => {
    try {
      const { error } = await supabase
        .from('geofences')
        .update({ is_active: !geofence.is_active })
        .eq('id', geofence.id);

      if (error) throw error;
      loadGeofences();
    } catch (error) {
      console.error('Error toggling geofence:', error);
    }
  };

  const resetGeofenceForm = () => {
    setShowGeofenceForm(false);
    setEditingGeofence(null);
    setGeofenceForm({
      name: '',
      description: '',
      center_lat: 40.7128,
      center_lon: -74.0060,
      radius_meters: 1000,
      alert_on_enter: true,
      alert_on_exit: true,
      color: '#10b981',
    });
  };

  const simulateGPSUpdate = async (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    const lastLocation = vehicle?.latest_location;

    const baseLocation = {
      latitude: lastLocation?.latitude || 40.7128 + (Math.random() - 0.5) * 0.1,
      longitude: lastLocation?.longitude || -74.0060 + (Math.random() - 0.5) * 0.1,
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
    } catch (error) {
      console.error('Error simulating GPS:', error);
    }
  };

  function MapClickHandler() {
    useMapEvents({
      click: (e) => {
        if (showGeofenceForm) {
          setGeofenceForm(prev => ({
            ...prev,
            center_lat: e.latlng.lat,
            center_lon: e.latlng.lng,
          }));
        }
      },
    });
    return null;
  }

  const createCustomIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const mapCenter: [number, number] = selectedVehicle?.latest_location 
    ? [selectedVehicle.latest_location.latitude, selectedVehicle.latest_location.longitude]
    : [40.7128, -74.0060];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">GPS Tracking & Geofencing</h2>
          <p className="text-slate-400">Real-time vehicle tracking with zone management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGeofences(!showGeofences)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition font-medium ${
              showGeofences
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-5 h-5" />
            Geofences
          </button>
          <button
            onClick={() => setShowGeofenceForm(!showGeofenceForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition font-medium"
          >
            {showGeofenceForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showGeofenceForm ? 'Cancel' : 'Add Zone'}
          </button>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-12 text-center">
          <MapPin className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No active vehicles</h3>
          <p className="text-slate-400">Add vehicles to start tracking</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: '600px', width: '100%' }}
                className="z-0"
                key={`map-${mapCenter[0]}-${mapCenter[1]}`}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler />

                {/* Vehicles */}
                {vehicles.map((vehicle) => {
                  if (!vehicle.latest_location) return null;
                  const activeTrip = getActiveTrips().find(t => t.vehicle_id === vehicle.id);
                  const driver = activeTrip ? getDriverById(activeTrip.driver_id) : null;

                  return (
                    <Marker
                      key={vehicle.id}
                      position={[vehicle.latest_location.latitude, vehicle.latest_location.longitude]}
                      icon={createCustomIcon(selectedVehicle?.id === vehicle.id ? '#10b981' : '#3b82f6')}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-bold text-lg">{vehicle.name}</h3>
                          <p className="text-sm text-gray-600">{vehicle.make} {vehicle.model}</p>
                          <div className="mt-2 space-y-1 text-xs">
                            <p><strong>Speed:</strong> {vehicle.latest_location.speed.toFixed(1)} km/h</p>
                            <p><strong>Heading:</strong> {vehicle.latest_location.heading.toFixed(0)}°</p>
                            {driver && <p><strong>Driver:</strong> {driver.name}</p>}
                            {activeTrip && <p><strong>Destination:</strong> {activeTrip.destination}</p>}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Geofences */}
                {showGeofences && geofences.map((geofence) => (
                  geofence.zone_type === 'circle' && geofence.center_lat && geofence.center_lon && (
                    <Circle
                      key={geofence.id}
                      center={[geofence.center_lat, geofence.center_lon]}
                      radius={geofence.radius_meters || 1000}
                      pathOptions={{
                        color: geofence.is_active ? geofence.color : '#64748b',
                        fillColor: geofence.is_active ? geofence.color : '#64748b',
                        fillOpacity: 0.2,
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-bold">{geofence.name}</h3>
                          <p className="text-sm text-gray-600">{geofence.description}</p>
                          <p className="text-xs text-gray-500 mt-1">Radius: {geofence.radius_meters}m</p>
                        </div>
                      </Popup>
                    </Circle>
                  )
                ))}

                {/* New Geofence Preview */}
                {showGeofenceForm && (
                  <Circle
                    center={[geofenceForm.center_lat, geofenceForm.center_lon]}
                    radius={geofenceForm.radius_meters}
                    pathOptions={{
                      color: geofenceForm.color,
                      fillColor: geofenceForm.color,
                      fillOpacity: 0.3,
                      dashArray: '10, 10',
                    }}
                  >
                    <Marker
                      position={[geofenceForm.center_lat, geofenceForm.center_lon]}
                      icon={createCustomIcon(geofenceForm.color)}
                    />
                  </Circle>
                )}
              </MapContainer>
            </div>
          </div>

          <div className="space-y-4">
            {/* Geofence Form */}
            {showGeofenceForm && (
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
                <h3 className="text-lg font-bold text-white mb-4">
                  {editingGeofence ? 'Edit Zone' : 'New Zone'}
                </h3>
                <form onSubmit={handleGeofenceSubmit} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                    <input
                      type="text"
                      value={geofenceForm.name}
                      onChange={(e) => setGeofenceForm({ ...geofenceForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Radius (m)</label>
                    <input
                      type="number"
                      value={geofenceForm.radius_meters}
                      onChange={(e) => setGeofenceForm({ ...geofenceForm, radius_meters: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      min="100"
                      max="50000"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Color</label>
                    <input
                      type="color"
                      value={geofenceForm.color}
                      onChange={(e) => setGeofenceForm({ ...geofenceForm, color: e.target.value })}
                      className="w-full h-10 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={geofenceForm.alert_on_enter}
                        onChange={(e) => setGeofenceForm({ ...geofenceForm, alert_on_enter: e.target.checked })}
                        className="rounded border-slate-700 text-emerald-500"
                      />
                      Alert on Enter
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={geofenceForm.alert_on_exit}
                        onChange={(e) => setGeofenceForm({ ...geofenceForm, alert_on_exit: e.target.checked })}
                        className="rounded border-slate-700 text-emerald-500"
                      />
                      Alert on Exit
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-medium text-sm"
                  >
                    {editingGeofence ? 'Update' : 'Create'}
                  </button>
                </form>
              </div>
            )}

            {/* Vehicles List */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-4">Active Vehicles</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {vehicles.map((vehicle) => (
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
                        <p className="text-xs text-slate-400">{vehicle.make} {vehicle.model}</p>
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
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          simulateGPSUpdate(vehicle.id);
                        }}
                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                      >
                        Update
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Geofences List */}
            {showGeofences && (
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
                <h3 className="text-lg font-bold text-white mb-4">Geofences</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {geofences.length === 0 ? (
                    <div className="text-center py-4">
                      <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">No zones created</p>
                    </div>
                  ) : (
                    geofences.map((geofence) => (
                      <div
                        key={geofence.id}
                        className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: geofence.color }}
                              />
                              <h4 className="font-semibold text-white text-sm">{geofence.name}</h4>
                            </div>
                            <p className="text-xs text-slate-400">{geofence.radius_meters}m radius</p>
                          </div>
                          <button
                            onClick={() => toggleGeofenceStatus(geofence)}
                            className={`p-1 rounded ${
                              geofence.is_active
                                ? 'text-emerald-400 hover:bg-emerald-500/10'
                                : 'text-slate-500 hover:bg-slate-700'
                            }`}
                          >
                            {geofence.is_active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteGeofence(geofence.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Selected Vehicle Info */}
            {selectedVehicle?.latest_location && (
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
                <h3 className="text-lg font-bold text-white mb-3">{selectedVehicle.name}</h3>
                <div className="space-y-2">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-400 text-xs">Location</span>
                    </div>
                    <p className="text-white text-xs font-mono">
                      {selectedVehicle.latest_location.latitude.toFixed(6)}, {selectedVehicle.latest_location.longitude.toFixed(6)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Gauge className="w-4 h-4 text-blue-400" />
                        <span className="text-slate-400 text-xs">Speed</span>
                      </div>
                      <p className="text-white font-semibold text-sm">
                        {selectedVehicle.latest_location.speed.toFixed(1)} km/h
                      </p>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Navigation className="w-4 h-4 text-purple-400" />
                        <span className="text-slate-400 text-xs">Heading</span>
                      </div>
                      <p className="text-white font-semibold text-sm">
                        {selectedVehicle.latest_location.heading.toFixed(0)}°
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-slate-400 text-xs">Last Update</span>
                    </div>
                    <p className="text-white text-xs">
                      {new Date(selectedVehicle.latest_location.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
