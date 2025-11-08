-- Enable Realtime for Fleet Management System
-- This script enables real-time subscriptions for all tables

-- Enable REPLICA IDENTITY for all tables to support real-time updates
ALTER TABLE vehicles REPLICA IDENTITY FULL;
ALTER TABLE drivers REPLICA IDENTITY FULL;
ALTER TABLE trips REPLICA IDENTITY FULL;
ALTER TABLE maintenance_records REPLICA IDENTITY FULL;
ALTER TABLE gps_locations REPLICA IDENTITY FULL;
ALTER TABLE vehicle_assignments REPLICA IDENTITY FULL;
ALTER TABLE geofences REPLICA IDENTITY FULL;
ALTER TABLE alerts REPLICA IDENTITY FULL;
ALTER TABLE fuel_logs REPLICA IDENTITY FULL;
ALTER TABLE vehicle_settings REPLICA IDENTITY FULL;
ALTER TABLE trip_routes REPLICA IDENTITY FULL;
ALTER TABLE geofence_events REPLICA IDENTITY FULL;
ALTER TABLE vehicle_health REPLICA IDENTITY FULL;

-- Enable Realtime publication for all tables (skip if already exists)
DO $$
BEGIN
  -- Add tables to publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'vehicles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'drivers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'trips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trips;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'maintenance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'gps_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gps_locations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'vehicle_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_assignments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'geofences'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE geofences;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'fuel_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE fuel_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'vehicle_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_settings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'trip_routes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trip_routes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'geofence_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE geofence_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'vehicle_health'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_health;
  END IF;
END $$;

-- Grant necessary permissions for realtime
GRANT SELECT ON vehicles TO anon, authenticated;
GRANT SELECT ON drivers TO anon, authenticated;
GRANT SELECT ON trips TO anon, authenticated;
GRANT SELECT ON maintenance_records TO anon, authenticated;
GRANT SELECT ON gps_locations TO anon, authenticated;
GRANT SELECT ON vehicle_assignments TO anon, authenticated;
GRANT SELECT ON geofences TO anon, authenticated;
GRANT SELECT ON alerts TO anon, authenticated;
GRANT SELECT ON fuel_logs TO anon, authenticated;
GRANT SELECT ON vehicle_settings TO anon, authenticated;
GRANT SELECT ON trip_routes TO anon, authenticated;
GRANT SELECT ON geofence_events TO anon, authenticated;
GRANT SELECT ON vehicle_health TO anon, authenticated;

-- Create indexes for better real-time performance
CREATE INDEX IF NOT EXISTS idx_gps_locations_vehicle_timestamp ON gps_locations(vehicle_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_created ON alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_status ON vehicle_assignments(status, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status_departure ON trips(status, departure_time);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_recorded ON fuel_logs(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle_created ON geofence_events(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_health_vehicle_recorded ON vehicle_health(vehicle_id, recorded_at DESC);

-- Create a function to notify on GPS location updates
CREATE OR REPLACE FUNCTION notify_gps_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'gps_update',
    json_build_object(
      'vehicle_id', NEW.vehicle_id,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude,
      'speed', NEW.speed,
      'timestamp', NEW.timestamp
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for GPS updates
DROP TRIGGER IF EXISTS gps_location_update_trigger ON gps_locations;
CREATE TRIGGER gps_location_update_trigger
  AFTER INSERT OR UPDATE ON gps_locations
  FOR EACH ROW
  EXECUTE FUNCTION notify_gps_update();

-- Create a function to notify on critical alerts
CREATE OR REPLACE FUNCTION notify_critical_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.severity = 'critical' THEN
    PERFORM pg_notify(
      'critical_alert',
      json_build_object(
        'alert_id', NEW.id,
        'vehicle_id', NEW.vehicle_id,
        'title', NEW.title,
        'message', NEW.message,
        'severity', NEW.severity
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for critical alerts
DROP TRIGGER IF EXISTS critical_alert_trigger ON alerts;
CREATE TRIGGER critical_alert_trigger
  AFTER INSERT ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION notify_critical_alert();

COMMENT ON TABLE vehicles IS 'Real-time enabled for vehicle tracking';
COMMENT ON TABLE gps_locations IS 'Real-time enabled for GPS location updates';
COMMENT ON TABLE alerts IS 'Real-time enabled for instant alert notifications';
COMMENT ON TABLE trips IS 'Real-time enabled for trip status updates';
