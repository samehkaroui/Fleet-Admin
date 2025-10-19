/*
  # Fleet Management System Database Schema

  ## Overview
  Complete database schema for fleet management with GPS tracking and maintenance scheduling.

  ## 1. New Tables

  ### `vehicles`
  Core vehicle information and current status
  - `id` (uuid, primary key) - Unique vehicle identifier
  - `user_id` (uuid, foreign key) - Owner/manager reference
  - `name` (text) - Vehicle name/identifier
  - `type` (text) - Vehicle type (truck, van, car, etc.)
  - `make` (text) - Vehicle manufacturer
  - `model` (text) - Vehicle model
  - `year` (integer) - Manufacturing year
  - `vin` (text, unique) - Vehicle identification number
  - `license_plate` (text, unique) - License plate number
  - `status` (text) - Current status (active, maintenance, inactive)
  - `odometer` (integer) - Current odometer reading in kilometers
  - `fuel_type` (text) - Fuel type (diesel, gasoline, electric, hybrid)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `gps_locations`
  Real-time and historical GPS tracking data
  - `id` (uuid, primary key) - Unique location record identifier
  - `vehicle_id` (uuid, foreign key) - Reference to vehicle
  - `latitude` (decimal) - GPS latitude coordinate
  - `longitude` (decimal) - GPS longitude coordinate
  - `speed` (decimal) - Speed in km/h
  - `heading` (decimal) - Direction in degrees (0-360)
  - `accuracy` (decimal) - GPS accuracy in meters
  - `timestamp` (timestamptz) - GPS reading timestamp
  - `created_at` (timestamptz) - Record creation timestamp

  ### `maintenance_records`
  Complete maintenance history and scheduling
  - `id` (uuid, primary key) - Unique maintenance record identifier
  - `vehicle_id` (uuid, foreign key) - Reference to vehicle
  - `type` (text) - Maintenance type (routine, repair, inspection)
  - `description` (text) - Detailed description
  - `status` (text) - Status (scheduled, in_progress, completed, cancelled)
  - `scheduled_date` (date) - Scheduled maintenance date
  - `completed_date` (date, nullable) - Actual completion date
  - `odometer_reading` (integer) - Odometer at time of maintenance
  - `cost` (decimal, nullable) - Maintenance cost
  - `technician` (text, nullable) - Technician name
  - `notes` (text, nullable) - Additional notes
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `drivers`
  Driver information and assignments
  - `id` (uuid, primary key) - Unique driver identifier
  - `user_id` (uuid, foreign key) - Reference to auth user
  - `name` (text) - Driver full name
  - `email` (text, unique) - Driver email
  - `phone` (text) - Contact phone number
  - `license_number` (text, unique) - Driver's license number
  - `license_expiry` (date) - License expiration date
  - `status` (text) - Status (active, inactive, suspended)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `trips`
  Trip scheduling and tracking
  - `id` (uuid, primary key) - Unique trip identifier
  - `user_id` (uuid, foreign key) - Reference to auth user
  - `destination` (text) - Trip destination
  - `departure_time` (timestamptz) - Scheduled departure time
  - `arrival_time` (timestamptz) - Scheduled arrival time
  - `vehicle_id` (uuid, foreign key) - Reference to vehicle
  - `driver_id` (uuid, foreign key) - Reference to driver
  - `status` (text) - Status (scheduled, in_progress, completed, cancelled)
  - `distance` (integer, nullable) - Trip distance in kilometers
  - `estimated_duration` (integer, nullable) - Estimated duration in minutes
  - `actual_duration` (integer, nullable) - Actual duration in minutes
  - `notes` (text, nullable) - Additional notes
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `vehicle_assignments`
  Driver-vehicle assignments
  - `id` (uuid, primary key) - Unique assignment identifier
  - `vehicle_id` (uuid, foreign key) - Reference to vehicle
  - `driver_id` (uuid, foreign key) - Reference to driver
  - `trip_id` (uuid, foreign key, nullable) - Reference to trip
  - `assigned_at` (timestamptz) - Assignment start time
  - `returned_at` (timestamptz, nullable) - Assignment end time
  - `status` (text) - Status (active, completed)
  - `assignment_type` (text) - Type (trip, general)
  - `notes` (text, nullable) - Additional notes
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Security
  
  ### Row Level Security (RLS)
  All tables have RLS enabled with restrictive policies:
  - Users can only access their own fleet data
  - Authenticated users required for all operations
  - Ownership verified through user_id checks

  ### Policies per table
  - `vehicles`: SELECT, INSERT, UPDATE, DELETE for own vehicles
  - `gps_locations`: SELECT, INSERT for own vehicle locations
  - `maintenance_records`: SELECT, INSERT, UPDATE for own vehicle maintenance
  - `drivers`: SELECT, INSERT, UPDATE for own drivers
  - `trips`: SELECT, INSERT, UPDATE, DELETE for own trips
  - `vehicle_assignments`: SELECT, INSERT, UPDATE for own assignments

  ## 3. Indexes
  Performance optimization indexes:
  - GPS locations by vehicle_id and timestamp (for tracking queries)
  - Maintenance records by vehicle_id and status (for scheduling)
  - Vehicle assignments by vehicle_id and driver_id (for lookups)
  - Trips by user_id and status (for filtering)
  - Trips by departure_time (for scheduling queries)

  ## 4. Important Notes
  - All timestamps use UTC timezone
  - GPS coordinates use decimal degrees format
  - Distances and odometer readings in kilometers
  - RLS ensures complete data isolation between users
  - Cascading deletes maintain referential integrity
*/

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  vin text UNIQUE,
  license_plate text UNIQUE NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  odometer integer DEFAULT 0 NOT NULL,
  fuel_type text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create gps_locations table
