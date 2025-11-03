import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents } from 'react-leaflet';
import { supabase, Geofence, Vehicle } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Plus, Edit2, Trash2, MapPin, AlertCircle, Check, X } from 'lucide-react';
import L from 'leaflet';

export default function Geofencing() {
  const { user } = useAuth();
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7128, -74.0060]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    zone_type: 'circle' as 'circle' | 'polygon',
    center_lat: 40.7128,
    center_lon: -74.0060,
    radius_meters: 1000,
    alert_on_enter: true,
    alert_on_exit: true,
    color: '#10b981',
  });

  useEffect(() => {
    loadGeofences();
    loadVehicles();
  }, [user]);

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
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const { data } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'active');
      
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingGeofence) {
        const { error } = await supabase
          .from('geofences')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingGeofence.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('geofences')
          .insert([{
            ...formData,
            user_id: user?.id,
          }]);

        if (error) throw error;
      }

      loadGeofences();
      resetForm();
    } catch (error) {
      console.error('Error saving geofence:', error);
      alert('Failed to save geofence');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this geofence?')) return;

    try {
      const { error } = await supabase
        .from('geofences')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadGeofences();
    } catch (error) {
      console.error('Error deleting geofence:', error);
      alert('Failed to delete geofence');
    }
  };

  const handleEdit = (geofence: Geofence) => {
    setEditingGeofence(geofence);
    setFormData({
      name: geofence.name,
      description: geofence.description || '',
      zone_type: geofence.zone_type,
      center_lat: geofence.center_lat || 40.7128,
      center_lon: geofence.center_lon || -74.0060,
      radius_meters: geofence.radius_meters || 1000,
      alert_on_enter: geofence.alert_on_enter,
      alert_on_exit: geofence.alert_on_exit,
      color: geofence.color,
    });
    setMapCenter([geofence.center_lat || 40.7128, geofence.center_lon || -74.0060]);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingGeofence(null);
    setFormData({
      name: '',
      description: '',
      zone_type: 'circle',
      center_lat: 40.7128,
      center_lon: -74.0060,
      radius_meters: 1000,
      alert_on_enter: true,
      alert_on_exit: true,
      color: '#10b981',
    });
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

  function MapClickHandler() {
    useMapEvents({
      click: (e) => {
        if (showForm) {
          setFormData(prev => ({
            ...prev,
            center_lat: e.latlng.lat,
            center_lon: e.latlng.lng,
          }));
        }
      },
    });
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Geofencing</h2>
          <p className="text-slate-400">Create zones and get alerts when vehicles enter or exit</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition font-medium"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showForm ? 'Cancel' : 'Create Geofence'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ height: '600px', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler />

              {geofences.map((geofence) => (
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
                        <p className="text-xs text-gray-500 mt-1">
                          Radius: {geofence.radius_meters}m
                        </p>
                      </div>
                    </Popup>
                  </Circle>
                )
              ))}

              {showForm && (
                <Circle
                  center={[formData.center_lat, formData.center_lon]}
                  radius={formData.radius_meters}
                  pathOptions={{
                    color: formData.color,
                    fillColor: formData.color,
                    fillOpacity: 0.3,
                    dashArray: '10, 10',
                  }}
                >
                  <Marker
                    position={[formData.center_lat, formData.center_lon]}
                    icon={L.divIcon({
                      className: 'custom-marker',
                      html: '<div style="background: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>',
                    })}
                  />
                </Circle>
              )}
            </MapContainer>
          </div>
        </div>

        <div className="space-y-4">
          {showForm && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {editingGeofence ? 'Edit Geofence' : 'New Geofence'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Radius (meters)
                  </label>
                  <input
                    type="number"
                    value={formData.radius_meters}
                    onChange={(e) => setFormData({ ...formData, radius_meters: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    min="100"
                    max="50000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full h-10 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.alert_on_enter}
                      onChange={(e) => setFormData({ ...formData, alert_on_enter: e.target.checked })}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    Alert on Enter
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.alert_on_exit}
                      onChange={(e) => setFormData({ ...formData, alert_on_exit: e.target.checked })}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    Alert on Exit
                  </label>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs text-blue-400">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Click on the map to set the center point
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-medium"
                  >
                    {editingGeofence ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Active Geofences</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {geofences.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No geofences created yet</p>
                </div>
              ) : (
                geofences.map((geofence) => (
                  <div
                    key={geofence.id}
                    className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: geofence.color }}
                          />
                          <h4 className="font-semibold text-white">{geofence.name}</h4>
                        </div>
                        {geofence.description && (
                          <p className="text-sm text-slate-400">{geofence.description}</p>
                        )}
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

                    <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                      <span>Radius: {geofence.radius_meters}m</span>
                      {geofence.alert_on_enter && (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Enter
                        </span>
                      )}
                      {geofence.alert_on_exit && (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Exit
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(geofence)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-xs transition"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(geofence.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs transition"
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
        </div>
      </div>
    </div>
  );
}
