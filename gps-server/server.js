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

// Supabase client with service role key (bypasses RLS for server operations)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
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

// Root path - some GPS devices send data here
app.get('/', async (req, res) => {
  try {
    console.log('Root GET request received:', req.query);
    
    // If there are query parameters, treat as GPS data
    if (Object.keys(req.query).length > 0) {
      const device_id = req.query.id || req.query.device_id || req.query.imei || req.query.deviceid;
      const latitude = req.query.lat || req.query.latitude;
      const longitude = req.query.lon || req.query.lng || req.query.longitude;
      const speed = req.query.speed || req.query.spd || '0';
      const heading = req.query.heading || req.query.course || req.query.dir || '0';
      const accuracy = req.query.accuracy || req.query.acc || '10';

      if (device_id && latitude && longitude) {
        const gpsData = {
          device_id,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          speed: parseFloat(speed),
          heading: parseFloat(heading),
          accuracy: parseFloat(accuracy),
          timestamp: new Date().toISOString()
        };

        console.log('Processing GPS data from root path:', gpsData);
        await processGPSData(gpsData);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing root request:', error);
    res.status(200).send('OK');
  }
});

// Get connected devices
app.get('/devices/connected', (req, res) => {
  const devices = Array.from(connectedDevices.entries()).map(([deviceId, info]) => ({
    device_id: deviceId,
    remote_address: info.remoteAddr,
    last_seen: info.lastSeen,
    connected: true
  }));
  res.json({ devices, count: devices.length });
});

// HTTP GET endpoint for GPS devices (many devices send data via GET with query params)
app.get('/gps', async (req, res) => {
  try {
    console.log('GPS GET request received:', req.query);
    
    // Extract parameters (different devices use different parameter names)
    const device_id = req.query.id || req.query.device_id || req.query.imei || req.query.deviceid;
    const latitude = req.query.lat || req.query.latitude;
    const longitude = req.query.lon || req.query.lng || req.query.longitude;
    const speed = req.query.speed || req.query.spd || '0';
    const heading = req.query.heading || req.query.course || req.query.dir || '0';
    const accuracy = req.query.accuracy || req.query.acc || '10';

    if (!device_id || !latitude || !longitude) {
      console.log('Missing GPS data in GET request');
      return res.status(200).send('OK'); // Some devices expect 200 even without data
    }

    const gpsData = {
      device_id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: parseFloat(speed),
      heading: parseFloat(heading),
      accuracy: parseFloat(accuracy),
      timestamp: new Date().toISOString()
    };

    console.log('Processing GPS data from GET:', gpsData);
    await processGPSData(gpsData);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing GPS GET request:', error);
    res.status(200).send('OK'); // Still send OK to keep device happy
  }
});

// HTTP POST endpoint for GPS data (for testing or HTTP-based GPS devices)
app.post('/gps/update', async (req, res) => {
  try {
    const { device_id, latitude, longitude, speed, heading, accuracy } = req.body;

    if (!device_id || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const gpsData = {
      device_id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: parseFloat(speed) || 0,
      heading: parseFloat(heading) || 0,
      accuracy: parseFloat(accuracy) || 10,
      timestamp: new Date().toISOString()
    };

    await processGPSData(gpsData);

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing GPS update:', error);
    res.status(500).json({ error: error.message });
  }
});

// TCP server for GPS devices (common protocols: GT06, TK103, etc.)
const GPS_PORT = process.env.GPS_TCP_PORT || 5023;
const connectedDevices = new Map(); // Track connected devices

const tcpServer = net.createServer((socket) => {
  const remoteAddr = socket.remoteAddress;
  let deviceId = null;
  
  // Only log actual GPS device connections (not localhost health checks)
  if (remoteAddr && !remoteAddr.includes('127.0.0.1') && !remoteAddr.includes('::1')) {
    console.log('GPS device connected from:', remoteAddr);
  }

  socket.on('data', async (data) => {
    try {
      // Parse GPS data (this is a simplified example)
      // Real implementation would parse specific GPS device protocols
      const gpsData = parseGPSData(data);
      
      if (gpsData) {
        deviceId = gpsData.device_id;
        connectedDevices.set(deviceId, { socket, remoteAddr, lastSeen: new Date() });
        
        // Process the GPS data
        await processGPSData(gpsData);
        
        // Send acknowledgment (GT06 protocol)
        if (data[0] === 0x78 && data[1] === 0x78) {
          const serialNumber = data.readUInt16BE(data[2] - 2);
          const ack = Buffer.from([0x78, 0x78, 0x05, 0x01, 
            (serialNumber >> 8) & 0xFF, serialNumber & 0xFF, 
            0x0D, 0x0A]);
          socket.write(ack);
        }
      }
    } catch (error) {
      console.error('Error processing GPS data:', error);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    if (deviceId) {
      connectedDevices.delete(deviceId);
    }
  });

  socket.on('close', () => {
    // Only log actual GPS device disconnections (not localhost health checks)
    if (remoteAddr && !remoteAddr.includes('127.0.0.1') && !remoteAddr.includes('::1')) {
      console.log('GPS device disconnected:', remoteAddr, deviceId ? `(${deviceId})` : '');
    }
    if (deviceId) {
      connectedDevices.delete(deviceId);
    }
  });
});

// Parse GPS data from device (supports multiple protocols)
function parseGPSData(buffer) {
  try {
    const hex = buffer.toString('hex');
    const text = buffer.toString('utf8');
    
    console.log('Received GPS data (hex):', hex.substring(0, 100) + (hex.length > 100 ? '...' : ''));
    console.log('Received GPS data (text):', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    
    // Protocol 1: HEAD protocol (text-based)
    if (text.includes('HEAD')) {
      console.log('Detected HEAD protocol');
      return parseHEADProtocol(text);
    }
    
    // Protocol 2: GT06 protocol (binary)
    if (buffer[0] === 0x78 && buffer[1] === 0x78) {
      console.log('Detected GT06 protocol');
      return parseGT06Protocol(buffer);
    }
    
    // Protocol 3: NMEA GPRMC sentence
    if (text.includes('$GPRMC') || text.includes('$GPGGA')) {
      console.log('Detected NMEA protocol');
      return parseNMEAProtocol(text);
    }
    
    // Protocol 4: TK103 protocol
    if (text.includes('imei:') || text.match(/\d{15}/)) {
      console.log('Detected TK103-like protocol');
      return parseTK103Protocol(text);
    }
    
    console.log('Unable to parse GPS data - unknown protocol');
    return null;
  } catch (error) {
    console.error('Error parsing GPS data:', error);
    return null;
  }
}

// Parse HEAD protocol (text-based, including HTTP requests)
function parseHEADProtocol(data) {
  try {
    console.log('Parsing HEAD protocol, data length:', data.length);
    
    // If it's an HTTP request, extract the path/query
    if (data.includes('HTTP/1.1') || data.includes('HTTP/1.0')) {
      console.log('Detected HTTP request in HEAD protocol');
      // Extract the request line (first line)
      const lines = data.split('\n');
      const requestLine = lines[0];
      console.log('HTTP Request line:', requestLine);
      
      // Try to extract GPS data from URL path or query
      // Example: HEAD /gps?id=123&lat=33.5&lon=-7.6 HTTP/1.1
      const urlMatch = requestLine.match(/HEAD\s+([^\s]+)\s+HTTP/i);
      if (urlMatch) {
        const path = urlMatch[1];
        console.log('Extracted path:', path);
        
        // Parse query parameters
        const queryMatch = path.match(/\?(.+)/);
        if (queryMatch) {
          const params = new URLSearchParams(queryMatch[1]);
          const deviceId = params.get('id') || params.get('device_id') || params.get('imei');
          const lat = params.get('lat') || params.get('latitude');
          const lon = params.get('lon') || params.get('lng') || params.get('longitude');
          const speed = params.get('speed') || params.get('spd') || '0';
          const heading = params.get('heading') || params.get('course') || '0';
          
          if (deviceId && lat && lon) {
            console.log('HEAD HTTP parsed:', { deviceId, lat, lon, speed });
            return {
              device_id: deviceId,
              latitude: parseFloat(lat),
              longitude: parseFloat(lon),
              speed: parseFloat(speed),
              heading: parseFloat(heading),
              accuracy: 10,
              timestamp: new Date().toISOString()
            };
          }
        }
      }
      
      // If no query params, this might just be a health check
      console.log('HEAD HTTP request has no GPS data (might be health check)');
      return null;
    }
    
    // Parse comma-separated format: HEAD,deviceId,lat,lon,speed,...
    const parts = data.split(',');
    console.log('HEAD protocol parts count:', parts.length);
    
    if (parts.length < 3) {
      console.log('HEAD protocol: insufficient data parts');
      return null;
    }
    
    // Extract device ID (usually in first or second part)
    let deviceId = null;
    for (let i = 0; i < Math.min(3, parts.length); i++) {
      const match = parts[i].match(/(\d{8,})/);
      if (match) {
        deviceId = match[1];
        break;
      }
    }
    
    if (!deviceId) {
      console.log('HEAD protocol: device ID not found in parts:', parts.slice(0, 3));
      return null;
    }
    
    // Try to find latitude and longitude
    let latitude = null;
    let longitude = null;
    let speed = 0;
    let heading = 0;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      
      // Look for coordinates (format: N/S followed by number or just decimal)
      if (part.match(/^[NS]/) && parts[i + 1]) {
        const latStr = part.substring(1) || parts[i + 1];
        latitude = parseFloat(latStr);
        if (part[0] === 'S') latitude *= -1;
      }
      
      if (part.match(/^[EW]/) && parts[i + 1]) {
        const lonStr = part.substring(1) || parts[i + 1];
        longitude = parseFloat(lonStr);
        if (part[0] === 'W') longitude *= -1;
      }
      
      // Look for decimal coordinates
      const num = parseFloat(part);
      if (!isNaN(num)) {
        if (num >= -90 && num <= 90 && latitude === null) {
          latitude = num;
        } else if (num >= -180 && num <= 180 && longitude === null && latitude !== null) {
          longitude = num;
        } else if (num >= 0 && num <= 300 && latitude !== null && longitude !== null && speed === 0) {
          speed = num;
        }
      }
    }
    
    if (latitude !== null && longitude !== null) {
      console.log('HEAD protocol parsed:', { deviceId, latitude, longitude, speed });
      return {
        device_id: deviceId,
        latitude,
        longitude,
        speed,
        heading,
        accuracy: 10,
        timestamp: new Date().toISOString()
      };
    }
    
    console.log('HEAD protocol: coordinates not found in parts');
    return null;
  } catch (error) {
    console.error('Error parsing HEAD protocol:', error);
    return null;
  }
}

// Parse GT06 protocol (binary)
function parseGT06Protocol(buffer) {
  try {
    const length = buffer[2];
    const protocolNumber = buffer[3];
    
    // Login packet (0x01) - contains IMEI
    if (protocolNumber === 0x01) {
      const imei = buffer.slice(4, 12).toString('hex');
      console.log('GT06: Device login - IMEI:', imei);
      return null;
    }
    
    // Location packet (0x12 or 0x22)
    if (protocolNumber === 0x12 || protocolNumber === 0x22) {
      const serialNumber = buffer.readUInt16BE(length - 4);
      const deviceId = serialNumber.toString();
      
      const latitude = buffer.readUInt32BE(11) / 1800000;
      const longitude = buffer.readUInt32BE(15) / 1800000;
      const speed = buffer[19];
      const course = buffer.readUInt16BE(20);
      
      console.log('GT06 parsed:', { deviceId, latitude, longitude, speed });
      
      return {
        device_id: deviceId,
        latitude,
        longitude,
        speed,
        heading: course,
        accuracy: 10,
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing GT06:', error);
    return null;
  }
}

// Parse NMEA protocol
function parseNMEAProtocol(data) {
  try {
    if (data.includes('$GPRMC')) {
      const parts = data.split(',');
      
      if (parts.length >= 10) {
        const lat = parseCoordinate(parts[3], parts[4]);
        const lon = parseCoordinate(parts[5], parts[6]);
        const speed = parseFloat(parts[7]) * 1.852;
        const heading = parseFloat(parts[8]);
        
        const deviceIdMatch = data.match(/ID:(\w+)/i) || data.match(/(\d{10,})/);
        const deviceId = deviceIdMatch ? deviceIdMatch[1] : 'UNKNOWN';
        
        console.log('NMEA parsed:', { deviceId, lat, lon, speed });
        
        return {
          device_id: deviceId,
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
    console.error('Error parsing NMEA:', error);
    return null;
  }
}

// Parse TK103-like protocol
function parseTK103Protocol(data) {
  try {
    // Example: imei:123456789012345,tracker,151117120000,,F,120000.000,A,3000.0000,N,03000.0000,E,0.00,0;
    const imeiMatch = data.match(/imei:(\d{15})/i) || data.match(/(\d{15})/);
    if (!imeiMatch) return null;
    
    const deviceId = imeiMatch[1];
    const parts = data.split(',');
    
    let latitude = null;
    let longitude = null;
    let speed = 0;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i].match(/^\d{4}\.\d{4}$/) && parts[i + 1] === 'N' || parts[i + 1] === 'S') {
        const coord = parseFloat(parts[i]);
        latitude = Math.floor(coord / 100) + (coord % 100) / 60;
        if (parts[i + 1] === 'S') latitude *= -1;
      }
      
      if (parts[i].match(/^\d{5}\.\d{4}$/) && parts[i + 1] === 'E' || parts[i + 1] === 'W') {
        const coord = parseFloat(parts[i]);
        longitude = Math.floor(coord / 100) + (coord % 100) / 60;
        if (parts[i + 1] === 'W') longitude *= -1;
      }
    }
    
    if (latitude !== null && longitude !== null) {
      console.log('TK103 parsed:', { deviceId, latitude, longitude, speed });
      return {
        device_id: deviceId,
        latitude,
        longitude,
        speed,
        heading: 0,
        accuracy: 10,
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing TK103:', error);
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
    // Find GPS device configuration
    const { data: gpsDevice } = await supabase
      .from('gps_devices')
      .select('*, vehicle:vehicles(id, user_id)')
      .eq('device_id', gpsData.device_id)
      .single();

    if (!gpsDevice || !gpsDevice.vehicle) {
      console.log('GPS device not found:', gpsData.device_id);
      return;
    }

    const vehicle = gpsDevice.vehicle;

    // Update device status to 'active' and last_connection
    await supabase
      .from('gps_devices')
      .update({
        status: 'active',
        last_connection: new Date().toISOString()
      })
      .eq('device_id', gpsData.device_id);

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

    console.log(`GPS data processed for device ${gpsData.device_id}, vehicle ${vehicle.id}`);

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
