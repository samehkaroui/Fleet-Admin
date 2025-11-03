-- ========================================
-- FULL GPS TRACKING SYSTEM - DATABASE SCHEMA
-- ========================================

-- 1. GEOFENCES TABLE
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  zone_type VARCHAR(50) NOT NULL CHECK (zone_type IN ('circle', 'polygon')),
  
  -- Circle geofence
  center_lat DECIMAL(10, 8),
  center_lon DECIMAL(11, 8),
  radius_meters INTEGER,
  
  -- Polygon geofence (stored as JSON array of coordinates)
  polygon_coordinates JSONB,
  
  -- Settings
  alert_on_enter BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  color VARCHAR(7) DEFAULT '#10b981',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ALERTS TABLE
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
  
  -- Related data
  geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
  location_lat DECIMAL(10, 8),
  location_lon DECIMAL(11, 8),
  speed DECIMAL(5, 2),
  metadata JSONB,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FUEL LOGS TABLE
CREATE TABLE IF NOT EXISTS fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  
  -- Fuel data
  fuel_level_percent DECIMAL(5, 2),
  fuel_volume_liters DECIMAL(8, 2),
  fuel_consumed_liters DECIMAL(8, 2),
  
  -- Location when recorded
  location_lat DECIMAL(10, 8),
  location_lon DECIMAL(11, 8),
  odometer_reading INTEGER,
  
  -- Calculation method
  source VARCHAR(50) CHECK (source IN ('sensor', 'manual', 'calculated')),
  
  -- Cost tracking
  cost_per_liter DECIMAL(8, 2),
  total_cost DECIMAL(10, 2),
  
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VEHICLE SETTINGS TABLE (for speed limits, fuel capacity, etc.)
CREATE TABLE IF NOT EXISTS vehicle_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE UNIQUE,
  
  -- Speed monitoring
  max_speed_limit INTEGER DEFAULT 120,
  enable_speed_alerts BOOLEAN DEFAULT true,
  
  -- Fuel monitoring
  fuel_tank_capacity_liters DECIMAL(8, 2),
  fuel_consumption_rate_per_100km DECIMAL(5, 2),
  low_fuel_threshold_percent DECIMAL(5, 2) DEFAULT 20,
  enable_fuel_alerts BOOLEAN DEFAULT true,
  
  -- Idle monitoring
  max_idle_time_minutes INTEGER DEFAULT 30,
  enable_idle_alerts BOOLEAN DEFAULT true,
  
  -- Maintenance
  maintenance_interval_km INTEGER DEFAULT 10000,
  last_maintenance_km INTEGER,
  enable_maintenance_alerts BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRIP ROUTES TABLE (detailed route tracking)
CREATE TABLE IF NOT EXISTS trip_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  
  -- Route points (array of GPS coordinates)
  route_points JSONB NOT NULL,
  
  -- Statistics
  total_distance_km DECIMAL(10, 2),
  total_duration_minutes INTEGER,
  average_speed DECIMAL(5, 2),
  max_speed DECIMAL(5, 2),
  
  -- Fuel consumption
  fuel_consumed_liters DECIMAL(8, 2),
  fuel_cost DECIMAL(10, 2),
  
  -- Stops
  stops_count INTEGER DEFAULT 0,
  stops_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. GEOFENCE EVENTS TABLE
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

-- 7. VEHICLE HEALTH TABLE
CREATE TABLE IF NOT EXISTS vehicle_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  
  -- Engine data
  engine_status VARCHAR(20) CHECK (engine_status IN ('on', 'off', 'idle')),
  engine_temperature DECIMAL(5, 2),
  
  -- Battery
  battery_voltage DECIMAL(5, 2),
  battery_status VARCHAR(20) CHECK (battery_status IN ('good', 'low', 'critical', 'disconnected')),
  
  -- Diagnostics
  odometer_reading INTEGER,
  fuel_level_percent DECIMAL(5, 2),
  
  -- GPS signal
  gps_signal_strength INTEGER,
  satellites_count INTEGER,
  
  -- Errors
  error_codes JSONB,
  
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_alerts_vehicle_created ON alerts(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_geofences_user_active ON geofences(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_recorded ON fuel_logs(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle ON geofence_events(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_routes_trip ON trip_routes(trip_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_health_vehicle ON vehicle_health(vehicle_id, recorded_at DESC);

-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Geofences
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own geofences"
  ON geofences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own geofences"
  ON geofences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own geofences"
  ON geofences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own geofences"
  ON geofences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fuel Logs
ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fuel logs for own vehicles"
  ON fuel_logs FOR SELECT
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert fuel logs for own vehicles"
  ON fuel_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

-- Vehicle Settings
ALTER TABLE vehicle_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view settings for own vehicles"
  ON vehicle_settings FOR SELECT
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage settings for own vehicles"
  ON vehicle_settings FOR ALL
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

-- Trip Routes
ALTER TABLE trip_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view routes for own trips"
  ON trip_routes FOR SELECT
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert trip routes"
  ON trip_routes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Geofence Events
ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view geofence events for own vehicles"
  ON geofence_events FOR SELECT
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert geofence events"
  ON geofence_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Vehicle Health
ALTER TABLE vehicle_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view health for own vehicles"
  ON vehicle_health FOR SELECT
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT id FROM vehicles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert vehicle health"
  ON vehicle_health FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ========================================
-- FUNCTIONS AND TRIGGERS
-- ========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_geofences_updated_at
  BEFORE UPDATE ON geofences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_settings_updated_at
  BEFORE UPDATE ON vehicle_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check if point is inside geofence
CREATE OR REPLACE FUNCTION is_point_in_geofence(
  p_lat DECIMAL,
  p_lon DECIMAL,
  p_geofence_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_geofence RECORD;
  v_distance DECIMAL;
BEGIN
  SELECT * INTO v_geofence FROM geofences WHERE id = p_geofence_id;
  
  IF v_geofence.zone_type = 'circle' THEN
    -- Calculate distance using Haversine formula (simplified)
    v_distance := 6371000 * ACOS(
      COS(RADIANS(p_lat)) * COS(RADIANS(v_geofence.center_lat)) *
      COS(RADIANS(v_geofence.center_lon) - RADIANS(p_lon)) +
      SIN(RADIANS(p_lat)) * SIN(RADIANS(v_geofence.center_lat))
    );
    
    RETURN v_distance <= v_geofence.radius_meters;
  END IF;
  
  -- For polygon, would need PostGIS extension
  RETURN false;
END;
$$ LANGUAGE plpgsql;
