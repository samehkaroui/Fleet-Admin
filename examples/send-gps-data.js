/**
 * مثال: إرسال بيانات GPS إلى Supabase
 * Example: Send GPS data to Supabase
 * 
 * يمكن استخدام هذا الكود في:
 * - تطبيق موبايل (React Native / Flutter)
 * - جهاز GPS متصل بالإنترنت
 * - Raspberry Pi مع GPS module
 */

import { createClient } from '@supabase/supabase-js'

// استبدل هذه القيم بقيمك من ملف .env
const SUPABASE_URL = 'https://koewnwzemnwqctuswkzo.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key-here'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * إرسال موقع GPS واحد
 */
async function sendGPSLocation(vehicleId, gpsData) {
  try {
    const { data, error } = await supabase
      .from('gps_locations')
      .insert([{
        vehicle_id: vehicleId,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        speed: gpsData.speed || 0,
        heading: gpsData.heading || 0,
        accuracy: gpsData.accuracy || 10,
        timestamp: gpsData.timestamp || new Date().toISOString()
      }])
      .select()

    if (error) {
      console.error('Error sending GPS data:', error)
      return { success: false, error }
    }

    console.log('GPS data sent successfully:', data)
    return { success: true, data }
  } catch (error) {
    console.error('Exception:', error)
    return { success: false, error }
  }
}

/**
 * مثال 1: إرسال موقع من متصفح الويب (Web Geolocation API)
 */
function trackVehicleFromBrowser(vehicleId) {
  if (!navigator.geolocation) {
    console.error('Geolocation is not supported by this browser.')
    return
  }

  // تتبع مستمر للموقع
  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const gpsData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed ? position.coords.speed * 3.6 : 0, // تحويل من m/s إلى km/h
        heading: position.coords.heading || 0,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toISOString()
      }

      console.log('Current position:', gpsData)
      await sendGPSLocation(vehicleId, gpsData)
    },
    (error) => {
      console.error('Geolocation error:', error)
    },
    {
      enableHighAccuracy: true, // استخدام GPS عالي الدقة
      timeout: 10000,           // انتظار 10 ثوان كحد أقصى
      maximumAge: 0             // عدم استخدام موقع محفوظ
    }
  )

  // لإيقاف التتبع:
  // navigator.geolocation.clearWatch(watchId)
  
  return watchId
}

/**
 * مثال 2: إرسال موقع من جهاز GPS (محاكاة)
 * يمكن استبدال هذا بقراءة حقيقية من GPS module
 */
async function simulateGPSDevice(vehicleId) {
  // موقع ابتدائي (مثال: نيويورك)
  let latitude = 40.7128
  let longitude = -74.0060
  let speed = 0
  let heading = 0

  // إرسال موقع كل 10 ثوان
  setInterval(async () => {
    // محاكاة حركة السيارة
    latitude += (Math.random() - 0.5) * 0.001
    longitude += (Math.random() - 0.5) * 0.001
    speed = Math.random() * 80 // سرعة عشوائية 0-80 km/h
    heading = (heading + (Math.random() - 0.5) * 30) % 360

    const gpsData = {
      latitude,
      longitude,
      speed,
      heading,
      accuracy: 5 + Math.random() * 5, // دقة 5-10 متر
      timestamp: new Date().toISOString()
    }

    console.log('Sending GPS data:', gpsData)
    await sendGPSLocation(vehicleId, gpsData)
  }, 10000) // كل 10 ثوان
}

/**
 * مثال 3: استقبال بيانات من جهاز GPS عبر HTTP
 * يمكن استخدام هذا مع Express.js أو أي web server
 */
async function handleGPSWebhook(req, res) {
  try {
    const { vehicle_id, lat, lon, speed, heading, accuracy } = req.body

    const result = await sendGPSLocation(vehicle_id, {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      speed: parseFloat(speed) || 0,
      heading: parseFloat(heading) || 0,
      accuracy: parseFloat(accuracy) || 10
    })

    if (result.success) {
      res.json({ success: true, message: 'GPS data received' })
    } else {
      res.status(500).json({ success: false, error: result.error })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

/**
 * مثال 4: قراءة من GPS module على Raspberry Pi
 * يتطلب: npm install node-gpsd
 */
/*
import gpsd from 'node-gpsd'

function trackFromGPSModule(vehicleId) {
  const daemon = new gpsd.Daemon({
    program: 'gpsd',
    device: '/dev/ttyUSB0',
    port: 2947,
    pid: '/tmp/gpsd.pid'
  })

  daemon.start(() => {
    console.log('GPSD started')
  })

  const listener = new gpsd.Listener({
    port: 2947,
    hostname: 'localhost',
    parse: true
  })

  listener.on('TPV', async (tpv) => {
    if (tpv.lat && tpv.lon) {
      const gpsData = {
        latitude: tpv.lat,
        longitude: tpv.lon,
        speed: tpv.speed ? tpv.speed * 3.6 : 0, // m/s to km/h
        heading: tpv.track || 0,
        accuracy: tpv.eph || 10
      }

      await sendGPSLocation(vehicleId, gpsData)
    }
  })

  listener.connect(() => {
    console.log('Connected to GPSD')
    listener.watch()
  })
}
*/

// مثال على الاستخدام:
// const vehicleId = 'your-vehicle-uuid-here'
// trackVehicleFromBrowser(vehicleId)
// أو
// simulateGPSDevice(vehicleId)

export {
  sendGPSLocation,
  trackVehicleFromBrowser,
  simulateGPSDevice,
  handleGPSWebhook
}
