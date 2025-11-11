import React, { useState, useEffect, useRef } from 'react';
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
  Route,
  Play,
  Pause
} from 'lucide-react';

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

const SimpleTracking: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehicleWithLocation[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Load vehicles and devices
  useEffect(() => {
    loadVehiclesAndDevices();
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    if (isTracking) {
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

      socketRef.current.on('gps_update', (data: any) => {
        console.log('GPS update received:', data);
        handleGPSUpdate(data);
        setLastUpdate(new Date());
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        setIsConnected(false);
      }
    };
  }, [isTracking]);

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

  const handleGPSUpdate = (data: any) => {
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
          track: [
            ...(vehicle.track || []).slice(-50), // Keep last 50 points
            {
              ...location,
              id: `${device_id}-${Date.now()}`,
              device_id
            }
          ]
        };
      }
      return vehicle;
    }));
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
      case 'active': return 'text-emerald-400 bg-emerald-500/20';
      case 'inactive': return 'text-red-400 bg-red-500/20';
      default: return 'text-amber-400 bg-amber-500/20';
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
            
            <button
              onClick={() => setIsTracking(!isTracking)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isTracking 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }`}
            >
              {isTracking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </button>
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
                    <div className={`px-2 py-1 rounded text-xs ${getStatusColor(vehicle.device?.status)}`}>
                      {vehicle.device?.status || 'unknown'}
                    </div>
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

        {/* Main Content */}
        <div className="flex-1 p-6">
          {selectedVehicleData ? (
            <div className="space-y-6">
              {/* Vehicle Header */}
              <div className="bg-slate-800/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedVehicleData.name}</h2>
                    <p className="text-slate-400">{selectedVehicleData.make} {selectedVehicleData.model} ({selectedVehicleData.year})</p>
                  </div>
                  <div className={`px-3 py-1 rounded-lg ${getStatusColor(selectedVehicleData.device?.status)}`}>
                    {selectedVehicleData.device?.status || 'unknown'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">License Plate:</span>
                    <p className="text-white font-medium">{selectedVehicleData.license_plate}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">VIN:</span>
                    <p className="text-white font-mono text-xs">{selectedVehicleData.vin}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Device ID:</span>
                    <p className="text-white font-mono text-xs">{selectedVehicleData.device?.device_id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Last Connection:</span>
                    <p className="text-white text-xs">
                      {selectedVehicleData.device?.last_connection 
                        ? new Date(selectedVehicleData.device.last_connection).toLocaleString()
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* GPS Data */}
              {selectedVehicleData.location ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Gauge className="w-5 h-5 text-blue-400" />
                      <span className="text-slate-400">Speed</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{formatSpeed(selectedVehicleData.location.speed)}</p>
                  </div>
                  
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Navigation className="w-5 h-5 text-green-400" />
                      <span className="text-slate-400">Heading</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{formatHeading(selectedVehicleData.location.heading)}</p>
                  </div>
                  
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Signal className="w-5 h-5 text-purple-400" />
                      <span className="text-slate-400">Accuracy</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{selectedVehicleData.location.accuracy}m</p>
                  </div>
                  
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span className="text-slate-400">Last Update</span>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {new Date(selectedVehicleData.location.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/50 rounded-lg p-8 text-center">
                  <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No GPS data available</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedVehicleData.device?.status === 'pending' 
                      ? 'Device is pending activation'
                      : 'Device may be offline or not configured'
                    }
                  </p>
                </div>
              )}

              {/* Location Details */}
              {selectedVehicleData.location && (
                <div className="bg-slate-800/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Location Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Latitude:</span>
                      <p className="text-white font-mono">{selectedVehicleData.location.latitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Longitude:</span>
                      <p className="text-white font-mono">{selectedVehicleData.location.longitude.toFixed(6)}</p>
                    </div>
                    {selectedVehicleData.location.altitude && (
                      <div>
                        <span className="text-slate-500">Altitude:</span>
                        <p className="text-white">{selectedVehicleData.location.altitude}m</p>
                      </div>
                    )}
                    {selectedVehicleData.location.battery && (
                      <div>
                        <span className="text-slate-500">Battery:</span>
                        <p className="text-white">{selectedVehicleData.location.battery}%</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-600/50">
                    <a
                      href={`https://www.google.com/maps?q=${selectedVehicleData.location.latitude},${selectedVehicleData.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-lg text-emerald-400 transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      View on Google Maps
                    </a>
                  </div>
                </div>
              )}

              {/* Track History */}
              {selectedVehicleData.track && selectedVehicleData.track.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Track History</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Route className="w-4 h-4" />
                      {selectedVehicleData.track.length} points
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedVehicleData.track.slice(-10).reverse().map((point, index) => (
                      <div key={point.id} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                        <div className="text-sm">
                          <span className="text-slate-400">#{selectedVehicleData.track!.length - index}</span>
                          <span className="ml-2 text-white">{formatSpeed(point.speed)}</span>
                          <span className="ml-2 text-slate-400">{formatHeading(point.heading)}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(point.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Car className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-400 mb-2">Select a Vehicle</h2>
                <p className="text-slate-500">Choose a vehicle from the sidebar to view its GPS tracking data</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleTracking;
