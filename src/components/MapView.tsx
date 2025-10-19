import { useEffect, useRef, useState } from 'react';
import { Vehicle, GPSLocation } from '../lib/supabase';
import { MapPin, Navigation, Truck } from 'lucide-react';

interface Trip {
  id: string;
  vehicle_id: string;
  driver_id: string;
  destination: string;
  status: string;
}

interface Driver {
  id: string;
  name: string;
}

interface MapViewProps {
  vehicles: (Vehicle & { latest_location?: GPSLocation })[];
  selectedVehicle: Vehicle & { latest_location?: GPSLocation } | null;
  onVehicleSelect: (vehicle: Vehicle & { latest_location?: GPSLocation }) => void;
  activeTrips: Trip[];
  getDriverById: (id: string) => Driver | undefined;
}

export default function MapView({ vehicles, selectedVehicle, onVehicleSelect, activeTrips, getDriverById }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<HTMLDivElement | null>(null);
  const [markers, setMarkers] = useState<HTMLDivElement[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    const currentMapRef = mapRef.current;
    if (!currentMapRef) return;

    // Clean up old map if exists
    currentMapRef.innerHTML = '';

    // Create map container
    const mapContainer = document.createElement('div');
    mapContainer.style.width = '100%';
    mapContainer.style.height = '100%';
    mapContainer.style.borderRadius = '12px';
    mapContainer.style.overflow = 'hidden';
    currentMapRef.appendChild(mapContainer);

    // Initialize with a simple coordinate system (coordinates for reference only)
    
    // Create a simple map visualization
    mapContainer.style.background = `
      radial-gradient(circle at 30% 20%, rgba(34, 197, 94, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 70% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
      linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)
    `;
    mapContainer.style.position = 'relative';

    // Add grid overlay for map-like appearance
    const gridOverlay = document.createElement('div');
    gridOverlay.style.position = 'absolute';
    gridOverlay.style.top = '0';
    gridOverlay.style.left = '0';
    gridOverlay.style.width = '100%';
    gridOverlay.style.height = '100%';
    gridOverlay.style.backgroundImage = `
      linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
    `;
    gridOverlay.style.backgroundSize = '50px 50px';
    gridOverlay.style.pointerEvents = 'none';
    mapContainer.appendChild(gridOverlay);

    setMap(mapContainer);
    setMapLoaded(true);
    
    // Cleanup on unmount
    return () => {
      if (currentMapRef) {
        currentMapRef.innerHTML = '';
      }
      setMap(null);
      setMapLoaded(false);
    };
  }, []);

  // Update vehicle markers
  useEffect(() => {
    if (!map || !vehicles.length) return;

    // Clear existing markers
    markers.forEach(marker => {
      if (marker.parentNode) {
        marker.parentNode.removeChild(marker);
      }
    });

    const newMarkers: HTMLDivElement[] = [];

    vehicles.forEach((vehicle, index) => {
      if (!vehicle.latest_location) return;

      // Create marker element
      const marker = document.createElement('div') as HTMLDivElement;
      marker.style.position = 'absolute';
      marker.style.cursor = 'pointer';
      marker.style.zIndex = selectedVehicle?.id === vehicle.id ? '1000' : '100';
      
      // Calculate position (simulate GPS coordinates to screen position)
      const x = 20 + (index * 80) % (map.offsetWidth - 100);
      const y = 20 + Math.floor(index / Math.floor((map.offsetWidth - 100) / 80)) * 80;
      
      marker.style.left = `${x}px`;
      marker.style.top = `${y}px`;
      marker.style.transform = 'translate(-50%, -50%)';

      // Get trip info
      const vehicleTrip = activeTrips.find(trip => trip.vehicle_id === vehicle.id);
      const driver = vehicleTrip ? getDriverById(vehicleTrip.driver_id) : null;

      // Create marker content
      marker.innerHTML = `
        <div class="relative group">
          <div class="flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
            selectedVehicle?.id === vehicle.id 
              ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 scale-110' 
              : 'bg-blue-500 hover:bg-blue-400 shadow-lg'
          }">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
          </div>
          
          <!-- Tooltip -->
          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div class="bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-48">
              <div class="font-semibold text-emerald-400 mb-1">${vehicle.name}</div>
              <div class="text-slate-300 mb-1">${vehicle.make} ${vehicle.model}</div>
              ${vehicleTrip ? `
                <div class="text-blue-400 text-xs mb-1">
                  <span class="inline-flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    En route to ${vehicleTrip.destination}
                  </span>
                </div>
                ${driver ? `<div class="text-slate-400 text-xs">Driver: ${driver.name}</div>` : ''}
              ` : ''}
              <div class="text-slate-400 text-xs mt-1">
                Speed: ${vehicle.latest_location.speed.toFixed(1)} km/h
              </div>
              <div class="text-slate-500 text-xs">
                ${new Date(vehicle.latest_location.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
          
          <!-- Movement indicator -->
          ${vehicle.latest_location.speed > 5 ? `
            <div class="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          ` : ''}
        </div>
      `;

      // Add click handler
      marker.addEventListener('click', () => {
        onVehicleSelect(vehicle);
      });

      map.appendChild(marker);
      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, vehicles, selectedVehicle, activeTrips, getDriverById, onVehicleSelect]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-xl border border-slate-700/50 bg-slate-900/50">
        {!mapLoaded && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto mb-4"></div>
              <p className="text-slate-400">Loading Map...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button className="p-2 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-lg text-white hover:bg-slate-700/80 transition">
          <MapPin className="w-4 h-4" />
        </button>
        <button className="p-2 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-lg text-white hover:bg-slate-700/80 transition">
          <Navigation className="w-4 h-4" />
        </button>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3">
        <h4 className="text-white font-medium text-sm mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-slate-300">Vehicle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-slate-300">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-slate-300">Moving</span>
          </div>
        </div>
      </div>

      {/* Vehicle Count */}
      <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Truck className="w-4 h-4 text-emerald-400" />
          <span className="text-white font-medium">{vehicles.length}</span>
          <span className="text-slate-400">vehicles tracked</span>
        </div>
      </div>
    </div>
  );
}