CREATE TABLE IF NOT EXISTS gps_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  speed decimal(6, 2) DEFAULT 0,
  heading decimal(5, 2),
  accuracy decimal(8, 2),
  timestamp timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create maintenance_records table
CREATE TABLE IF NOT EXISTS maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'scheduled' NOT NULL,
  scheduled_date date NOT NULL,
  completed_date date,
  odometer_reading integer,
  cost decimal(10, 2),
  technician text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL,
  license_number text UNIQUE NOT NULL,
  license_expiry date NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create trips table
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  destination text NOT NULL,
  departure_time timestamptz NOT NULL,
  arrival_time timestamptz NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'scheduled' NOT NULL,
  distance integer,
  estimated_duration integer,
  actual_duration integer,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create vehicle_assignments table
CREATE TABLE IF NOT EXISTS vehicle_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now() NOT NULL,
  returned_at timestamptz,
  status text DEFAULT 'active' NOT NULL,
  assignment_type text DEFAULT 'general' NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gps_locations_vehicle_timestamp 
  ON gps_locations(vehicle_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_records_vehicle_status 
  ON maintenance_records(vehicle_id, status);

CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_vehicle 
  ON vehicle_assignments(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_driver 
  ON vehicle_assignments(driver_id);

CREATE INDEX IF NOT EXISTS idx_trips_user_status 
  ON trips(user_id, status);

CREATE INDEX IF NOT EXISTS idx_trips_departure_time 
  ON trips(departure_time);

-- Enable Row Level Security
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicles
CREATE POLICY "Users can view own vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for gps_locations
CREATE POLICY "Users can view own vehicle locations"
  ON gps_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = gps_locations.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own vehicle locations"
  ON gps_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = gps_locations.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  );

-- RLS Policies for maintenance_records
CREATE POLICY "Users can view own vehicle maintenance"
  ON maintenance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_records.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own vehicle maintenance"
  ON maintenance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_records.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own vehicle maintenance"
  ON maintenance_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_records.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = maintenance_records.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  );

-- RLS Policies for drivers
CREATE POLICY "Users can view own drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drivers"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drivers"
  ON drivers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for vehicle_assignments
CREATE POLICY "Users can view own vehicle assignments"
  ON vehicle_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = vehicle_assignments.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own vehicle assignments"
  ON vehicle_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = vehicle_assignments.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own vehicle assignments"
  ON vehicle_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = vehicle_assignments.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = vehicle_assignments.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  );

-- RLS Policies for trips
CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trips"
  ON trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
  ON trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
  ON trips FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);