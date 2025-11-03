# Fleet GPS Server

Real-time GPS tracking server for receiving data from GPS devices and mobile apps.

## Features

- **TCP Server** - Port 5023 for GPS device connections
- **HTTP API** - REST endpoints for GPS data submission
- **WebSocket** - Real-time updates to connected clients
- **Protocol Support** - GT06, TK103, NMEA GPRMC
- **Automatic Alerts** - Speed violations, geofence events
- **Database Integration** - Direct Supabase connection

## Installation

```bash
cd gps-server
npm install
```

## Configuration

Create `.env` file in parent directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GPS_SERVER_PORT=3001
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### With PM2
```bash
pm2 start server.js --name gps-server
pm2 logs gps-server
```

## API Endpoints

### POST /gps/update
Submit GPS data via HTTP

**Request:**
```json
{
  "device_id": "VEHICLE_VIN",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "speed": 65.5,
  "heading": 180,
  "accuracy": 10
}
```

**Response:**
```json
{
  "success": true,
  "location": {
    "id": "...",
    "vehicle_id": "...",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "speed": 65.5,
    "heading": 180,
    "accuracy": 10,
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## TCP Protocol

### Connecting GPS Devices

1. Configure device to send data to your server IP
2. Set port to 5023
3. Use TCP protocol
4. Set device_id to match vehicle VIN in database

### Supported Protocols

#### NMEA GPRMC
```
$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A
```

#### GT06 Protocol
Binary protocol - automatic parsing included

#### Custom Protocol
Modify `parseGPSData()` function in server.js

## WebSocket Events

### Client → Server

**subscribe_vehicle**
```javascript
socket.emit('subscribe_vehicle', vehicleId);
```

### Server → Client

**gps_update**
```javascript
socket.on('gps_update', (data) => {
  console.log('GPS Update:', data);
  // { vehicle_id, location }
});
```

**new_alert**
```javascript
socket.on('new_alert', (alert) => {
  console.log('New Alert:', alert);
});
```

## Testing

### Test with cURL
```bash
curl -X POST http://localhost:3001/gps/update \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "TEST123",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "speed": 50,
    "heading": 90,
    "accuracy": 10
  }'
```

### Test with GPS Simulator
```bash
# Install GPS simulator
npm install -g gps-simulator

# Run simulator
gps-simulator --host localhost --port 5023
```

## Alert System

### Automatic Alerts

The server automatically checks for:

1. **Speed Violations**
   - Compares speed with vehicle settings
   - Creates high severity alert

2. **Geofence Events**
   - Checks if vehicle entered/exited zones
   - Creates medium severity alert
   - Records event in database

3. **Future Alerts**
   - Low fuel (when sensor data available)
   - Harsh braking/acceleration
   - Idle time exceeded
   - Battery disconnect

## Device Configuration

### Concox GT06N
```
Server: your-server-ip
Port: 5023
Protocol: TCP
APN: internet (your carrier)
```

### Teltonika FMB920
```
Server: your-server-ip
Port: 5023
Protocol: TCP
Codec: Codec 8
```

### Generic GPS Tracker
```
Server Domain: your-server-ip
Server Port: 5023
Protocol: TCP
Report Interval: 30 seconds
```

## Troubleshooting

### Device not connecting
- Check firewall allows port 5023
- Verify server IP is correct
- Check device has internet connection
- Review server logs

### Data not saving
- Verify Supabase credentials
- Check vehicle VIN matches device_id
- Review database permissions
- Check server logs

### Alerts not triggering
- Verify vehicle_settings exist
- Check alert thresholds
- Ensure geofences are active
- Review alert logic

## Performance

### Optimization
- Handles 1000+ concurrent connections
- Processes 10,000+ GPS points per minute
- Automatic connection cleanup
- Memory efficient parsing

### Monitoring
```bash
# Check server status
pm2 status

# View logs
pm2 logs gps-server

# Monitor resources
pm2 monit
```

## Security

### Best Practices
- Use firewall to restrict access
- Implement device authentication
- Validate all GPS data
- Rate limit requests
- Use HTTPS for HTTP API
- Encrypt TCP connections (TLS)

## Deployment

### VPS/Cloud Server
```bash
# Clone repository
git clone your-repo
cd fleet-admin/gps-server

# Install dependencies
npm install --production

# Start with PM2
pm2 start server.js --name gps-server
pm2 save
pm2 startup
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001 5023
CMD ["node", "server.js"]
```

### Environment Variables
```bash
# Production
export VITE_SUPABASE_URL=your_url
export VITE_SUPABASE_ANON_KEY=your_key
export GPS_SERVER_PORT=3001
export NODE_ENV=production
```

## Logs

Server logs include:
- GPS device connections/disconnections
- GPS data received
- Alerts triggered
- Errors and warnings
- Performance metrics

## Support

For issues:
1. Check server logs
2. Verify device configuration
3. Test with HTTP API first
4. Review firewall settings
5. Check database connectivity
