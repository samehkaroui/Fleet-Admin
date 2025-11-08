-- GPS Devices Configuration Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS gps_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL UNIQUE,
  device_type VARCHAR(50) NOT NULL,
  imei VARCHAR(15),
  phone_number VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
  last_connection TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_gps_devices_vehicle ON gps_devices(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_gps_devices_device_id ON gps_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_gps_devices_status ON gps_devices(status);

-- Enable RLS
ALTER TABLE gps_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own GPS devices" ON gps_devices;
CREATE POLICY "Users can view own GPS devices"
  ON gps_devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own GPS devices" ON gps_devices;
CREATE POLICY "Users can insert own GPS devices"
  ON gps_devices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own GPS devices" ON gps_devices;
CREATE POLICY "Users can update own GPS devices"
  ON gps_devices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own GPS devices" ON gps_devices;
CREATE POLICY "Users can delete own GPS devices"
  ON gps_devices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow service role (GPS server) to update device status
DROP POLICY IF EXISTS "Service role can update GPS devices" ON gps_devices;
CREATE POLICY "Service role can update GPS devices"
  ON gps_devices FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update trigger
DROP TRIGGER IF EXISTS update_gps_devices_updated_at ON gps_devices;
CREATE TRIGGER update_gps_devices_updated_at
  BEFORE UPDATE ON gps_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create table (for RPC call)
CREATE OR REPLACE FUNCTION create_gps_devices_table()
RETURNS void AS $$
BEGIN
  -- Table creation is handled above
  -- This function is just for RPC compatibility
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
