import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Vehicle, GPSLocation } from '../lib/supabase';
import { Truck } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Trip {
  id: string;
  vehicle_id: string;
  driver_id: string;
  destination: string;
  status: string;
  departure_time: string;
  arrival_time: string;
}

interface Driver {
  id: string;
  name: string;
}

interface WorldMapProps {
  vehicles: (Vehicle & { latest_location?: GPSLocation })[];
  selectedVehicle: Vehicle & { latest_location?: GPSLocation } | null;
  onVehicleSelect: (vehicle: Vehicle & { latest_location?: GPSLocation }) => void;
  activeTrips: Trip[];
  getDriverById: (id: string) => Driver | undefined;
}

// Component to handle map centering on selected vehicle
function MapController({ selectedVehicle }: { selectedVehicle: Vehicle & { latest_location?: GPSLocation } | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedVehicle?.latest_location) {
      const { latitude, longitude } = selectedVehicle.latest_location;
      map.setView([latitude, longitude], 10);
    }
  }, [selectedVehicle, map]);

  return null;
}

// Custom vehicle icon creator
function createVehicleIcon(isSelected: boolean, isMoving: boolean) {
  const color = isSelected ? '#10b981' : '#3b82f6';
  const iconHtml = `
    <div style="
      width: 32px;
      height: 32px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ${isMoving ? 'animation: pulse 2s infinite;' : ''}
    ">
      <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
        <path d="M8.5 12.5h7l-1.5-3h-4l-1.5 3zm-1.5 1.5v3h2v-3h-2zm8 0v3h2v-3h-2zm-6-8h4l2 4h3l-2-4c-.39-.78-1.17-1.28-2.05-1.28h-4.9c-.88 0-1.66.5-2.05 1.28l-2 4h3l2-4z"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'custom-vehicle-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export default function WorldMap({
  vehicles,
  selectedVehicle,
  onVehicleSelect,
  activeTrips,
  getDriverById,
}: WorldMapProps) {
  // Memoize filtered vehicles to prevent unnecessary re-renders
  const vehiclesWithLocations = useMemo(
    () => vehicles.filter(v => v.latest_location),
    [vehicles]
  );

  return (
    <div className="relative w-full h-full bg-slate-900/50 rounded-xl" style={{ minHeight: '400px', height: '100%' }}>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        
        .custom-vehicle-marker {
          background: none !important;
          border: none !important;
        }
        
        .leaflet-container {
          width: 100%;
          height: 100%;
          border-radius: 0.75rem;
          z-index: 0;
          background: #1e293b;
        }
        
        .leaflet-tile-container {
          will-change: transform;
        }
        
        .leaflet-tile {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
        
        .leaflet-fade-anim .leaflet-tile {
          transition: opacity 0.2s;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .leaflet-control-zoom {
            margin-top: 10px !important;
            margin-right: 10px !important;
          }
          
          .leaflet-popup-content-wrapper {
            max-width: 250px !important;
          }
        }
        
        @media (max-width: 640px) {
          .custom-vehicle-marker {
            transform: scale(0.8);
          }
        }
      `}</style>

      <MapContainer
        // @ts-expect-error - center prop type
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
        className="border border-slate-700/50"
        preferCanvas={true}
        zoomAnimation={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // @ts-expect-error - attribution prop type
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
          minZoom={2}
          updateWhenIdle={false}
          updateWhenZooming={false}
          keepBuffer={2}
        />

        <MapController selectedVehicle={selectedVehicle} />

        {vehiclesWithLocations.map((vehicle) => {
          if (!vehicle.latest_location) return null;

          const { latitude, longitude, speed } = vehicle.latest_location;
          const vehicleTrip = activeTrips.find(trip => trip.vehicle_id === vehicle.id);
          const driver = vehicleTrip ? getDriverById(vehicleTrip.driver_id) : null;
          const isSelected = selectedVehicle?.id === vehicle.id;
          const isMoving = speed > 5;

          const customIcon = createVehicleIcon(isSelected, isMoving);
          
          return (
            <Marker
              key={vehicle.id}
              position={[latitude, longitude]}
              // @ts-expect-error - icon prop type
              icon={customIcon}
              eventHandlers={{
                click: () => onVehicleSelect(vehicle),
              }}
            >
              <Popup>
                <div style={{ minWidth: '200px', fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, color: '#10b981', fontSize: '14px', fontWeight: 'bold' }}>
                      {vehicle.name}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '11px' }}>
                      {vehicle.make} {vehicle.model}
                    </p>
                  </div>

                  {vehicleTrip && (
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '4px', padding: '6px', marginBottom: '8px' }}>
                      <p style={{ margin: 0, color: '#3b82f6', fontWeight: 500, fontSize: '11px' }}>
                        🎯 En route to: {vehicleTrip.destination}
                      </p>
                      {driver && (
                        <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '10px' }}>
                          Driver: {driver.name}
                        </p>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                    <div style={{ textAlign: 'center', padding: '6px', background: '#f8fafc', borderRadius: '4px' }}>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '9px', fontWeight: 500 }}>Speed</p>
                      <p style={{ margin: '2px 0 0 0', color: isMoving ? '#10b981' : '#64748b', fontWeight: 'bold', fontSize: '12px' }}>
                        {speed.toFixed(1)} km/h
                      </p>
                    </div>
                    <div style={{ textAlign: 'center', padding: '6px', background: '#f8fafc', borderRadius: '4px' }}>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '9px', fontWeight: 500 }}>Status</p>
                      <p style={{ margin: '2px 0 0 0', color: isMoving ? '#10b981' : '#64748b', fontWeight: 'bold', fontSize: '12px' }}>
                        {isMoving ? 'Moving' : 'Stopped'}
                      </p>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', padding: '6px', background: '#f1f5f9', borderRadius: '4px' }}>
                    <p style={{ margin: 0, color: '#475569', fontSize: '9px' }}>
                      Last update: {new Date(vehicle.latest_location.timestamp).toLocaleTimeString()}
                    </p>
                    <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '8px', fontFamily: 'monospace' }}>
                      {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* No vehicles message */}
      {vehiclesWithLocations.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl pointer-events-none">
          <div className="text-center">
            <Truck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Vehicles Available</h3>
            <p className="text-slate-400">Add vehicles with GPS data to see them on the map</p>
          </div>
        </div>
      )}

      {/* Map info - Responsive */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 z-10">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
          <Truck className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
          <span className="text-white font-medium">{vehiclesWithLocations.length}</span>
          <span className="text-slate-400 hidden sm:inline">vehicles tracked</span>
          <span className="text-slate-400 sm:hidden">vehicles</span>
        </div>
      </div>

      {/* Legend - Responsive */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-lg p-2 sm:p-3 z-10">
        <h4 className="text-white font-medium text-xs sm:text-sm mb-1.5 sm:mb-2">Legend</h4>
        <div className="space-y-0.5 sm:space-y-1 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></div>
            <span className="text-slate-300 text-xs">Normal</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-slate-300 text-xs">Selected</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-slate-300 text-xs">Moving</span>
          </div>
        </div>
      </div>
    </div>
  );
}
