import { useEffect, useRef, useState } from 'react';
import { Vehicle, GPSLocation } from '../lib/supabase';
import { Truck } from 'lucide-react';

// Import Leaflet CSS
const LEAFLET_CSS = `
  @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
  
  .leaflet-container {
    height: 100%;
    width: 100%;
    border-radius: 12px;
  }
  
  .custom-marker {
    background: none;
    border: none;
  }
  
  .vehicle-marker {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    cursor: pointer;
  }
  
  .vehicle-marker:hover {
    transform: scale(1.1);
  }
  
  .vehicle-marker.selected {
    transform: scale(1.2);
    box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
  }
  
  .vehicle-marker.moving::after {
    content: '';
    position: absolute;
    top: -2px;
    right: -2px;
    width: 12px;
    height: 12px;
    background: #10b981;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
    100% { opacity: 1; transform: scale(1); }
  }
  
  .leaflet-popup-content-wrapper {
    background: rgba(30, 41, 59, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 12px;
    color: white;
  }
  
  .leaflet-popup-tip {
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(71, 85, 105, 0.5);
  }
`;

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

interface RealWorldMapProps {
  vehicles: (Vehicle & { latest_location?: GPSLocation })[];
  selectedVehicle: Vehicle & { latest_location?: GPSLocation } | null;
  onVehicleSelect: (vehicle: Vehicle & { latest_location?: GPSLocation }) => void;
  activeTrips: Trip[];
  getDriverById: (id: string) => Driver | undefined;
}

interface LeafletMapOptions {
  animate?: boolean;
  duration?: number;
}

interface LeafletMap {
  setView: (center: [number, number], zoom: number, options?: LeafletMapOptions) => void;
  addLayer: (layer: LeafletMarker | LeafletTileLayer) => void;
  removeLayer: (layer: LeafletMarker | LeafletTileLayer) => void;
  getZoom: () => number;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface LeafletTileLayer {
  addTo: (map: LeafletMap) => LeafletTileLayer;
}

interface LeafletControl {
  onAdd: (map: LeafletMap) => HTMLElement;
  addTo: (map: LeafletMap) => LeafletControl;
}

interface LeafletIcon {
  html: string;
  className: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
}

interface LeafletMarker {
  bindPopup: (content: string) => void;
  openPopup: () => void;
  on: (event: string, handler: () => void) => void;
}

interface LeafletMapInitOptions {
  center: [number, number];
  zoom: number;
  zoomControl: boolean;
}

interface LeafletTileLayerOptions {
  attribution: string;
  maxZoom: number;
}

interface LeafletMarkerOptions {
  icon: LeafletIcon;
}

interface LeafletControlOptions {
  position: string;
}

interface LeafletLibrary {
  map: (element: HTMLElement, options: LeafletMapInitOptions) => LeafletMap;
  tileLayer: (url: string, options: LeafletTileLayerOptions) => LeafletTileLayer;
  marker: (position: [number, number], options: LeafletMarkerOptions) => LeafletMarker;
  divIcon: (options: LeafletIcon) => LeafletIcon;
  control: (options: LeafletControlOptions) => LeafletControl;
  DomUtil: {
    create: (tag: string, className: string) => HTMLElement;
  };
}

declare global {
  interface Window {
    L: LeafletLibrary;
  }
}

export default function RealWorldMap({ 
  vehicles, 
  selectedVehicle, 
  onVehicleSelect, 
  activeTrips, 
  getDriverById 
}: RealWorldMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [markers, setMarkers] = useState<LeafletMarker[]>([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapCenter] = useState<[number, number]>([24.7136, 46.6753]); // Riyadh, Saudi Arabia
  const [mapZoom] = useState(10);

  // Load Leaflet library and CSS
  useEffect(() => {
    if (leafletLoaded) return;

    // Add CSS
    const style = document.createElement('style');
    style.textContent = LEAFLET_CSS;
    document.head.appendChild(style);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(style);
      document.head.removeChild(script);
    };
  }, [leafletLoaded]);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || map) return;

    const L = window.L;
    
