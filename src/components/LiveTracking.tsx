import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import { io, Socket } from 'socket.io-client';
import { 
  Navigation, 
  Gauge, 
  Clock, 
  Battery, 
  Signal,
  Car,
  MapPin,
  Route
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GPSLocation {
  id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  altitude?: number;
  battery?: number;
  timestamp: string;
}

interface Vehicle {
  id: string;
  name: string;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
}

interface GPSDevice {
  id: string;
  device_id: string;
  vehicle_id: string;
  status: 'active' | 'inactive' | 'pending';
  last_connection: string;
}

interface VehicleWithLocation extends Vehicle {
  device?: GPSDevice;
  location?: GPSLocation;
  track?: GPSLocation[];
}

// Custom car icon
const createCarIcon = (heading: number, isActive: boolean) => {
  const color = isActive ? '#10b981' : '#6b7280';
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(${heading} 16 16)">
          <path d="M16 4 L20 12 L28 12 L28 20 L24 20 L24 24 L20 24 L20 20 L12 20 L12 24 L8 24 L8 20 L4 20 L4 12 L12 12 Z" 
                fill="${color}" stroke="#fff" stroke-width="1"/>
          <circle cx="10" cy="18" r="2" fill="#333"/>
          <circle cx="22" cy="18" r="2" fill="#333"/>
          <path d="M16 4 L18 8 L14 8 Z" fill="#fff"/>
        </g>
      </svg>
    `)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

// Map component to handle real-time updates
const MapUpdater: React.FC<{ vehicles: VehicleWithLocation[], selectedVehicle?: string }> = ({ 
  vehicles, 
  selectedVehicle 
}) => {
  const map = useMap();

  useEffect(() => {
    if (selectedVehicle) {
      const vehicle = vehicles.find(v => v.id === selectedVehicle);
      if (vehicle?.location) {
        map.setView([vehicle.location.latitude, vehicle.location.longitude], 16);
      }
    } else if (vehicles.length > 0) {
      // Fit map to show all vehicles
      const bounds = vehicles
        .filter(v => v.location)
        .map(v => [v.location!.latitude, v.location!.longitude] as [number, number]);
      
      if (bounds.length > 0) {
        (map as any).fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [map, vehicles, selectedVehicle]);

  return null;
};

const LiveTracking: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehicleWithLocation[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [showTracks, setShowTracks] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Load vehicles and devices
  useEffect(() => {
    loadVehiclesAndDevices();
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    const GPS_SERVER_URL = import.meta.env.VITE_GPS_SERVER_URL || 'https://fleet-admin.onrender.com';
    
    socketRef.current = io(GPS_SERVER_URL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to GPS server');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from GPS server');
      setIsConnected(false);
    });

    socketRef.current.on('gps_update', (data: { device_id: string; location: GPSLocation; timestamp: string }) => {
      console.log('GPS update received:', data);
      handleGPSUpdate(data);
      setLastUpdate(new Date());
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const loadVehiclesAndDevices = async () => {
    try {
      // Load vehicles
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .order('name');

      if (vehiclesError) throw vehiclesError;

      // Load GPS devices
      const { data: devicesData, error: devicesError } = await supabase
        .from('gps_devices')
        .select('*');

      if (devicesError) throw devicesError;

      // Load latest GPS locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('gps_locations')
        .select('*')
        .order('timestamp', { ascending: false });

      if (locationsError) throw locationsError;

      // Combine data
      const vehiclesWithData: VehicleWithLocation[] = vehiclesData.map(vehicle => {
        const device = devicesData.find(d => d.vehicle_id === vehicle.id);
        const location = device ? locationsData.find(l => l.device_id === device.device_id) : undefined;
        
        return {
          ...vehicle,
          device,
          location
        };
      });

      setVehicles(vehiclesWithData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleGPSUpdate = useCallback((data: { device_id: string; location: GPSLocation; timestamp: string }) => {
    const { device_id, location } = data;
    
    setVehicles(prev => prev.map(vehicle => {
      if (vehicle.device?.device_id === device_id) {
        return {
          ...vehicle,
          location: {
            ...location,
            id: `${device_id}-${Date.now()}`,
            device_id
          },
          track: showTracks ? [
            ...(vehicle.track || []).slice(-50), // Keep last 50 points
            {
              ...location,
              id: `${device_id}-${Date.now()}`,
              device_id
            }
          ] : []
        };
      }
      return vehicle;
    }));
  };

  const loadTrackHistory = async (deviceId: string) => {
    try {
      const { data, error } = await supabase
        .from('gps_locations')
        .select('*')
        .eq('device_id', deviceId)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('timestamp', { ascending: true });

      if (error) throw error;

      setVehicles(prev => prev.map(vehicle => {
        if (vehicle.device?.device_id === deviceId) {
          return {
            ...vehicle,
            track: data
          };
        }
        return vehicle;
      }));
    } catch (error) {
      console.error('Error loading track history:', error);
    }
  };

  const formatSpeed = (speed: number) => {
    return `${Math.round(speed * 3.6)} km/h`; // Convert m/s to km/h
  };

  const formatHeading = (heading: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return `${Math.round(heading)}° ${directions[index]}`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400';
      case 'inactive': return 'text-red-400';
      default: return 'text-amber-400';
    }
  };

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold">Live GPS Tracking</h1>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
              isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <div className="text-sm text-slate-400">
                Last update: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showTracks}
                onChange={(e) => setShowTracks(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Show Tracks</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-80 bg-slate-800/30 border-r border-slate-700/50 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Vehicles ({vehicles.length})</h2>
            
            <div className="space-y-3">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  onClick={() => setSelectedVehicle(vehicle.id === selectedVehicle ? '' : vehicle.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedVehicle === vehicle.id
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      <span className="font-medium">{vehicle.name}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      vehicle.device?.status === 'active' ? 'bg-emerald-400' : 
                      vehicle.device?.status === 'inactive' ? 'bg-red-400' : 'bg-amber-400'
                    }`} />
                  </div>
                  
                  <div className="text-sm text-slate-400 space-y-1">
                    <div>{vehicle.make} {vehicle.model} ({vehicle.year})</div>
                    <div>{vehicle.license_plate}</div>
                    
                    {vehicle.location && (
                      <div className="mt-2 pt-2 border-t border-slate-600/50">
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <Gauge className="w-3 h-3" />
                            {formatSpeed(vehicle.location.speed)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Navigation className="w-3 h-3" />
                            {formatHeading(vehicle.location.heading)}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {new Date(vehicle.location.timestamp).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={[33.5731, -7.5898]} // Default to Casablanca
            zoom={13}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapUpdater vehicles={vehicles} selectedVehicle={selectedVehicle} />
            
            {vehicles.map((vehicle) => {
              if (!vehicle.location) return null;
              
              const isActive = vehicle.device?.status === 'active';
              
              return (
                <React.Fragment key={vehicle.id}>
                  {/* Vehicle marker */}
                  <Marker
                    position={[vehicle.location.latitude, vehicle.location.longitude]}
                    icon={createCarIcon(vehicle.location.heading, isActive)}
                  >
                    <Popup>
                      <div className="text-slate-900">
                        <div className="font-semibold">{vehicle.name}</div>
                        <div className="text-sm space-y-1">
                          <div>{vehicle.make} {vehicle.model}</div>
                          <div>{vehicle.license_plate}</div>
                          <div className="flex items-center gap-2">
                            <Gauge className="w-3 h-3" />
                            {formatSpeed(vehicle.location.speed)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Navigation className="w-3 h-3" />
                            {formatHeading(vehicle.location.heading)}
                          </div>
                          <div className="text-xs text-slate-600">
                            {new Date(vehicle.location.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                  
                  {/* Track history */}
                  {showTracks && vehicle.track && vehicle.track.length > 1 && (
                    <Polyline
                      positions={vehicle.track.map(point => [point.latitude, point.longitude])}
                      color={isActive ? "#10b981" : "#6b7280"}
                      weight={3}
                      opacity={0.7}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </MapContainer>
          
          {/* Vehicle details panel */}
          {selectedVehicleData && selectedVehicleData.location && (
            <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4 w-80">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{selectedVehicleData.name}</h3>
                <div className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedVehicleData.device?.status)}`}>
                  {selectedVehicleData.device?.status || 'unknown'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-slate-400">Speed</div>
                    <div className="font-medium">{formatSpeed(selectedVehicleData.location.speed)}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-green-400" />
                  <div>
                    <div className="text-slate-400">Heading</div>
                    <div className="font-medium">{formatHeading(selectedVehicleData.location.heading)}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Signal className="w-4 h-4 text-purple-400" />
                  <div>
                    <div className="text-slate-400">Accuracy</div>
                    <div className="font-medium">{selectedVehicleData.location.accuracy}m</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="text-slate-400">Last Update</div>
                    <div className="font-medium text-xs">
                      {new Date(selectedVehicleData.location.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedVehicleData.location.battery && (
                <div className="mt-3 pt-3 border-t border-slate-600/50">
                  <div className="flex items-center gap-2">
                    <Battery className="w-4 h-4 text-green-400" />
                    <div className="text-sm">
                      <span className="text-slate-400">Battery: </span>
                      <span className="font-medium">{selectedVehicleData.location.battery}%</span>
                    </div>
                  </div>
                </div>
              )}
              
              <button
                onClick={() => loadTrackHistory(selectedVehicleData.device!.device_id)}
                className="mt-3 w-full px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-lg text-emerald-400 text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Route className="w-4 h-4" />
                Load 24h Track
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;
