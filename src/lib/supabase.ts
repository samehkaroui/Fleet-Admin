import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Vehicle = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  license_plate: string;
  status: 'active' | 'maintenance' | 'inactive';
  odometer: number;
  fuel_type: string;
  created_at: string;
  updated_at: string;
};

export type GPSLocation = {
  id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: string;
  created_at: string;
};

export type MaintenanceRecord = {
  id: string;
  vehicle_id: string;
  type: 'routine' | 'repair' | 'inspection';
  description: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_date: string;
  completed_date?: string;
  odometer_reading?: number;
  cost?: number;
  technician?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type Driver = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  license_number: string;
  license_expiry: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
};

export type VehicleAssignment = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  trip_id?: string;
  assigned_at: string;
  returned_at?: string;
  status: 'active' | 'completed';
  assignment_type: 'trip' | 'general';
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type Trip = {
  id: string;
  user_id: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  vehicle_id: string;
  driver_id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  distance?: number;
  estimated_duration?: number;
  actual_duration?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type Geofence = {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  zone_type: 'circle' | 'polygon';
  center_lat?: number;
  center_lon?: number;
  radius_meters?: number;
  polygon_coordinates?: { lat: number; lon: number }[];
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  is_active: boolean;
  color: string;
  created_at: string;
  updated_at: string;
};

export type Alert = {
  id: string;
  user_id: string;
  vehicle_id: string;
  alert_type: 'speed_limit' | 'geofence_enter' | 'geofence_exit' | 'low_fuel' | 
    'engine_off' | 'engine_on' | 'harsh_braking' | 'harsh_acceleration' | 
    'idle_too_long' | 'maintenance_due' | 'battery_disconnect' | 'no_gps_signal';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  geofence_id?: string;
  location_lat?: number;
  location_lon?: number;
  speed?: number;
  metadata?: Record<string, any>;
  is_read: boolean;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  created_at: string;
};

export type FuelLog = {
  id: string;
  vehicle_id: string;
  fuel_level_percent?: number;
  fuel_volume_liters?: number;
  fuel_consumed_liters?: number;
  location_lat?: number;
  location_lon?: number;
  odometer_reading?: number;
  source: 'sensor' | 'manual' | 'calculated';
  cost_per_liter?: number;
  total_cost?: number;
  notes?: string;
  recorded_at: string;
  created_at: string;
};

export type VehicleSettings = {
  id: string;
  vehicle_id: string;
  max_speed_limit: number;
  enable_speed_alerts: boolean;
  fuel_tank_capacity_liters?: number;
  fuel_consumption_rate_per_100km?: number;
  low_fuel_threshold_percent: number;
  enable_fuel_alerts: boolean;
  max_idle_time_minutes: number;
  enable_idle_alerts: boolean;
  maintenance_interval_km: number;
  last_maintenance_km?: number;
  enable_maintenance_alerts: boolean;
  created_at: string;
  updated_at: string;
};

export type TripRoute = {
  id: string;
  trip_id: string;
  route_points: { lat: number; lon: number; timestamp: string; speed: number }[];
  total_distance_km?: number;
  total_duration_minutes?: number;
  average_speed?: number;
  max_speed?: number;
  fuel_consumed_liters?: number;
  fuel_cost?: number;
  stops_count: number;
  stops_data?: any;
  created_at: string;
};

export type GeofenceEvent = {
  id: string;
  vehicle_id: string;
  geofence_id: string;
  driver_id?: string;
  event_type: 'enter' | 'exit';
  location_lat: number;
  location_lon: number;
  speed?: number;
  duration_inside_minutes?: number;
  created_at: string;
};

export type VehicleHealth = {
  id: string;
  vehicle_id: string;
  engine_status?: 'on' | 'off' | 'idle';
  engine_temperature?: number;
  battery_voltage?: number;
  battery_status?: 'good' | 'low' | 'critical' | 'disconnected';
  odometer_reading?: number;
  fuel_level_percent?: number;
  gps_signal_strength?: number;
  satellites_count?: number;
  error_codes?: any;
  recorded_at: string;
  created_at: string;
};
