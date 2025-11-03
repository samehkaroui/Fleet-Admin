-- ========================================
-- PRODUCTION SETUP - Complete Database Initialization
-- Run this script in Supabase SQL Editor
-- ========================================

-- Step 1: Create all tables with proper structure
-- ========================================

-- Vehicles table (should already exist, but ensure structure)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  vin VARCHAR(100) UNIQUE,
  license_plate VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  odometer INTEGER DEFAULT 0,
  fuel_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GPS Locations table
CREATE TABLE IF NOT EXISTS gps_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2) DEFAULT 0,
  heading DECIMAL(5, 2) DEFAULT 0,
  accuracy DECIMAL(5, 2) DEFAULT 10,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofences table
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  zone_type VARCHAR(50) NOT NULL DEFAULT 'circle' CHECK (zone_type IN ('circle', 'polygon')),
  center_lat DECIMAL(10, 8),
  center_lon DECIMAL(11, 8),
  radius_meters INTEGER,
  polygon_coordinates JSONB,
  alert_on_enter BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  color VARCHAR(7) DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
    'speed_limit', 'geofence_enter', 'geofence_exit', 
    'low_fuel', 'engine_off', 'engine_on', 
    'harsh_braking', 'harsh_acceleration', 'idle_too_long',
    'maintenance_due', 'battery_disconnect', 'no_gps_signal'
  )),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
  location_lat DECIMAL(10, 8),
  location_lon DECIMAL(11, 8),
  speed DECIMAL(5, 2),
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fuel Logs table
CREATE TABLE IF NOT EXISTS fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  fuel_level_percent DECIMAL(5, 2),
  fuel_volume_liters DECIMAL(8, 2),
  fuel_consumed_liters DECIMAL(8, 2),
  location_lat DECIMAL(10, 8),
  location_lon DECIMAL(11, 8),
  odometer_reading INTEGER,
  source VARCHAR(50) CHECK (source IN ('sensor', 'manual', 'calculated')),
  cost_per_liter DECIMAL(8, 2),
  total_cost DECIMAL(10, 2),
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle Settings table
CREATE TABLE IF NOT EXISTS vehicle_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE UNIQUE,
  max_speed_limit INTEGER DEFAULT 120,
  enable_speed_alerts BOOLEAN DEFAULT true,
  fuel_tank_capacity_liters DECIMAL(8, 2),
  fuel_consumption_rate_per_100km DECIMAL(5, 2),
  low_fuel_threshold_percent DECIMAL(5, 2) DEFAULT 20,
  enable_fuel_alerts BOOLEAN DEFAULT true,
  max_idle_time_minutes INTEGER DEFAULT 30,
  enable_idle_alerts BOOLEAN DEFAULT true,
  maintenance_interval_km INTEGER DEFAULT 10000,
  last_maintenance_km INTEGER,
  enable_maintenance_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofence Events table
CREATE TABLE IF NOT EXISTS geofence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  geofence_id UUID REFERENCES geofences(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  event_type VARCHAR(20) CHECK (event_type IN ('enter', 'exit')),
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lon DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2),
  duration_inside_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Step 2: Create Indexes for Performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_gps_locations_vehicle_timestamp ON gps_locations(vehicle_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gps_locations_timestamp ON gps_locations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle_created ON alerts(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_geofences_user_active ON geofences(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_recorded ON fuel_logs(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle ON geofence_events(vehicle_id, created_at DESC);

-- ========================================
-- Step 3: Enable Row Level Security
-- ========================================

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Step 4: Create RLS Policies
-- ========================================

-- Vehicles policies
DROP POLICY IF EXISTS "Users can view own vehicles" ON vehicles;
CREATE POLICY "Users can view own vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own vehicles" ON vehicles;
CREATE POLICY "Users can insert own vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own vehicles" ON vehicles;
CREATE POLICY "Users can update own vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own vehicles" ON vehicles;
CREATE POLICY "Users can delete own vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- GPS Locations policies
DROP POLICY IF EXISTS "Users can view GPS for own vehicles" ON gps_locations;
CREATE POLICY "Users can view GPS for own vehicles"
  ON gps_locations FOR SELECT
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert GPS locations" ON gps_locations;
CREATE POLICY "System can insert GPS locations"
  ON gps_locations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Geofences policies
DROP POLICY IF EXISTS "Users can view own geofences" ON geofences;
CREATE POLICY "Users can view own geofences"
  ON geofences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own geofences" ON geofences;
CREATE POLICY "Users can insert own geofences"
  ON geofences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own geofences" ON geofences;
CREATE POLICY "Users can update own geofences"
  ON geofences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own geofences" ON geofences;
CREATE POLICY "Users can delete own geofences"
  ON geofences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Alerts policies
DROP POLICY IF EXISTS "Users can view own alerts" ON alerts;
CREATE POLICY "Users can view own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert alerts" ON alerts;
CREATE POLICY "System can insert alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own alerts" ON alerts;
CREATE POLICY "Users can update own alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fuel Logs policies
DROP POLICY IF EXISTS "Users can view fuel logs for own vehicles" ON fuel_logs;
CREATE POLICY "Users can view fuel logs for own vehicles"
  ON fuel_logs FOR SELECT
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert fuel logs for own vehicles" ON fuel_logs;
CREATE POLICY "Users can insert fuel logs for own vehicles"
  ON fuel_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

-- Vehicle Settings policies
DROP POLICY IF EXISTS "Users can manage settings for own vehicles" ON vehicle_settings;
CREATE POLICY "Users can manage settings for own vehicles"
  ON vehicle_settings FOR ALL
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

-- Geofence Events policies
DROP POLICY IF EXISTS "Users can view geofence events for own vehicles" ON geofence_events;
CREATE POLICY "Users can view geofence events for own vehicles"
  ON geofence_events FOR SELECT
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert geofence events" ON geofence_events;
CREATE POLICY "System can insert geofence events"
  ON geofence_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ========================================
-- Step 5: Create Functions and Triggers
-- ========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_geofences_updated_at ON geofences;
CREATE TRIGGER update_geofences_updated_at
  BEFORE UPDATE ON geofences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicle_settings_updated_at ON vehicle_settings;
CREATE TRIGGER update_vehicle_settings_updated_at
  BEFORE UPDATE ON vehicle_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Step 6: Enable Realtime
-- ========================================

-- Enable realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE gps_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE geofence_events;

-- ========================================
-- SETUP COMPLETE
-- ========================================

-- Verify tables
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'vehicles', 'gps_locations', 'geofences', 'alerts', 
    'fuel_logs', 'vehicle_settings', 'geofence_events'
  )
ORDER BY table_name;
