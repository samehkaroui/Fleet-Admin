import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, Vehicle, Driver, Trip, MaintenanceRecord, GPSLocation, VehicleAssignment } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface FleetContextType {
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  maintenanceRecords: MaintenanceRecord[];
  gpsLocations: GPSLocation[];
  vehicleAssignments: VehicleAssignment[];
  
  loading: {
    vehicles: boolean;
    drivers: boolean;
    trips: boolean;
    maintenance: boolean;
    gps: boolean;
    assignments: boolean;
  };
  
  refreshVehicles: () => Promise<void>;
  refreshDrivers: () => Promise<void>;
  refreshTrips: () => Promise<void>;
  refreshMaintenance: () => Promise<void>;
  refreshGPS: () => Promise<void>;
  refreshAssignments: () => Promise<void>;
  refreshAll: () => Promise<void>;
  
  createAssignment: (assignment: Omit<VehicleAssignment, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  completeAssignment: (assignmentId: string) => Promise<void>;
  getActiveAssignments: () => VehicleAssignment[];
  getVehicleAssignment: (vehicleId: string) => VehicleAssignment | undefined;
  getDriverAssignment: (driverId: string) => VehicleAssignment | undefined;
  
  getVehicleById: (id: string) => Vehicle | undefined;
  getDriverById: (id: string) => Driver | undefined;
  getTripById: (id: string) => Trip | undefined;
  getActiveTrips: () => Trip[];
  getUpcomingTrips: () => Trip[];
  getVehicleTrips: (vehicleId: string) => Trip[];
  getDriverTrips: (driverId: string) => Trip[];
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [gpsLocations, setGpsLocations] = useState<GPSLocation[]>([]);
  const [vehicleAssignments, setVehicleAssignments] = useState<VehicleAssignment[]>([]);
  
  const [loading, setLoading] = useState({
    vehicles: true,
    drivers: true,
    trips: true,
    maintenance: true,
    gps: true,
    assignments: true,
  });

  const refreshVehicles = useCallback(async () => {
    if (!user) return;
    
    setLoading(prev => ({ ...prev, vehicles: true }));
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(prev => ({ ...prev, vehicles: false }));
    }
  }, [user]);

  const refreshDrivers = useCallback(async () => {
    if (!user) return;
    
    setLoading(prev => ({ ...prev, drivers: true }));
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    } finally {
      setLoading(prev => ({ ...prev, drivers: false }));
    }
  }, [user]);

  const refreshTrips = useCallback(async () => {
    if (!user) return;
    
    setLoading(prev => ({ ...prev, trips: true }));
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .order('departure_time', { ascending: true });
      
      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setLoading(prev => ({ ...prev, trips: false }));
    }
  }, [user]);

  const refreshMaintenance = useCallback(async () => {
    if (!user) return;
    
    setLoading(prev => ({ ...prev, maintenance: true }));
    try {
      const { data, error } = await supabase
        .from('maintenance_records')
        .select('*')
        .order('scheduled_date', { ascending: false });
      
      if (error) throw error;
      setMaintenanceRecords(data || []);
    } catch (error) {
      console.error('Error loading maintenance records:', error);
    } finally {
      setLoading(prev => ({ ...prev, maintenance: false }));
    }
  }, [user]);

  const refreshGPS = useCallback(async () => {
    if (!user) return;
    
    setLoading(prev => ({ ...prev, gps: true }));
    try {
      // Get latest GPS location for each vehicle
      const { data, error } = await supabase
        .from('gps_locations')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      const latestLocations = data?.reduce((acc: GPSLocation[], location) => {
        const existing = acc.find(l => l.vehicle_id === location.vehicle_id);
        if (!existing || new Date(location.timestamp) > new Date(existing.timestamp)) {
          return [...acc.filter(l => l.vehicle_id !== location.vehicle_id), location];
        }
        return acc;
      }, []) || [];
      
      setGpsLocations(latestLocations);
    } catch (error) {
      console.error('Error loading GPS locations:', error);
    } finally {
      setLoading(prev => ({ ...prev, gps: false }));
    }
  }, [user]);

  const refreshAssignments = useCallback(async () => {
    if (!user) return;
    
    setLoading(prev => ({ ...prev, assignments: true }));
    try {
      const { data, error } = await supabase
        .from('vehicle_assignments')
        .select('*')
        .order('assigned_at', { ascending: false });
      
      if (error) throw error;
      setVehicleAssignments(data || []);
    } catch (error) {
      console.error('Error loading vehicle assignments:', error);
    } finally {
      setLoading(prev => ({ ...prev, assignments: false }));
    }
  }, [user]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshVehicles(),
      refreshDrivers(),
      refreshTrips(),
      refreshMaintenance(),
      refreshGPS(),
      refreshAssignments(),
    ]);
  }, [refreshVehicles, refreshDrivers, refreshTrips, refreshMaintenance, refreshGPS, refreshAssignments]);

  const getVehicleById = (id: string) => vehicles.find(v => v.id === id);
  const getDriverById = (id: string) => drivers.find(d => d.id === id);
  const getTripById = (id: string) => trips.find(t => t.id === id);
  
  const getActiveTrips = () => trips.filter(t => t.status === 'in_progress');
  
  const getUpcomingTrips = () => {
    const now = new Date();
    return trips.filter(t => 
      t.status === 'scheduled' && 
      new Date(t.departure_time) > now
    ).sort((a, b) => 
      new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime()
    );
  };
  
  const getVehicleTrips = (vehicleId: string) => 
    trips.filter(t => t.vehicle_id === vehicleId);
  
  const getDriverTrips = (driverId: string) => 
    trips.filter(t => t.driver_id === driverId);

  const createAssignment = useCallback(async (assignment: Omit<VehicleAssignment, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('vehicle_assignments')
        .insert([{
          ...assignment,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
      
      if (error) throw error;
      await refreshAssignments();
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  }, [refreshAssignments]);

  const completeAssignment = useCallback(async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('vehicle_assignments')
        .update({
          status: 'completed',
          returned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);
      
      if (error) throw error;
      await refreshAssignments();
    } catch (error) {
      console.error('Error completing assignment:', error);
      throw error;
    }
  }, [refreshAssignments]);

  const getActiveAssignments = () => vehicleAssignments.filter(a => a.status === 'active');
  
  const getVehicleAssignment = (vehicleId: string) => 
    vehicleAssignments.find(a => a.vehicle_id === vehicleId && a.status === 'active');
  
  const getDriverAssignment = (driverId: string) => 
    vehicleAssignments.find(a => a.driver_id === driverId && a.status === 'active');

  useEffect(() => {
    if (user) {
      refreshAll();
    }
  }, [user, refreshAll]);

  useEffect(() => {
    if (!user) return;

    const subscriptions = [
      supabase
        .channel('vehicles_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'vehicles', filter: `user_id=eq.${user.id}` },
          () => refreshVehicles()
        )
        .subscribe(),
      
      supabase
        .channel('trips_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'trips', filter: `user_id=eq.${user.id}` },
          () => refreshTrips()
        )
        .subscribe(),
      
      supabase
        .channel('drivers_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'drivers', filter: `user_id=eq.${user.id}` },
          () => refreshDrivers()
        )
        .subscribe(),
      
      supabase
        .channel('maintenance_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'maintenance_records' },
          () => refreshMaintenance()
        )
        .subscribe(),
      
      // Real-time GPS location updates
      supabase
        .channel('gps_locations_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'gps_locations' },
          () => refreshGPS()
        )
        .subscribe(),
      
      // Real-time vehicle assignments updates
      supabase
        .channel('assignments_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'vehicle_assignments' },
          () => refreshAssignments()
        )
        .subscribe(),
    ];

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [user, refreshVehicles, refreshTrips, refreshDrivers, refreshMaintenance, refreshGPS, refreshAssignments]);

  const value: FleetContextType = {
    vehicles,
    drivers,
    trips,
    maintenanceRecords,
    gpsLocations,
    vehicleAssignments,
    loading,
    refreshVehicles,
    refreshDrivers,
    refreshTrips,
    refreshMaintenance,
    refreshGPS,
    refreshAssignments,
    refreshAll,
    createAssignment,
    completeAssignment,
    getActiveAssignments,
    getVehicleAssignment,
    getDriverAssignment,
    getVehicleById,
    getDriverById,
    getTripById,
    getActiveTrips,
    getUpcomingTrips,
    getVehicleTrips,
    getDriverTrips,
  };

  return (
    <FleetContext.Provider value={value}>
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const context = useContext(FleetContext);
  if (context === undefined) {
    throw new Error('useFleet must be used within a FleetProvider');
  }
  return context;
}
