-- Clean old/fake GPS data
-- Run this in Supabase SQL Editor to remove old test data

-- Option 1: Delete ALL old GPS locations (keeps only data from last 24 hours)
DELETE FROM gps_locations 
WHERE timestamp < NOW() - INTERVAL '24 hours';

-- Option 2: Delete GPS locations for specific vehicle (replace with your vehicle_id)
-- DELETE FROM gps_locations 
-- WHERE vehicle_id = 'your-vehicle-id-here';

-- Option 3: Delete ALL GPS locations (complete reset - use with caution!)
-- DELETE FROM gps_locations;

-- After cleaning, verify the data
SELECT 
  v.name as vehicle_name,
  gl.latitude,
  gl.longitude,
  gl.speed,
  gl.timestamp,
  gl.created_at
FROM gps_locations gl
JOIN vehicles v ON v.id = gl.vehicle_id
ORDER BY gl.timestamp DESC
LIMIT 20;
