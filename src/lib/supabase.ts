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
