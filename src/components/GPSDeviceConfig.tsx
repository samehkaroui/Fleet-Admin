import { useState, useEffect, useCallback } from 'react';
import { supabase, Vehicle } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Smartphone, Wifi, Server, Copy, Check, AlertCircle, Info, Play } from 'lucide-react';

interface GPSDevice {
  id: string;
  vehicle_id: string;
  device_id: string;
  device_type: string;
  imei: string;
  phone_number: string;
  status: 'active' | 'inactive' | 'pending';
  last_connection: string | null;
  created_at: string;
}

export default function GPSDeviceConfig() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [devices, setDevices] = useState<GPSDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown');
  const [copied, setCopied] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    device_id: '',
    device_type: 'GT06',
    imei: '',
    phone_number: '',
  });

  // Server configuration
  const serverIP = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
  const serverPort = '5023';
  const httpPort = '3001';

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setVehicles(data || []);
    } catch (err) {
      console.error('Error loading vehicles:', err);
    }
  };

  const loadDevices = async () => {
    try {
      // Create table if not exists
      await supabase.rpc('create_gps_devices_table', {});
      
      const { data, error } = await supabase
        .from('gps_devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && error.code !== '42P01') { // Ignore table not found
        console.error('Error loading devices:', error);
      } else {
        setDevices(data || []);
      }
    } catch (err) {
      console.error('Error loading devices:', err);
    }
  };

  const checkServerStatus = useCallback(async () => {
    try {
      const response = await fetch(`http://${serverIP}:${httpPort}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      
      if (response.ok) {
        setServerStatus('running');
      } else {
        setServerStatus('stopped');
      }
    } catch {
      setServerStatus('stopped');
    }
  }, [serverIP, httpPort]);

  useEffect(() => {
    loadVehicles();
    loadDevices();
    checkServerStatus();
  }, [checkServerStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.vehicle_id || !formData.device_id) {
        throw new Error('Vehicle and Device ID are required');
      }

      // Insert device configuration
      const { error: insertError } = await supabase
        .from('gps_devices')
        .insert([
          {
            vehicle_id: formData.vehicle_id,
            device_id: formData.device_id,
            device_type: formData.device_type,
            imei: formData.imei,
            phone_number: formData.phone_number,
            status: 'pending',
            user_id: user?.id,
          },
        ]);

      if (insertError) throw insertError;

      setSuccess('GPS device configured successfully!');
      setShowForm(false);
      setFormData({
        vehicle_id: '',
        device_id: '',
        device_type: 'GT06',
        imei: '',
        phone_number: '',
      });
      
      loadDevices();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to configure device');
    } finally {
      setLoading(false);
    }
  };

  const deleteDevice = async (id: string) => {
    if (!confirm('Delete this GPS device configuration?')) return;

    try {
      const { error } = await supabase
        .from('gps_devices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadDevices();
      setSuccess('Device deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to delete device');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? vehicle.name : 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">GPS Device Configuration</h2>
          <p className="text-slate-400">Configure GPS trackers for automatic vehicle tracking</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition font-medium"
        >
          <Smartphone className="w-5 h-5" />
          {showForm ? 'Cancel' : 'Add GPS Device'}
        </button>
      </div>

      {/* Server Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">GPS Server Status</span>
            <button
              onClick={checkServerStatus}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              Refresh
            </button>
          </div>
          <div className="flex items-center gap-2">
            {serverStatus === 'running' ? (
              <>
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-white font-semibold">Running</span>
              </>
            ) : serverStatus === 'stopped' ? (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-white font-semibold">Stopped</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span className="text-white font-semibold">Checking...</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-blue-400" />
            <span className="text-slate-400 text-sm">Server IP</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white font-mono text-sm">{serverIP}</span>
            <button
              onClick={() => copyToClipboard(serverIP, 'ip')}
              className="p-1 hover:bg-slate-700 rounded"
            >
              {copied === 'ip' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-4 h-4 text-purple-400" />
            <span className="text-slate-400 text-sm">TCP Port</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white font-mono text-sm">{serverPort}</span>
            <button
              onClick={() => copyToClipboard(serverPort, 'port')}
              className="p-1 hover:bg-slate-700 rounded"
            >
              {copied === 'port' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Server Instructions */}
      {serverStatus === 'stopped' && (
        <div className="bg-amber-500/10 border border-amber-500/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-amber-400 font-semibold mb-2">GPS Server Not Running</h3>
              <p className="text-sm text-slate-300 mb-3">
                To receive data from GPS devices, you need to start the GPS server.
              </p>
             
            </div>
          </div>
        </div>
      )}

      {/* Add Device Form */}
      {showForm && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Add GPS Device</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Device Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Device Type *
                </label>
                <select
                  value={formData.device_type}
                  onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="GT06">GT06 / Concox</option>
                  <option value="TK103">TK103</option>
                  <option value="Teltonika">Teltonika</option>
                  <option value="Queclink">Queclink</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Device ID */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Device ID *
                </label>
                <input
                  type="text"
                  value={formData.device_id}
                  onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                  placeholder="DEVICE_001"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Unique identifier for this device</p>
              </div>

              {/* IMEI */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  IMEI Number
                </label>
                <input
                  type="text"
                  value={formData.imei}
                  onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                  placeholder="123456789012345"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">15-digit device IMEI</p>
              </div>

              {/* Phone Number */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  SIM Card Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="+1234567890"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">Phone number of SIM card in device</p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-medium disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add GPS Device'}
            </button>
          </form>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/50 rounded-lg text-emerald-400">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Configured Devices */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Configured GPS Devices</h3>
        
        {devices.length === 0 ? (
          <div className="text-center py-8">
            <Smartphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No GPS devices configured yet</p>
            <p className="text-sm text-slate-500 mt-1">Add your first GPS device to start tracking</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-white">{getVehicleName(device.vehicle_id)}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        device.status === 'active' 
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : device.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {device.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Device Type:</span>
                        <p className="text-slate-300 font-medium">{device.device_type}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Device ID:</span>
                        <p className="text-slate-300 font-mono text-xs">{device.device_id}</p>
                      </div>
                      {device.imei && (
                        <div>
                          <span className="text-slate-500">IMEI:</span>
                          <p className="text-slate-300 font-mono text-xs">{device.imei}</p>
                        </div>
                      )}
                      {device.phone_number && (
                        <div>
                          <span className="text-slate-500">Phone:</span>
                          <p className="text-slate-300 font-mono text-xs">{device.phone_number}</p>
                        </div>
                      )}
                    </div>

                    {device.last_connection && (
                      <p className="text-xs text-slate-500 mt-2">
                        Last connection: {new Date(device.last_connection).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => deleteDevice(device.id)}
                    className="ml-4 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configuration Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-blue-500/10 border border-blue-500/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-blue-400">Device Configuration</h3>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <div>
              <p className="font-semibold text-white mb-1">Server Settings:</p>
              <div className="bg-slate-900/50 rounded p-2 font-mono text-xs space-y-1">
                <div>Server IP: {serverIP}</div>
                <div>Server Port: {serverPort}</div>
                <div>Protocol: TCP</div>
              </div>
            </div>
            <div>
              <p className="font-semibold text-white mb-1">Device Settings:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Set Device ID to match configured ID</li>
                <li>Enable GPRS/Data connection</li>
                <li>Set reporting interval (30-60 seconds)</li>
                <li>Save and restart device</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Play className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-emerald-400">Quick Start</h3>
          </div>
          <ol className="space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-bold text-xs">1</span>
              <span>Add GPS device configuration above</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-bold text-xs">2</span>
              <span>Start GPS server: <code className="bg-slate-900/50 px-2 py-0.5 rounded">npm start</code></span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-bold text-xs">3</span>
              <span>Configure your GPS device with server details</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-bold text-xs">4</span>
              <span>Device connects and starts sending data</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-bold text-xs">5</span>
              <span>View real-time tracking on GPS & Zones page</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
