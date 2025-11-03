import { useState, useEffect } from 'react';
import { supabase, Vehicle } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Navigation, Gauge, Crosshair, Save, AlertCircle } from 'lucide-react';

export default function AddGPSLocation() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: '',
    latitude: '',
    longitude: '',
    speed: '',
    heading: '',
    accuracy: '10',
  });

  useEffect(() => {
    loadVehicles();
  }, [user]);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setVehicles(data || []);
      
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, vehicle_id: data[0].id }));
      }
    } catch (err) {
      console.error('Error loading vehicles:', err);
      setError('Failed to load vehicles');
    }
  };

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(8),
          longitude: position.coords.longitude.toFixed(8),
          accuracy: position.coords.accuracy.toFixed(2),
          speed: position.coords.speed ? (position.coords.speed * 3.6).toFixed(2) : prev.speed,
          heading: position.coords.heading ? position.coords.heading.toFixed(2) : prev.heading,
        }));
        setGettingLocation(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      },
      (err) => {
        setError(`Location error: ${err.message}`);
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!formData.vehicle_id) {
        throw new Error('Please select a vehicle');
      }

      if (!formData.latitude || !formData.longitude) {
        throw new Error('Latitude and Longitude are required');
      }

      const { error: insertError } = await supabase
        .from('gps_locations')
        .insert([
          {
            vehicle_id: formData.vehicle_id,
            latitude: parseFloat(formData.latitude),
            longitude: parseFloat(formData.longitude),
            speed: formData.speed ? parseFloat(formData.speed) : 0,
            heading: formData.heading ? parseFloat(formData.heading) : 0,
            accuracy: formData.accuracy ? parseFloat(formData.accuracy) : 10,
            timestamp: new Date().toISOString(),
          },
        ]);

      if (insertError) throw insertError;

      setSuccess(true);
      setFormData(prev => ({
        ...prev,
        latitude: '',
        longitude: '',
        speed: '',
        heading: '',
        accuracy: '10',
      }));

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to add GPS location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Add GPS Location</h2>
        <p className="text-slate-400">Manually add GPS coordinates for your vehicles</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Vehicle Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Select Vehicle *
              </label>
              <select
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                required
              >
                <option value="">Choose a vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} - {vehicle.license_plate}
                  </option>
                ))}
              </select>
            </div>

            {/* Get Current Location Button */}
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={gettingLocation}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Crosshair className={`w-5 h-5 ${gettingLocation ? 'animate-spin' : ''}`} />
              {gettingLocation ? 'Getting Location...' : 'Use My Current Location'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800/50 text-slate-400">Or enter manually</span>
              </div>
            </div>

            {/* Latitude */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Latitude *
              </label>
              <input
                type="number"
                step="0.00000001"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="40.7128"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Longitude *
              </label>
              <input
                type="number"
                step="0.00000001"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="-74.0060"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            {/* Speed */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Gauge className="w-4 h-4 inline mr-1" />
                Speed (km/h)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.speed}
                onChange={(e) => setFormData({ ...formData, speed: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Heading */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Navigation className="w-4 h-4 inline mr-1" />
                Heading (degrees)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="360"
                value={formData.heading}
                onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Accuracy */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Accuracy (meters)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.accuracy}
                onChange={(e) => setFormData({ ...formData, accuracy: e.target.value })}
                placeholder="10"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/50 rounded-lg text-emerald-400">
                <Save className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">GPS location added successfully!</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Adding...' : 'Add GPS Location'}
            </button>
          </form>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">How to Use</h3>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold">
                  1
                </div>
                <p>Select the vehicle you want to track</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold">
                  2
                </div>
                <p>Click "Use My Current Location" to get GPS from your device, or enter coordinates manually</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold">
                  3
                </div>
                <p>Add speed and heading if available</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold">
                  4
                </div>
                <p>Click "Add GPS Location" to save</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold">
                  5
                </div>
                <p>Go to GPS & Zones page to see the vehicle on the map</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-3">Tips</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span>Use your phone's GPS for accurate real-time location</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span>You can find coordinates from Google Maps</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span>Speed is optional but helps with tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span>Location updates appear instantly on the map</span>
              </li>
            </ul>
          </div>

          {vehicles.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-3">No Vehicles Found</h3>
              <p className="text-sm text-slate-300 mb-3">
                You need to add vehicles first before you can track their GPS locations.
              </p>
              <p className="text-sm text-slate-400">
                Go to the Vehicles page to add your first vehicle.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
