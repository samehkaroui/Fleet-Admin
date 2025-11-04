import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import net from 'net';

dotenv.config({ path: '../.env' });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTTP endpoint for GPS data (for testing or HTTP-based GPS devices)
app.post('/gps/update', async (req, res) => {
  try {
    const { device_id, latitude, longitude, speed, heading, accuracy } = req.body;

    if (!device_id || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find vehicle by device_id (you can add a device_id column to vehicles table)
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('id, user_id')
      .eq('vin', device_id) // Using VIN as device_id for now
      .single();

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Insert GPS location
    const { data: location, error } = await supabase
      .from('gps_locations')
      .insert([{
        vehicle_id: vehicle.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: parseFloat(speed) || 0,
        heading: parseFloat(heading) || 0,
        accuracy: parseFloat(accuracy) || 10,
        timestamp: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // Emit to connected clients
    io.emit('gps_update', {
      vehicle_id: vehicle.id,
      location
    });

    // Check for alerts (speed, geofence, etc.)
    await checkAlerts(vehicle, location);

    res.json({ success: true, location });
  } catch (error) {
    console.error('Error processing GPS update:', error);
    res.status(500).json({ error: error.message });
  }
});

// TCP server for GPS devices (common protocols: GT06, TK103, etc.)
const GPS_PORT = process.env.GPS_TCP_PORT || 5023;
const tcpServer = net.createServer((socket) => {
  const remoteAddr = socket.remoteAddress;
  
  // Only log actual GPS device connections (not localhost health checks)
  if (remoteAddr && !remoteAddr.includes('127.0.0.1') && !remoteAddr.includes('::1')) {
    console.log('GPS device connected:', remoteAddr);
  }

  socket.on('data', async (data) => {
    try {
      // Parse GPS data (this is a simplified example)
      // Real implementation would parse specific GPS device protocols
      const gpsData = parseGPSData(data);
      
      if (gpsData) {
        // Process the GPS data
        await processGPSData(gpsData);
      }
    } catch (error) {
      console.error('Error processing GPS data:', error);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  socket.on('close', () => {
    // Only log actual GPS device disconnections (not localhost health checks)
    if (remoteAddr && !remoteAddr.includes('127.0.0.1') && !remoteAddr.includes('::1')) {
      console.log('GPS device disconnected:', remoteAddr);
    }
  });
});

// Parse GPS data from device (example for GT06 protocol)
function parseGPSData(buffer) {
  try {
    // This is a simplified parser - real implementation depends on device protocol
    // GT06, TK103, H02, etc. have different formats
    
    // Example: Parse basic NMEA GPRMC sentence
    const data = buffer.toString();
    
    if (data.includes('$GPRMC')) {
      const parts = data.split(',');
      
      if (parts.length >= 10) {
        const lat = parseCoordinate(parts[3], parts[4]);
        const lon = parseCoordinate(parts[5], parts[6]);
        const speed = parseFloat(parts[7]) * 1.852; // knots to km/h
        const heading = parseFloat(parts[8]);
        
        return {
          device_id: 'DEVICE_001', // Extract from data or connection
          latitude: lat,
          longitude: lon,
          speed,
          heading,
          accuracy: 10,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing GPS data:', error);
    return null;
  }
}

function parseCoordinate(value, direction) {
  const degrees = Math.floor(parseFloat(value) / 100);
  const minutes = parseFloat(value) % 100;
  let coordinate = degrees + (minutes / 60);
  
  if (direction === 'S' || direction === 'W') {
    coordinate *= -1;
  }
  
  return coordinate;
}

async function processGPSData(gpsData) {
  try {
    // Find vehicle
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('id, user_id')
      .eq('vin', gpsData.device_id)
      .single();

    if (!vehicle) {
      console.log('Vehicle not found for device:', gpsData.device_id);
      return;
    }

    // Insert GPS location
    const { data: location, error } = await supabase
      .from('gps_locations')
      .insert([{
        vehicle_id: vehicle.id,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        speed: gpsData.speed,
        heading: gpsData.heading,
        accuracy: gpsData.accuracy,
        timestamp: gpsData.timestamp
      }])
      .select()
      .single();

    if (error) throw error;

    // Emit to connected clients
    io.emit('gps_update', {
      vehicle_id: vehicle.id,
      location
    });

    // Check for alerts
    await checkAlerts(vehicle, location);
  } catch (error) {
    console.error('Error processing GPS data:', error);
  }
}

async function checkAlerts(vehicle, location) {
  try {
    // Get vehicle settings
    const { data: settings } = await supabase
      .from('vehicle_settings')
      .select('*')
      .eq('vehicle_id', vehicle.id)
      .single();

    if (!settings) return;

    // Check speed limit
    if (settings.enable_speed_alerts && location.speed > settings.max_speed_limit) {
      await createAlert({
        user_id: vehicle.user_id,
        vehicle_id: vehicle.id,
        alert_type: 'speed_limit',
        severity: 'high',
        title: 'Speed Limit Exceeded',
        message: `Vehicle is traveling at ${location.speed.toFixed(1)} km/h (limit: ${settings.max_speed_limit} km/h)`,
        location_lat: location.latitude,
        location_lon: location.longitude,
        speed: location.speed
      });
    }

    // Check geofences
    const { data: geofences } = await supabase
      .from('geofences')
      .select('*')
      .eq('user_id', vehicle.user_id)
      .eq('is_active', true);

    if (geofences) {
      for (const geofence of geofences) {
        const isInside = checkPointInGeofence(
          location.latitude,
          location.longitude,
          geofence
        );

        // Check for geofence events
        const { data: lastEvent } = await supabase
          .from('geofence_events')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .eq('geofence_id', geofence.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const wasInside = lastEvent && lastEvent.event_type === 'enter';

        if (isInside && !wasInside) {
          // Vehicle entered geofence
          await supabase.from('geofence_events').insert([{
            vehicle_id: vehicle.id,
            geofence_id: geofence.id,
            event_type: 'enter',
            location_lat: location.latitude,
            location_lon: location.longitude,
            speed: location.speed
          }]);

          if (geofence.alert_on_enter) {
            await createAlert({
              user_id: vehicle.user_id,
              vehicle_id: vehicle.id,
              alert_type: 'geofence_enter',
              severity: 'medium',
              title: 'Geofence Entry',
              message: `Vehicle entered ${geofence.name}`,
              geofence_id: geofence.id,
              location_lat: location.latitude,
              location_lon: location.longitude
            });
          }
        } else if (!isInside && wasInside) {
          // Vehicle exited geofence
          await supabase.from('geofence_events').insert([{
            vehicle_id: vehicle.id,
            geofence_id: geofence.id,
            event_type: 'exit',
            location_lat: location.latitude,
            location_lon: location.longitude,
            speed: location.speed
          }]);

          if (geofence.alert_on_exit) {
            await createAlert({
              user_id: vehicle.user_id,
              vehicle_id: vehicle.id,
              alert_type: 'geofence_exit',
              severity: 'medium',
              title: 'Geofence Exit',
              message: `Vehicle exited ${geofence.name}`,
              geofence_id: geofence.id,
              location_lat: location.latitude,
              location_lon: location.longitude
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking alerts:', error);
  }
}

function checkPointInGeofence(lat, lon, geofence) {
  if (geofence.zone_type === 'circle') {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat - geofence.center_lat) * Math.PI / 180;
    const dLon = (lon - geofence.center_lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(geofence.center_lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance <= geofence.radius_meters;
  }
  
  return false;
}

async function createAlert(alertData) {
  try {
    const { error } = await supabase
      .from('alerts')
      .insert([alertData]);

    if (error) throw error;

    // Emit alert to connected clients
    io.emit('new_alert', alertData);
  } catch (error) {
    console.error('Error creating alert:', error);
  }
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_vehicle', (vehicleId) => {
    socket.join(`vehicle_${vehicleId}`);
    console.log(`Client subscribed to vehicle: ${vehicleId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start servers
// Render provides PORT env variable, use it for HTTP/WebSocket
const HTTP_PORT = process.env.PORT || process.env.GPS_SERVER_PORT || 3001;

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('Fleet GPS Server Started');
  console.log('========================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`HTTP/WebSocket server running on port ${HTTP_PORT}`);
  console.log(`TCP GPS server will listen on port ${GPS_PORT}`);
  console.log('========================');
});

// Start TCP server for GPS devices
tcpServer.listen(GPS_PORT, '0.0.0.0', () => {
  console.log(`TCP GPS server listening on port ${GPS_PORT}`);
});
