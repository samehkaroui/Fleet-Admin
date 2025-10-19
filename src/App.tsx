import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FleetProvider } from './contexts/FleetContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Vehicles from './components/Vehicles';
import GPSTracking from './components/GPSTracking';
import Maintenance from './components/Maintenance';
import Trips from './components/Trips';
import VehicleAssignments from './components/VehicleAssignments';
import Drivers from './components/Drivers';
import UserRoles from './components/UserRoles';
import { Truck, LayoutDashboard, MapPin, Wrench, Route, Users, UserCheck, LogOut, Menu, X, Shield } from 'lucide-react';

type View = 'dashboard' | 'vehicles' | 'drivers' | 'gps' | 'maintenance' | 'trips' | 'assignments' | 'roles';

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const navigation = [
    { id: 'dashboard' as View, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vehicles' as View, label: 'Vehicles', icon: Truck },
    { id: 'drivers' as View, label: 'Drivers', icon: UserCheck },
    { id: 'gps' as View, label: 'GPS Tracking', icon: MapPin },
    { id: 'maintenance' as View, label: 'Maintenance', icon: Wrench },
    { id: 'trips' as View, label: 'Trips', icon: Route },
    { id: 'assignments' as View, label: 'Assignments', icon: Users },
    { id: 'roles' as View, label: 'User Roles', icon: Shield },
  ];

  const handleNavClick = (viewId: View) => {
    setCurrentView(viewId);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex h-screen overflow-hidden">
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-800/95 backdrop-blur-xl border-b border-slate-700/50">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-lg">
                <Truck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Fleet Manager</h1>
                <p className="text-xs text-slate-400">Admin Dashboard</p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-slate-800/50 backdrop-blur-xl border-r border-slate-700/50 
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:w-64
        `}>
          <div className="p-6 border-b border-slate-700/50 hidden lg:block">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 p-3 rounded-xl">
                <Truck className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Fleet Manager</h1>
                <p className="text-xs text-slate-400">Admin Dashboard</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto mt-20 lg:mt-0">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${
                  currentView === item.id
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-700/50">
            <div className="bg-slate-900/50 rounded-xl p-4 mb-3">
              <p className="text-sm text-slate-400 mb-1">Signed in as</p>
              <p className="text-white font-medium text-sm truncate">{user.email}</p>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition font-medium"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </aside>

        {isMobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <main className="flex-1 overflow-y-auto pt-20 lg:pt-0">
          <div className="p-4 sm:p-6 lg:p-8">
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'vehicles' && <Vehicles />}
            {currentView === 'drivers' && <Drivers />}
            {currentView === 'gps' && <GPSTracking />}
            {currentView === 'maintenance' && <Maintenance />}
            {currentView === 'trips' && <Trips />}
            {currentView === 'assignments' && <VehicleAssignments />}
            {currentView === 'roles' && <UserRoles />}
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <FleetProvider>
        <AppContent />
      </FleetProvider>
    </AuthProvider>
  );
}

export default App;