    const mapInstance = L.map(mapRef.current, {
      center: mapCenter,
      zoom: mapZoom,
      zoomControl: false,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapInstance);

    // Add custom controls
    const customControls = L.control({ position: 'topright' });
    customControls.onAdd = function() {
      const div = L.DomUtil.create('div', 'custom-controls');
      div.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <button id="zoom-in" style="padding: 8px; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 6px; color: white; cursor: pointer;">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
          </button>
          <button id="zoom-out" style="padding: 8px; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 6px; color: white; cursor: pointer;">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6"/>
            </svg>
          </button>
          <button id="reset-view" style="padding: 8px; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 6px; color: white; cursor: pointer;">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      `;
      return div;
    };
    customControls.addTo(mapInstance);

    // Add event listeners for custom controls
    setTimeout(() => {
      const zoomInBtn = document.getElementById('zoom-in');
      const zoomOutBtn = document.getElementById('zoom-out');
      const resetViewBtn = document.getElementById('reset-view');

      if (zoomInBtn) zoomInBtn.onclick = () => mapInstance.zoomIn();
      if (zoomOutBtn) zoomOutBtn.onclick = () => mapInstance.zoomOut();
      if (resetViewBtn) resetViewBtn.onclick = () => {
        mapInstance.setView(mapCenter, mapZoom);
      };
    }, 100);

    setMap(mapInstance);
  }, [leafletLoaded, mapCenter, mapZoom, map]);

  // Update vehicle markers
  useEffect(() => {
    if (!map || !leafletLoaded || !vehicles.length) return;

    const L = window.L;

    // Clear existing markers
    markers.forEach(marker => {
      map.removeLayer(marker);
    });

    const newMarkers: LeafletMarker[] = [];

    vehicles.forEach((vehicle) => {
      if (!vehicle.latest_location) return;

      const { latitude, longitude, speed } = vehicle.latest_location;
      const vehicleTrip = activeTrips.find(trip => trip.vehicle_id === vehicle.id);
      const driver = vehicleTrip ? getDriverById(vehicleTrip.driver_id) : null;
      const isSelected = selectedVehicle?.id === vehicle.id;
      const isMoving = speed > 5;

      // Create custom marker
      const markerHtml = `
        <div class="vehicle-marker ${isSelected ? 'selected' : ''} ${isMoving ? 'moving' : ''}" 
             style="background: ${isSelected ? '#10b981' : '#3b82f6'};">
          <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
            <path d="M8.5 12.5h7l-1.5-3h-4l-1.5 3zm-1.5 1.5v3h2v-3h-2zm8 0v3h2v-3h-2zm-6-8h4l2 4h3l-2-4c-.39-.78-1.17-1.28-2.05-1.28h-4.9c-.88 0-1.66.5-2.05 1.28l-2 4h3l2-4z"/>
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([latitude, longitude], { icon: customIcon });

      // Create popup content
      const popupContent = `
        <div style="min-width: 200px; padding: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="background: ${isSelected ? '#10b981' : '#3b82f6'}; padding: 6px; border-radius: 6px;">
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                <path d="M8.5 12.5h7l-1.5-3h-4l-1.5 3zm-1.5 1.5v3h2v-3h-2zm8 0v3h2v-3h-2zm-6-8h4l2 4h3l-2-4c-.39-.78-1.17-1.28-2.05-1.28h-4.9c-.88 0-1.66.5-2.05 1.28l-2 4h3l2-4z"/>
              </svg>
            </div>
            <div>
              <h3 style="margin: 0; color: #10b981; font-weight: bold;">${vehicle.name}</h3>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">${vehicle.make} ${vehicle.model}</p>
            </div>
          </div>
          
          ${vehicleTrip ? `
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px; padding: 8px; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <svg width="14" height="14" fill="#3b82f6" viewBox="0 0 24 24">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span style="color: #3b82f6; font-weight: 500; font-size: 12px;">En route to ${vehicleTrip.destination}</span>
              </div>
              ${driver ? `<p style="margin: 0; color: #94a3b8; font-size: 11px;">Driver: ${driver.name}</p>` : ''}
            </div>
          ` : ''}
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div style="text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 10px;">Speed</p>
              <p style="margin: 0; color: ${isMoving ? '#10b981' : '#94a3b8'}; font-weight: bold;">${speed.toFixed(1)} km/h</p>
            </div>
            <div style="text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 10px;">Status</p>
              <p style="margin: 0; color: ${isMoving ? '#10b981' : '#94a3b8'}; font-weight: bold;">${isMoving ? 'Moving' : 'Stopped'}</p>
            </div>
          </div>
          
          <div style="text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 10px;">
              Last update: ${new Date(vehicle.latest_location.timestamp).toLocaleTimeString()}
            </p>
            <p style="margin: 0; color: #64748b; font-size: 10px; font-family: monospace;">
              ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
            </p>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Add click event
      marker.on('click', () => {
        onVehicleSelect(vehicle);
      });

      // Auto-open popup for selected vehicle
      if (isSelected) {
        marker.openPopup();
      }

      map.addLayer(marker);
      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
  }, [map, leafletLoaded, vehicles, selectedVehicle, activeTrips, getDriverById, onVehicleSelect, markers]);

  // Auto-center map when vehicle is selected
  useEffect(() => {
    if (map && selectedVehicle?.latest_location) {
      const { latitude, longitude } = selectedVehicle.latest_location;
      map.setView([latitude, longitude], Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 1
      });
    }
  }, [map, selectedVehicle]);

  if (!leafletLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900/50 rounded-xl border border-slate-700/50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading World Map...</p>
          <p className="text-slate-500 text-sm mt-1">جاري تحميل خريطة العالم...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-xl border border-slate-700/50" />
      
      {/* Map Info */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Truck className="w-4 h-4 text-emerald-400" />
          <span className="text-white font-medium">{vehicles.length}</span>
          <span className="text-slate-400">vehicles tracked</span>
        </div>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3">
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
    </div>
  );
}
