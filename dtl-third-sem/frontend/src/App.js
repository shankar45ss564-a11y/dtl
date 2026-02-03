import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import './App.css';
import { Toaster, toast } from 'sonner';
import { 
  Car, MapPin, Calendar, Clock, Users, DollarSign, 
  LogOut, User, Home, Search, Plus, CheckCircle, 
  XCircle, ChevronRight, Menu, X, Shield, Activity,
  Upload, AlertCircle, Check, FileCheck, BadgeCheck,
  MessageCircle, Send, Key, Play, Navigation as NavigationIcon,
  Phone, AlertTriangle, CheckCircle2, Eye, EyeOff, MapPinned, Crosshair,
  Repeat, Zap, Star, Filter, Building2, History, Award, ThumbsUp, ThumbsDown,
  Leaf, TrendingUp, Trophy, Target, BarChart3, Flame, Tag, GraduationCap,
  Flag, ClipboardList, Ban, UserX, UserCheck, ScrollText, Trash2, AlertOctagon
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Auth Context
const AuthContext = createContext(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// API Helper
const api = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || 'Something went wrong');
  }
  
  return data;
};

// Map Location Picker Component - Click on map to select location
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });
  return null;
};

// Component to fly to location
const FlyToLocation = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 14);
    }
  }, [center, map]);
  return null;
};

// Map Location Picker Modal
const MapLocationPicker = ({ isOpen, onClose, onSelect, title, initialPosition }) => {
  const [selectedPosition, setSelectedPosition] = useState(initialPosition);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [flyToCenter, setFlyToCenter] = useState(null);
  
  // Default center: Bangalore (RVCE area)
  const defaultCenter = [12.9230, 77.4993];
  
  const handleLocationSelect = (latlng) => {
    setSelectedPosition(latlng);
  };
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      // Using Nominatim (free OpenStreetMap geocoding)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=in`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      toast.error('Search failed. Try again.');
    } finally {
      setIsSearching(false);
    }
  };
  
  const selectSearchResult = (result) => {
    const position = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setSelectedPosition(position);
    setFlyToCenter([position.lat, position.lng]);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
  };
  
  const handleConfirm = async () => {
    if (!selectedPosition) {
      toast.error('Please select a location on the map');
      return;
    }
    
    // Reverse geocode to get address
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedPosition.lat}&lon=${selectedPosition.lng}`
      );
      const data = await response.json();
      const address = data.display_name || `${selectedPosition.lat.toFixed(4)}, ${selectedPosition.lng.toFixed(4)}`;
      const shortAddress = address.split(',').slice(0, 3).join(', ');
      
      onSelect({
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
        address: shortAddress
      });
      onClose();
    } catch (error) {
      // Use coordinates as address fallback
      onSelect({
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
        address: `${selectedPosition.lat.toFixed(4)}, ${selectedPosition.lng.toFixed(4)}`
      });
      onClose();
    }
  };
  
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
          setSelectedPosition(pos);
          setFlyToCenter([pos.lat, pos.lng]);
          toast.success('Location found!');
        },
        (error) => {
          toast.error('Could not get your location');
        }
      );
    } else {
      toast.error('Geolocation not supported');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-[#1A1A1A] rounded-xl w-full max-w-2xl border border-[#333] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="map-picker-modal"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#333]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input-uber flex-1"
              placeholder="Search location..."
              data-testid="map-search-input"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="btn-uber-dark px-4"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={getCurrentLocation}
              className="btn-uber-green px-4"
              title="Use current location"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-2 bg-[#0D0D0D] rounded-lg border border-[#333] max-h-40 overflow-y-auto">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  onClick={() => selectSearchResult(result)}
                  className="w-full text-left px-3 py-2 hover:bg-[#333] text-white text-sm border-b border-[#333] last:border-b-0"
                >
                  <MapPin className="w-4 h-4 inline mr-2 text-[#06C167]" />
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Map */}
        <div className="h-80">
          <MapContainer
            center={initialPosition ? [initialPosition.lat, initialPosition.lng] : defaultCenter}
            zoom={13}
            className="h-full w-full"
            style={{ background: '#0D0D0D' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="map-tiles-dark"
            />
            <MapClickHandler onLocationSelect={handleLocationSelect} />
            {flyToCenter && <FlyToLocation center={flyToCenter} />}
            {selectedPosition && (
              <Marker position={[selectedPosition.lat, selectedPosition.lng]} icon={greenIcon} />
            )}
          </MapContainer>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-[#333]">
          {selectedPosition && (
            <p className="text-gray-400 text-sm mb-3">
              Selected: {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 btn-uber-dark py-3">
              Cancel
            </button>
            <button 
              onClick={handleConfirm} 
              className="flex-1 btn-uber-green py-3"
              disabled={!selectedPosition}
              data-testid="confirm-location-btn"
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Route Map Component - Displays route between two points
const RouteMap = ({ sourceLat, sourceLng, destLat, destLng, sourceLabel, destLabel }) => {
  const [route, setRoute] = useState([]);
  
  useEffect(() => {
    const fetchRoute = async () => {
      if (!sourceLat || !sourceLng || !destLat || !destLng) return;
      
      try {
        // Use OSRM for routing (free)
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${sourceLng},${sourceLat};${destLng},${destLat}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          setRoute(coords);
        }
      } catch (error) {
        console.error('Failed to fetch route:', error);
        // Fallback to straight line
        setRoute([[sourceLat, sourceLng], [destLat, destLng]]);
      }
    };
    
    fetchRoute();
  }, [sourceLat, sourceLng, destLat, destLng]);
  
  if (!sourceLat || !sourceLng || !destLat || !destLng) {
    return (
      <div className="h-64 bg-[#0D0D0D] rounded-xl flex items-center justify-center">
        <p className="text-gray-500">No route coordinates available</p>
      </div>
    );
  }
  
  const center = [(sourceLat + destLat) / 2, (sourceLng + destLng) / 2];
  
  return (
    <div className="h-64 rounded-xl overflow-hidden">
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full"
        style={{ background: '#0D0D0D' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[sourceLat, sourceLng]} icon={greenIcon} />
        <Marker position={[destLat, destLng]} icon={redIcon} />
        {route.length > 0 && (
          <Polyline 
            positions={route} 
            color="#06C167" 
            weight={4}
            opacity={0.8}
          />
        )}
      </MapContainer>
    </div>
  );
};

// Verified Badge Component
const VerifiedBadge = ({ status, size = 'sm' }) => {
  if (status !== 'verified') return null;
  
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  return (
    <div 
      className={`${sizeClasses[size]} rounded-full bg-white flex items-center justify-center flex-shrink-0`}
      title="Verified Student"
      data-testid="verified-badge"
    >
      <Check className={`${size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} text-black`} />
    </div>
  );
};

// Verification Status Badge
const VerificationStatusBadge = ({ status }) => {
  const statusConfig = {
    verified: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Verified' },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
    unverified: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Unverified' }
  };
  
  const config = statusConfig[status] || statusConfig.unverified;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {status === 'verified' && <Check className="w-3 h-3" />}
      {status === 'pending' && <Clock className="w-3 h-3" />}
      {status === 'rejected' && <XCircle className="w-3 h-3" />}
      {status === 'unverified' && <AlertCircle className="w-3 h-3" />}
      {config.label}
    </span>
  );
};

// Auth Provider Component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api('/api/auth/me')
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const signup = async (email, password, name, role) => {
    const data = await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const refreshUser = async () => {
    try {
      const data = await api('/api/auth/me');
      setUser(data.user);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Navigation Component
const Navigation = ({ currentPage, setCurrentPage }) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = user?.is_admin
    ? [
        { id: 'admin', label: 'Dashboard', icon: Shield },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'rides-monitoring', label: 'Rides', icon: Car },
        { id: 'reports', label: 'Reports', icon: Flag },
        { id: 'sos', label: 'SOS', icon: AlertTriangle },
        { id: 'verifications', label: 'Verify', icon: FileCheck },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'audit-logs', label: 'Logs', icon: ScrollText },
        { id: 'profile', label: 'Profile', icon: User },
      ]
    : user?.role === 'driver'
    ? [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'post-ride', label: 'Post Ride', icon: Plus },
        { id: 'requests', label: 'Requests', icon: Activity },
        { id: 'stats', label: 'Insights', icon: BarChart3 },
        { id: 'history', label: 'History', icon: History },
        { id: 'profile', label: 'Profile', icon: User },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'browse', label: 'Browse Rides', icon: Search },
        { id: 'my-requests', label: 'My Requests', icon: Activity },
        { id: 'stats', label: 'Insights', icon: BarChart3 },
        { id: 'history', label: 'History', icon: History },
        { id: 'profile', label: 'Profile', icon: User },
      ];

  return (
    <nav className="bg-black border-b border-[#333] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentPage('dashboard')}>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <Car className="w-6 h-6 text-black" />
            </div>
            <span className="text-xl font-bold text-white">CampusPool</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
            <div className="h-6 w-px bg-[#333]" />
            <button
              onClick={logout}
              className="nav-link text-red-400 hover:text-red-300"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[#333] animate-fade-in">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left py-3 px-4 ${
                  currentPage === item.id ? 'text-white bg-[#1A1A1A]' : 'text-gray-400'
                } flex items-center gap-3 rounded-lg`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
            <button
              onClick={logout}
              className="w-full text-left py-3 px-4 text-red-400 flex items-center gap-3 rounded-lg mt-2"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

// Login Page
const LoginPage = ({ onSwitch }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 map-decoration" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black" />
        <div className="relative z-10 flex flex-col justify-center p-16">
          <div className="animate-slide-up">
            <h1 className="text-5xl font-bold text-white mb-4">CampusPool</h1>
            <p className="text-xl text-gray-400 max-w-md">
              Share rides with fellow students. Save money, reduce carbon footprint, make friends.
            </p>
          </div>
          <div className="mt-12 flex items-center gap-6">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-12 h-12 rounded-full bg-[#1A1A1A] border-2 border-black flex items-center justify-center"
                >
                  <User className="w-5 h-5 text-gray-500" />
                </div>
              ))}
            </div>
            <p className="text-gray-400">Join hundreds of RVCE students</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
              <Car className="w-7 h-7 text-black" />
            </div>
            <span className="text-2xl font-bold text-white">CampusPool</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-gray-400 mb-8">Sign in to continue to CampusPool</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-uber"
                placeholder="you@rvce.edu.in"
                required
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-uber"
                placeholder="••••••••"
                required
                data-testid="login-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-uber mt-6"
              data-testid="login-submit"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-gray-400">
            Don't have an account?{' '}
            <button
              onClick={onSwitch}
              className="text-white hover:underline font-medium"
              data-testid="switch-to-signup"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Signup Page
const SignupPage = ({ onSwitch }) => {
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'rider',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(formData.email, formData.password, formData.name, formData.role);
      toast.success('Account created successfully!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 map-decoration" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black" />
        <div className="relative z-10 flex flex-col justify-center p-16">
          <div className="animate-slide-up">
            <h1 className="text-5xl font-bold text-white mb-4">Join CampusPool</h1>
            <p className="text-xl text-gray-400 max-w-md">
              Create an account with your RVCE email and start sharing rides today.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-6">
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
              <Car className="w-8 h-8 text-[#06C167] mb-3" />
              <h3 className="text-white font-semibold mb-1">As a Driver</h3>
              <p className="text-gray-400 text-sm">Post rides and split costs</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
              <Users className="w-8 h-8 text-[#06C167] mb-3" />
              <h3 className="text-white font-semibold mb-1">As a Rider</h3>
              <p className="text-gray-400 text-sm">Find affordable rides</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
              <Car className="w-7 h-7 text-black" />
            </div>
            <span className="text-2xl font-bold text-white">CampusPool</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Create account</h2>
          <p className="text-gray-400 mb-8">Sign up with your RVCE email</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-uber"
                placeholder="John Doe"
                required
                data-testid="signup-name"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-uber"
                placeholder="you@rvce.edu.in"
                required
                data-testid="signup-email"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input-uber"
                placeholder="••••••••"
                required
                minLength={6}
                data-testid="signup-password"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">I want to</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'rider' })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.role === 'rider'
                      ? 'border-white bg-white/5'
                      : 'border-[#333] hover:border-[#555]'
                  }`}
                  data-testid="role-rider"
                >
                  <Users className={`w-6 h-6 mx-auto mb-2 ${formData.role === 'rider' ? 'text-white' : 'text-gray-500'}`} />
                  <span className={formData.role === 'rider' ? 'text-white' : 'text-gray-500'}>
                    Find Rides
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'driver' })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.role === 'driver'
                      ? 'border-white bg-white/5'
                      : 'border-[#333] hover:border-[#555]'
                  }`}
                  data-testid="role-driver"
                >
                  <Car className={`w-6 h-6 mx-auto mb-2 ${formData.role === 'driver' ? 'text-white' : 'text-gray-500'}`} />
                  <span className={formData.role === 'driver' ? 'text-white' : 'text-gray-500'}>
                    Offer Rides
                  </span>
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-uber mt-6"
              data-testid="signup-submit"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-8 text-center text-gray-400">
            Already have an account?{' '}
            <button
              onClick={onSwitch}
              className="text-white hover:underline font-medium"
              data-testid="switch-to-login"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Profile Modal Component - Enhanced with Phase 6 Rating & Trust and Phase 7 Community
const ProfileModal = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await api(`/api/users/${userId}/profile`);
        setProfile(data.profile);
      } catch (error) {
        toast.error('Failed to load profile');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [userId, onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-[#1A1A1A] rounded-xl p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="animate-pulse">
            <div className="w-20 h-20 rounded-full bg-[#333] mx-auto mb-4" />
            <div className="h-6 bg-[#333] rounded w-32 mx-auto mb-2" />
            <div className="h-4 bg-[#333] rounded w-24 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#1A1A1A] rounded-xl p-8 max-w-md w-full mx-4 border border-[#333] animate-fade-in relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="profile-modal"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[#333] flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-gray-400" />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <h3 className="text-xl font-semibold text-white">{profile?.name}</h3>
            <VerifiedBadge status={profile?.verification_status} size="sm" />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className={`status-badge ${profile?.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
              {profile?.role}
            </span>
            <VerificationStatusBadge status={profile?.verification_status} />
          </div>
          
          {/* Phase 7: Academic Details */}
          {(profile?.branch_name || profile?.academic_year_name) && (
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-2">
              <GraduationCap className="w-4 h-4 text-[#06C167]" />
              {profile.branch_name && <span>{profile.branch_name}</span>}
              {profile.branch_name && profile.academic_year_name && <span>•</span>}
              {profile.academic_year_name && <span>{profile.academic_year_name}</span>}
            </div>
          )}
          
          {/* Phase 7: Mutual Academic Info */}
          {profile?.mutual_info && (
            <div className="flex items-center justify-center gap-2 mb-4">
              {profile.mutual_info.same_branch && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#06C167]/20 text-[#06C167]" data-testid="mutual-branch-badge">
                  <Users className="w-3 h-3" /> Same Branch
                </span>
              )}
              {profile.mutual_info.same_year && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400" data-testid="mutual-year-badge">
                  <GraduationCap className="w-3 h-3" /> Same Year
                </span>
              )}
            </div>
          )}
          
          {/* Phase 6: Trust Badge */}
          {profile?.trust_level && (
            <div className="flex justify-center mb-4">
              <TrustBadge trustLevel={profile.trust_level} size="md" />
            </div>
          )}

          {/* Phase 6: Rating Display */}
          <div className="bg-[#0D0D0D] rounded-lg p-4 mt-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              {profile?.average_rating ? (
                <>
                  <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold text-white">{profile.average_rating.toFixed(1)}</span>
                  <span className="text-gray-500 text-sm">
                    ({profile.total_ratings || 0} {profile.total_ratings === 1 ? 'rating' : 'ratings'})
                  </span>
                </>
              ) : (
                <span className="text-gray-500 text-sm">No ratings yet</span>
              )}
            </div>
            <div className="pt-3 border-t border-[#333]">
              <p className="text-gray-400 text-sm mb-1">Completed Rides</p>
              <p className="text-xl font-bold text-white">{profile?.ride_count || 0}</p>
            </div>
          </div>
          
          {/* Phase 7: Badges Display in Profile Modal */}
          {profile?.badges && profile.badges.length > 0 && (
            <div className="bg-[#0D0D0D] rounded-lg p-4 mt-4">
              <p className="text-gray-400 text-sm mb-3">Badges</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {profile.badges.map((badge) => (
                  <span 
                    key={badge.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1A1A1A] text-xs"
                    title={badge.description}
                  >
                    <span>{badge.icon}</span>
                    <span className="text-gray-300">{badge.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-gray-500 text-sm mt-4">
            Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full btn-uber-dark mt-6"
        >
          Close
        </button>
      </div>
    </div>
  );
};

// Chat Modal Component - Phase 3
const ChatModal = ({ requestId, otherUserName, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const data = await api(`/api/chat/${requestId}/messages`);
      setMessages(data.messages);
      setChatEnabled(data.chat_enabled);
    } catch (error) {
      if (error.message.includes('only available after')) {
        setChatEnabled(false);
      }
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 3 seconds
    pollIntervalRef.current = setInterval(loadMessages, 3000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [requestId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !chatEnabled) return;

    setSending(true);
    try {
      await api(`/api/chat/${requestId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: newMessage.trim() }),
      });
      setNewMessage('');
      loadMessages();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#1A1A1A] rounded-xl w-full max-w-lg h-[600px] mx-4 border border-[#333] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="chat-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">{otherUserName}</h3>
              <p className="text-xs text-gray-500">
                {chatEnabled ? 'Chat active' : 'Chat disabled'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
            data-testid="close-chat-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-gray-500">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No messages yet</p>
                <p className="text-gray-600 text-sm">Start the conversation!</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`chat-message ${msg.sender_id === user?.id ? 'chat-message-own' : 'chat-message-other'}`}
                  data-testid={`chat-message-${msg.id}`}
                >
                  {msg.sender_id !== user?.id && (
                    <p className="text-xs text-gray-400 mb-1">{msg.sender_name}</p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="chat-input-container">
          {chatEnabled ? (
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="input-uber flex-1"
                placeholder="Type a message..."
                maxLength={1000}
                data-testid="chat-input"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="btn-uber-green px-4 disabled:opacity-50"
                data-testid="send-message-btn"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          ) : (
            <div className="text-center text-gray-500 py-2">
              <p className="text-sm">Chat is disabled after ride completion</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Live Ride Screen Component - Phase 4
const LiveRideScreen = ({ requestId, onBack }) => {
  const { user } = useAuth();
  const [rideData, setRideData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [reachingLoading, setReachingLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  // Phase 6: Rating state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [ratingInfo, setRatingInfo] = useState(null); // Phase 6: Store rating target info

  const loadRideData = async () => {
    try {
      const data = await api(`/api/ride-requests/${requestId}/live`);
      setRideData(data.ride);
      setSosTriggered(data.ride.has_active_sos);
      
      // Phase 6: Check if user can rate after ride completion
      if (data.ride.status === 'completed') {
        try {
          const rateCheck = await api(`/api/ratings/can-rate/${requestId}`);
          setCanRate(rateCheck.can_rate);
          if (rateCheck.can_rate) {
            setRatingInfo({
              ratedUserName: rateCheck.rated_user_name,
              ratedRole: rateCheck.rated_role === 'driver' ? 'Driver' : 'Rider'
            });
          }
        } catch (e) {
          console.log('Could not check rating status');
        }
      }
    } catch (error) {
      toast.error('Failed to load ride details');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRideData();
    // Poll for updates every 10 seconds
    const interval = setInterval(loadRideData, 10000);
    return () => clearInterval(interval);
  }, [requestId]);

  const handleSOS = async () => {
    setSosLoading(true);
    try {
      // Try to get user's location
      let latitude = null;
      let longitude = null;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (e) {
          console.log('Could not get location:', e);
        }
      }

      await api('/api/sos', {
        method: 'POST',
        body: JSON.stringify({
          ride_request_id: requestId,
          latitude,
          longitude,
          message: 'Emergency SOS triggered'
        }),
      });
      
      toast.success('🚨 SOS Alert Sent! Help is on the way.');
      setSosTriggered(true);
      setShowSosConfirm(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSosLoading(false);
    }
  };

  const handleReachedSafely = async () => {
    setReachingLoading(true);
    try {
      await api(`/api/ride-requests/${requestId}/reached-safely`, {
        method: 'POST',
      });
      toast.success('🎉 You\'ve arrived safely! Ride completed.');
      // Phase 6: Show rating modal instead of going back immediately
      loadRideData(); // Reload to get completed status
      setShowRatingModal(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setReachingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Car className="w-8 h-8 text-black" />
          </div>
          <p className="text-gray-400">Loading ride details...</p>
        </div>
      </div>
    );
  }

  if (!rideData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-white mb-4">Ride not found</p>
          <button onClick={onBack} className="btn-uber">Go Back</button>
        </div>
      </div>
    );
  }

  const isRider = rideData.rider_id === user?.id;
  const isDriver = rideData.driver_id === user?.id;
  const isOngoing = rideData.status === 'ongoing';

  // Check if coordinates are available for route visualization
  const hasCoordinates = rideData.source_lat && rideData.source_lng && 
                         rideData.destination_lat && rideData.destination_lng;

  return (
    <div className="min-h-screen bg-black" data-testid="live-ride-screen">
      {/* Header */}
      <div className="bg-black border-b border-[#333] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white flex items-center gap-2"
              data-testid="back-btn"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <span className={`status-badge ${isOngoing ? 'bg-purple-500/20 text-purple-400' : 'status-' + rideData.status}`}>
                {isOngoing ? '🚗 Ongoing' : rideData.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Map Section - Using RouteMap component for actual route visualization */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden mb-6">
          <div className="relative">
            {/* Route Map with actual coordinates */}
            {hasCoordinates ? (
              <RouteMap
                sourceLat={rideData.source_lat}
                sourceLng={rideData.source_lng}
                destLat={rideData.destination_lat}
                destLng={rideData.destination_lng}
                sourceLabel={rideData.ride_source}
                destLabel={rideData.ride_destination}
              />
            ) : (
              <div className="h-64 bg-[#0D0D0D] flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Route visualization unavailable</p>
                  <p className="text-gray-600 text-xs">Coordinates not available for this ride</p>
                </div>
              </div>
            )}
            {/* Live Route Badge */}
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#333] z-[1000]">
              <div className="flex items-center gap-2 text-[#06C167]">
                <NavigationIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Live Route</span>
              </div>
            </div>
          </div>
          {/* Route Summary Bar */}
          <div className="bg-[#0D0D0D] px-4 py-3 border-t border-[#333]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#06C167]" />
                <span className="text-white text-sm truncate max-w-[120px] md:max-w-none">{rideData.ride_source}</span>
              </div>
              <div className="flex-1 mx-4 h-px bg-[#333] relative">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <Car className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white text-sm truncate max-w-[120px] md:max-w-none">{rideData.ride_destination}</span>
                <div className="w-3 h-3 rounded-full bg-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Ride Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Driver/Rider Info */}
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333]">
            <h3 className="text-gray-400 text-sm mb-3">{isRider ? 'Your Driver' : 'Your Rider'}</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="text-white font-semibold flex items-center gap-2">
                  {isRider ? rideData.driver_name : rideData.rider_name}
                  {(isRider ? rideData.driver_verification_status : rideData.rider_verification_status) === 'verified' && (
                    <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-black" />
                    </span>
                  )}
                </p>
                <p className="text-gray-500 text-sm">{isRider ? 'Driver' : 'Rider'} • Verified</p>
              </div>
            </div>
            
            {/* Vehicle Details - Only shown to rider */}
            {isRider && (rideData.driver_vehicle_model || rideData.driver_vehicle_number || rideData.driver_vehicle_color) && (
              <div className="mt-4 p-3 bg-[#0D0D0D] rounded-lg border border-[#333]" data-testid="vehicle-details">
                <p className="text-gray-500 text-xs mb-2 flex items-center gap-1">
                  <Car className="w-3 h-3" /> VEHICLE
                </p>
                <div className="space-y-1">
                  {rideData.driver_vehicle_model && (
                    <p className="text-white text-sm font-medium">{rideData.driver_vehicle_model}</p>
                  )}
                  {rideData.driver_vehicle_number && (
                    <p className="text-[#06C167] text-sm font-mono">{rideData.driver_vehicle_number}</p>
                  )}
                  {rideData.driver_vehicle_color && (
                    <p className="text-gray-400 text-xs">{rideData.driver_vehicle_color}</p>
                  )}
                </div>
              </div>
            )}
            
            <button
              onClick={() => setShowChat(true)}
              className="w-full mt-4 btn-uber-dark py-2 flex items-center justify-center gap-2"
              data-testid="live-chat-btn"
            >
              <MessageCircle className="w-4 h-4" />
              Message
            </button>
          </div>

          {/* Time Info */}
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333]">
            <h3 className="text-gray-400 text-sm mb-3">Ride Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Date
                </span>
                <span className="text-white">{rideData.ride_date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Scheduled Time
                </span>
                <span className="text-white">{rideData.ride_time}</span>
              </div>
              {rideData.ride_started_at && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <Play className="w-4 h-4" /> Started
                  </span>
                  <span className="text-[#06C167]">
                    {new Date(rideData.ride_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {rideData.estimated_arrival && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <MapPinned className="w-4 h-4" /> ETA
                  </span>
                  <span className="text-white">
                    {new Date(rideData.estimated_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {rideData.estimated_duration_minutes && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Duration
                  </span>
                  <span className="text-white">~{rideData.estimated_duration_minutes} mins</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Route Summary Card */}
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333] mb-6">
          <h3 className="text-gray-400 text-sm mb-4">Route Summary</h3>
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-[#06C167] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <div className="w-0.5 h-12 bg-[#333]" />
              <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-black" />
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-4">
                <p className="text-gray-500 text-xs mb-1">PICKUP</p>
                <p className="text-white font-medium">{rideData.ride_source}</p>
                {/* Phase 5: Pickup Point Display */}
                {rideData.pickup_point_name && (
                  <p className="text-[#06C167] text-sm flex items-center gap-1 mt-1">
                    <Building2 className="w-3 h-3" /> {rideData.pickup_point_name}
                  </p>
                )}
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">DROP-OFF</p>
                <p className="text-white font-medium">{rideData.ride_destination}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs mb-1">COST</p>
              <p className="text-white font-semibold">₹{rideData.ride_estimated_cost}</p>
            </div>
          </div>
        </div>

        {/* SOS Active Alert */}
        {sosTriggered && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-red-400 font-semibold">SOS Alert Active</p>
                <p className="text-red-400/70 text-sm">Emergency services have been notified</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons for Ongoing Ride */}
        {isOngoing && (
          <div className="space-y-4">
            {/* Reached Safely Button - Only for Rider */}
            {isRider && (
              <button
                onClick={handleReachedSafely}
                disabled={reachingLoading}
                className="w-full bg-[#06C167] hover:bg-[#05a857] text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition disabled:opacity-50"
                data-testid="reached-safely-btn"
              >
                <CheckCircle2 className="w-6 h-6" />
                {reachingLoading ? 'Confirming...' : 'I\'ve Reached Safely'}
              </button>
            )}

            {/* SOS Button */}
            {!sosTriggered ? (
              <button
                onClick={() => setShowSosConfirm(true)}
                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold py-4 rounded-xl flex items-center justify-center gap-3 border border-red-500/50 transition"
                data-testid="sos-btn"
              >
                <AlertTriangle className="w-6 h-6" />
                Emergency SOS
              </button>
            ) : (
              <div className="w-full bg-red-500/10 text-red-400/70 font-medium py-4 rounded-xl flex items-center justify-center gap-3 border border-red-500/30">
                <Check className="w-5 h-5" />
                SOS Alert Already Sent
              </div>
            )}
          </div>
        )}

        {/* Ride Completed Message */}
        {rideData.status === 'completed' && (
          <div className="space-y-4">
            <div className="bg-[#06C167]/20 border border-[#06C167]/50 rounded-xl p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-[#06C167] mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Ride Completed!</p>
              {rideData.reached_safely_at && (
                <p className="text-gray-400 text-sm">
                  Arrived safely at {new Date(rideData.reached_safely_at).toLocaleTimeString()}
                </p>
              )}
            </div>
            
            {/* Phase 6: Rating Prompt */}
            {canRate && (
              <button
                onClick={() => setShowRatingModal(true)}
                className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400 font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition"
                data-testid="rate-ride-btn"
              >
                <Star className="w-5 h-5" />
                Rate Your {isRider ? 'Driver' : 'Rider'}
              </button>
            )}
            
            <button
              onClick={onBack}
              className="w-full btn-uber-dark py-3"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>

      {/* SOS Confirmation Modal */}
      {showSosConfirm && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowSosConfirm(false)}>
          <div 
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-sm w-full border border-red-500/50 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            data-testid="sos-confirm-modal"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Trigger Emergency SOS?</h3>
              <p className="text-gray-400 text-sm">
                This will alert the admin and log your current location. Use only in genuine emergencies.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleSOS}
                disabled={sosLoading}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                data-testid="confirm-sos-btn"
              >
                {sosLoading ? 'Sending Alert...' : 'Yes, Send SOS Alert'}
              </button>
              <button
                onClick={() => setShowSosConfirm(false)}
                className="w-full btn-uber-dark py-3"
                data-testid="cancel-sos-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChat && (
        <ChatModal
          requestId={requestId}
          otherUserName={isRider ? rideData.driver_name : rideData.rider_name}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Phase 6: Rating Modal */}
      {showRatingModal && ratingInfo && (
        <RatingModal
          rideRequestId={requestId}
          ratedUserName={ratingInfo.ratedUserName}
          ratedRole={ratingInfo.ratedRole}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => {
            setCanRate(false);
            loadRideData();
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// Phase 6: Feedback, History & Trust Loop Components
// ==========================================

// Phase 6: Star Rating Component
const StarRating = ({ rating, setRating, size = 'md', readonly = false }) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10'
  };
  
  return (
    <div className="flex gap-1" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && setRating(star)}
          onMouseEnter={() => !readonly && setHoverRating(star)}
          onMouseLeave={() => !readonly && setHoverRating(0)}
          className={`transition-all ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          data-testid={`star-${star}`}
        >
          <Star
            className={`${sizes[size]} ${
              star <= (hoverRating || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-600'
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
};

// Phase 6: Trust Badge Component
const TrustBadge = ({ trustLevel, size = 'sm' }) => {
  if (!trustLevel) return null;
  
  const styles = {
    trusted: {
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      border: 'border-green-500/50',
      icon: Award,
    },
    regular: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/50',
      icon: Check,
    },
    new: {
      bg: 'bg-gray-500/20',
      text: 'text-gray-400',
      border: 'border-gray-500/50',
      icon: User,
    },
    low: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/50',
      icon: AlertCircle,
    },
  };
  
  const style = styles[trustLevel.level] || styles.new;
  const Icon = style.icon;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };
  
  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses[size]}`}
      data-testid="trust-badge"
    >
      <Icon className="w-3 h-3" />
      {trustLevel.label}
    </span>
  );
};

// Phase 6: Rating Display Component
const RatingDisplay = ({ rating, totalRatings, size = 'md' }) => {
  if (!rating && !totalRatings) {
    return (
      <div className="flex items-center gap-1 text-gray-500">
        <Star className="w-4 h-4" />
        <span className="text-sm">No ratings yet</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2" data-testid="rating-display">
      <div className="flex items-center gap-1">
        <Star className={`${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} fill-yellow-400 text-yellow-400`} />
        <span className={`font-semibold text-white ${size === 'lg' ? 'text-xl' : ''}`}>
          {rating?.toFixed(1) || '—'}
        </span>
      </div>
      <span className="text-gray-500 text-sm">
        ({totalRatings || 0} {totalRatings === 1 ? 'rating' : 'ratings'})
      </span>
    </div>
  );
};

// Phase 6: Rating Modal Component
const RatingModal = ({ rideRequestId, ratedUserName, ratedRole, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    
    setLoading(true);
    try {
      await api('/api/ratings', {
        method: 'POST',
        body: JSON.stringify({
          ride_request_id: rideRequestId,
          rating,
          feedback: feedback.trim() || null,
        }),
      });
      toast.success('Thank you for your feedback!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full border border-[#333] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="rating-modal"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#06C167]/20 flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-[#06C167]" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Rate Your {ratedRole}</h3>
          <p className="text-gray-400 text-sm">
            How was your experience with {ratedUserName}?
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Star Rating */}
          <div className="flex justify-center">
            <StarRating rating={rating} setRating={setRating} size="xl" />
          </div>
          
          {/* Rating Labels */}
          <div className="flex justify-between text-xs text-gray-500 px-2">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
          
          {/* Feedback */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Feedback (optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="input-uber h-24 resize-none"
              placeholder="Share your experience..."
              maxLength={500}
              data-testid="rating-feedback"
            />
            <p className="text-xs text-gray-600 mt-1 text-right">
              {feedback.length}/500
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-uber-dark"
              disabled={loading}
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="flex-1 btn-uber-green disabled:opacity-50"
              data-testid="submit-rating-btn"
            >
              {loading ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Phase 7: Community, Engagement & Insights Components
// ==========================================

// Phase 7: User Stats Dashboard Component
const UserStatsCard = ({ stats, badges }) => {
  if (!stats) return null;
  
  return (
    <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden" data-testid="user-stats-card">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#333]">
        <div className="bg-[#1A1A1A] p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.rides_offered}</p>
          <p className="text-xs text-gray-400">Rides Offered</p>
        </div>
        <div className="bg-[#1A1A1A] p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.rides_taken}</p>
          <p className="text-xs text-gray-400">Rides Taken</p>
        </div>
        <div className="bg-[#1A1A1A] p-4 text-center">
          <p className="text-2xl font-bold text-[#06C167]">₹{stats.money_saved}</p>
          <p className="text-xs text-gray-400">Money Saved</p>
        </div>
        <div className="bg-[#1A1A1A] p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.total_distance_km} km</p>
          <p className="text-xs text-gray-400">Distance Shared</p>
        </div>
      </div>
      
      {/* Eco Impact Section */}
      <div className="p-4 border-t border-[#333] bg-[#0D0D0D]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-green-400">{stats.total_co2_saved_kg} kg</p>
            <p className="text-xs text-gray-400">CO₂ Saved</p>
          </div>
        </div>
      </div>
      
      {/* Streak Display */}
      {stats.streak && (stats.streak.current > 0 || stats.streak.longest > 0) && (
        <div className="p-4 border-t border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="text-white font-medium">{stats.streak.current} day streak</span>
          </div>
          {stats.streak.longest > stats.streak.current && (
            <span className="text-xs text-gray-500">Best: {stats.streak.longest} days</span>
          )}
        </div>
      )}
      
      {/* Badges Section */}
      {badges && badges.length > 0 && (
        <div className="p-4 border-t border-[#333]">
          <p className="text-xs text-gray-500 mb-3">BADGES EARNED</p>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 text-sm"
                title={badge.description}
                data-testid={`badge-${badge.id}`}
              >
                <span>{badge.icon}</span>
                <span>{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Phase 7: Weekly Summary Component
const WeeklySummaryCard = ({ summary }) => {
  if (!summary) return null;
  
  return (
    <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333]" data-testid="weekly-summary-card">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-[#06C167]" />
        <h3 className="text-white font-semibold">This Week</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-xl font-bold text-white">{summary.rides_completed}</p>
          <p className="text-xs text-gray-400">Rides</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-[#06C167]">₹{summary.money_saved}</p>
          <p className="text-xs text-gray-400">Saved</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-green-400">{summary.co2_saved_kg} kg</p>
          <p className="text-xs text-gray-400">CO₂</p>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 text-center mt-3">{summary.period}</p>
    </div>
  );
};

// Phase 7: Eco Impact Banner (Platform-wide)
const EcoImpactBanner = () => {
  const [impact, setImpact] = useState(null);
  
  useEffect(() => {
    const loadImpact = async () => {
      try {
        const data = await api('/api/eco-impact');
        setImpact(data.eco_impact);
      } catch (error) {
        console.error('Failed to load eco impact:', error);
      }
    };
    loadImpact();
  }, []);
  
  if (!impact) return null;
  
  return (
    <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30 mb-6" data-testid="eco-impact-banner">
      <div className="flex items-center gap-3 mb-3">
        <Leaf className="w-6 h-6 text-green-400" />
        <h3 className="text-white font-semibold">CampusPool Eco Impact</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-2xl font-bold text-green-400">{impact.total_co2_saved_kg}</p>
          <p className="text-xs text-gray-400">kg CO₂ Saved</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{impact.total_shared_rides}</p>
          <p className="text-xs text-gray-400">Rides Shared</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-400">{impact.trees_equivalent}</p>
          <p className="text-xs text-gray-400">Trees Equivalent</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-400">{impact.fuel_liters_saved}L</p>
          <p className="text-xs text-gray-400">Fuel Saved</p>
        </div>
      </div>
    </div>
  );
};

// Phase 7: Event Tags Filter Component
const EventTagsFilter = ({ selectedTag, onSelectTag }) => {
  const [eventTags, setEventTags] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadTags = async () => {
      try {
        const data = await api('/api/event-tags');
        setEventTags(data.event_tags);
      } catch (error) {
        console.error('Failed to load event tags:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTags();
  }, []);
  
  if (loading || eventTags.length === 0) return null;
  
  return (
    <div className="mb-4" data-testid="event-tags-filter">
      <p className="text-xs text-gray-500 mb-2">FILTER BY EVENT</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelectTag('')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
            !selectedTag 
              ? 'bg-white text-black' 
              : 'bg-[#333] text-gray-400 hover:bg-[#444]'
          }`}
        >
          All Rides
        </button>
        {eventTags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => onSelectTag(tag.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
              selectedTag === tag.id 
                ? 'bg-[#06C167] text-black' 
                : 'bg-[#333] text-gray-400 hover:bg-[#444]'
            }`}
            title={tag.description}
            data-testid={`event-tag-${tag.id}`}
          >
            <Tag className="w-3 h-3" />
            {tag.name}
          </button>
        ))}
      </div>
    </div>
  );
};

// Phase 7: Community Filters Component
const CommunityFilters = ({ branch, academicYear, onBranchChange, onYearChange }) => {
  const [branches, setBranches] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [branchData, yearData] = await Promise.all([
          api('/api/branches'),
          api('/api/academic-years')
        ]);
        setBranches(branchData.branches);
        setAcademicYears(yearData.academic_years);
      } catch (error) {
        console.error('Failed to load community options:', error);
      }
    };
    loadOptions();
  }, []);
  
  return (
    <div className="flex flex-wrap gap-3" data-testid="community-filters">
      <select
        value={branch}
        onChange={(e) => onBranchChange(e.target.value)}
        className="input-uber text-sm py-2"
        data-testid="branch-filter"
      >
        <option value="">All Branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      
      <select
        value={academicYear}
        onChange={(e) => onYearChange(e.target.value)}
        className="input-uber text-sm py-2"
        data-testid="year-filter"
      >
        <option value="">All Years</option>
        {academicYears.map((y) => (
          <option key={y.id} value={y.id}>{y.name}</option>
        ))}
      </select>
    </div>
  );
};

// Phase 7: Badge Display on Profile
const BadgesDisplay = ({ badges }) => {
  if (!badges || badges.length === 0) return null;
  
  return (
    <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333]" data-testid="badges-display">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <h3 className="text-white font-semibold">Badges</h3>
      </div>
      
      <div className="flex flex-wrap gap-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0D0D0D] border border-[#333]"
            title={badge.description}
          >
            <span className="text-xl">{badge.icon}</span>
            <div>
              <p className="text-white text-sm font-medium">{badge.name}</p>
              <p className="text-gray-500 text-xs">{badge.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Phase 7: Community Info Display (for ride cards)
const CommunityBadge = ({ branch, academicYear }) => {
  if (!branch && !academicYear) return null;
  
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <GraduationCap className="w-3 h-3" />
      {branch && <span>{branch}</span>}
      {branch && academicYear && <span>•</span>}
      {academicYear && <span>{academicYear}</span>}
    </div>
  );
};

// Phase 7: Event Tag Badge (for ride cards)
const EventTagBadge = ({ tagName }) => {
  if (!tagName) return null;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
      <Tag className="w-3 h-3" />
      {tagName}
    </span>
  );
};

// Phase 7: Stats Page Component
const StatsPage = ({ setCurrentPage }) => {
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [statsData, weeklyData] = await Promise.all([
          api('/api/user/stats'),
          api('/api/user/weekly-summary')
        ]);
        setStats(statsData.stats);
        setBadges(statsData.badges);
        setWeeklySummary(weeklyData.weekly_summary);
      } catch (error) {
        toast.error('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Loading your stats...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black" data-testid="stats-page">
      <Navigation currentPage="profile" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Your Statistics</h1>
          <p className="text-gray-400">Track your ride-sharing journey</p>
        </div>
        
        {/* Platform Eco Impact */}
        <EcoImpactBanner />
        
        {/* User Stats */}
        <div className="mb-6">
          <UserStatsCard stats={stats} badges={badges} />
        </div>
        
        {/* Weekly Summary */}
        <div className="mb-6">
          <WeeklySummaryCard summary={weeklySummary} />
        </div>
        
        {/* All Badges */}
        <BadgesDisplay badges={badges} />
        
        <button
          onClick={() => setCurrentPage('profile')}
          className="w-full btn-uber-dark mt-6"
        >
          Back to Profile
        </button>
      </div>
    </div>
  );
};

// Phase 6: Ride History Page
const RideHistoryPage = ({ setCurrentPage }) => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState(null);
  const [selectedRide, setSelectedRide] = useState(null);
  
  const loadHistory = async () => {
    try {
      const data = await api('/api/ride-history');
      setHistory(data.history);
    } catch (error) {
      toast.error('Failed to load ride history');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadHistory();
  }, []);
  
  const handleRateClick = (ride) => {
    setRatingModal({
      rideRequestId: ride.ride_request_id,
      ratedUserName: ride.other_user_name,
      ratedRole: ride.other_user_role === 'driver' ? 'Driver' : 'Rider'
    });
  };
  
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };
  
  return (
    <div className="min-h-screen bg-black" data-testid="ride-history-page">
      <Navigation currentPage="history" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Ride History</h1>
          <p className="text-gray-400">
            Your completed rides • {history.length} {history.length === 1 ? 'ride' : 'rides'}
          </p>
        </div>
        
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
                <div className="skeleton h-6 w-48 mb-4 rounded" />
                <div className="skeleton h-4 w-32 rounded" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 bg-[#1A1A1A] rounded-xl border border-[#333]">
            <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No ride history yet</h3>
            <p className="text-gray-400 mb-6">
              {user?.role === 'driver' 
                ? 'Complete your first ride to see it here'
                : 'Take your first ride to see it here'}
            </p>
            <button
              onClick={() => setCurrentPage(user?.role === 'driver' ? 'post-ride' : 'browse')}
              className="btn-uber-green"
            >
              {user?.role === 'driver' ? 'Post a Ride' : 'Browse Rides'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((ride, index) => (
              <div 
                key={ride.ride_request_id}
                className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] card-hover animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
                data-testid={`history-ride-${ride.ride_request_id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#06C167]/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-[#06C167]" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">
                        {ride.role === 'driver' ? 'You drove' : 'You rode with'} {ride.other_user_name}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {formatDate(ride.date)} • {ride.time}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">₹{ride.cost}</p>
                    {ride.reached_safely_at && (
                      <span className="text-xs text-[#06C167] flex items-center gap-1 justify-end">
                        <Check className="w-3 h-3" /> Reached safely
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Route */}
                <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-[#06C167]" />
                      <div className="w-0.5 h-8 bg-[#333]" />
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm mb-3">{ride.source}</p>
                      <p className="text-white text-sm">{ride.destination}</p>
                    </div>
                  </div>
                </div>
                
                {/* Rating Section */}
                <div className="flex items-center justify-between pt-4 border-t border-[#333]">
                  <div className="flex items-center gap-4">
                    {/* Your Rating */}
                    {ride.my_rating ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm">Your rating:</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-white font-medium">{ride.my_rating}</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRateClick(ride)}
                        className="flex items-center gap-2 text-[#06C167] hover:text-[#05a857] transition"
                        data-testid={`rate-btn-${ride.ride_request_id}`}
                      >
                        <Star className="w-4 h-4" />
                        Rate {ride.other_user_role}
                      </button>
                    )}
                    
                    {/* Their Rating */}
                    {ride.their_rating && (
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <span>Received:</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-white">{ride.their_rating}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setSelectedRide(ride.ride_request_id)}
                    className="text-gray-400 hover:text-white flex items-center gap-1 text-sm transition"
                    data-testid={`view-details-${ride.ride_request_id}`}
                  >
                    View Details
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Rating Modal */}
      {ratingModal && (
        <RatingModal
          rideRequestId={ratingModal.rideRequestId}
          ratedUserName={ratingModal.ratedUserName}
          ratedRole={ratingModal.ratedRole}
          onClose={() => setRatingModal(null)}
          onSuccess={loadHistory}
        />
      )}
      
      {/* Ride Details Modal */}
      {selectedRide && (
        <RideSummaryModal
          rideRequestId={selectedRide}
          onClose={() => setSelectedRide(null)}
        />
      )}
    </div>
  );
};

// Phase 6: Ride Summary Modal
const RideSummaryModal = ({ rideRequestId, onClose }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await api(`/api/ride-history/${rideRequestId}`);
        setSummary(data.summary);
      } catch (error) {
        toast.error('Failed to load ride details');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, [rideRequestId, onClose]);
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-[#1A1A1A] rounded-xl p-8 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-[#333] rounded w-32" />
            <div className="h-4 bg-[#333] rounded w-48" />
            <div className="h-32 bg-[#333] rounded" />
          </div>
        </div>
      </div>
    );
  }
  
  if (!summary) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-[#1A1A1A] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#333] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="ride-summary-modal"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#333]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Ride Summary</h3>
              <p className="text-gray-500 text-sm">{summary.date} • {summary.time}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="status-badge status-completed">Completed</span>
            {summary.reached_safely_at && (
              <span className="text-[#06C167] text-sm flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Reached Safely
              </span>
            )}
          </div>
          
          {/* Route */}
          <div className="bg-[#0D0D0D] rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-[#06C167]" />
                <div className="w-0.5 h-12 bg-[#333]" />
                <div className="w-3 h-3 rounded-full bg-white" />
              </div>
              <div className="flex-1">
                <div className="mb-4">
                  <p className="text-gray-500 text-xs mb-1">PICKUP</p>
                  <p className="text-white">{summary.source}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">DROP-OFF</p>
                  <p className="text-white">{summary.destination}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Cost */}
          <div className="flex items-center justify-between p-4 bg-[#0D0D0D] rounded-lg">
            <span className="text-gray-400">Total Cost</span>
            <span className="text-2xl font-bold text-white">₹{summary.cost}</span>
          </div>
          
          {/* Participants */}
          <div className="grid grid-cols-2 gap-4">
            {/* Driver */}
            <div className="bg-[#0D0D0D] rounded-lg p-4">
              <p className="text-gray-500 text-xs mb-2">DRIVER</p>
              <p className="text-white font-medium flex items-center gap-2">
                {summary.driver?.name}
                {summary.driver?.verification_status === 'verified' && (
                  <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-black" />
                  </span>
                )}
              </p>
              {summary.driver?.vehicle_model && (
                <p className="text-gray-400 text-sm mt-1">{summary.driver.vehicle_model}</p>
              )}
              {summary.driver?.vehicle_number && (
                <p className="text-[#06C167] text-sm font-mono">{summary.driver.vehicle_number}</p>
              )}
            </div>
            
            {/* Rider */}
            <div className="bg-[#0D0D0D] rounded-lg p-4">
              <p className="text-gray-500 text-xs mb-2">RIDER</p>
              <p className="text-white font-medium flex items-center gap-2">
                {summary.rider?.name}
                {summary.rider?.verification_status === 'verified' && (
                  <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-black" />
                  </span>
                )}
              </p>
            </div>
          </div>
          
          {/* Ratings Given */}
          {(summary.rider_gave_rating || summary.driver_gave_rating) && (
            <div className="space-y-3">
              <h4 className="text-gray-400 text-sm">Ratings</h4>
              {summary.rider_gave_rating && (
                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg">
                  <span className="text-gray-400 text-sm">Rider rated driver</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-white font-medium">{summary.rider_gave_rating}</span>
                  </div>
                </div>
              )}
              {summary.driver_gave_rating && (
                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg">
                  <span className="text-gray-400 text-sm">Driver rated rider</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-white font-medium">{summary.driver_gave_rating}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Timestamps */}
          <div className="space-y-2 text-sm">
            <h4 className="text-gray-400">Timeline</h4>
            {summary.created_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Requested</span>
                <span className="text-gray-300">{new Date(summary.created_at).toLocaleString()}</span>
              </div>
            )}
            {summary.accepted_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Accepted</span>
                <span className="text-gray-300">{new Date(summary.accepted_at).toLocaleString()}</span>
              </div>
            )}
            {summary.ride_started_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Ride Started</span>
                <span className="text-gray-300">{new Date(summary.ride_started_at).toLocaleString()}</span>
              </div>
            )}
            {summary.reached_safely_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Reached Safely</span>
                <span className="text-[#06C167]">{new Date(summary.reached_safely_at).toLocaleString()}</span>
              </div>
            )}
            {summary.completed_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Completed</span>
                <span className="text-gray-300">{new Date(summary.completed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-[#333]">
          <button onClick={onClose} className="w-full btn-uber-dark">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Phase 6: Pending Ratings Banner
const PendingRatingsBanner = ({ onRateClick }) => {
  const [pendingRatings, setPendingRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadPending = async () => {
      try {
        const data = await api('/api/ratings/pending');
        setPendingRatings(data.pending_ratings.slice(0, 3)); // Show max 3
      } catch (error) {
        console.error('Failed to load pending ratings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPending();
  }, []);
  
  if (loading || pendingRatings.length === 0) return null;
  
  return (
    <div className="bg-[#06C167]/10 border border-[#06C167]/30 rounded-xl p-4 mb-6" data-testid="pending-ratings-banner">
      <div className="flex items-center gap-3 mb-3">
        <Star className="w-5 h-5 text-[#06C167]" />
        <h3 className="text-white font-semibold">Rate your recent rides</h3>
      </div>
      <div className="space-y-2">
        {pendingRatings.map((ride) => (
          <div 
            key={ride.ride_request_id}
            className="flex items-center justify-between bg-black/30 rounded-lg p-3"
          >
            <div>
              <p className="text-white text-sm">{ride.other_user_name}</p>
              <p className="text-gray-500 text-xs">{ride.source} → {ride.destination}</p>
            </div>
            <button
              onClick={() => onRateClick(ride)}
              className="text-[#06C167] text-sm hover:underline"
              data-testid={`rate-pending-${ride.ride_request_id}`}
            >
              Rate now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Admin SOS Monitoring Page - Phase 4
const AdminSOSPage = ({ setCurrentPage }) => {
  const [sosEvents, setSosEvents] = useState([]);
  const [counts, setCounts] = useState({ active: 0, reviewed: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedSOS, setSelectedSOS] = useState(null);

  const loadSOS = async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const data = await api(`/api/admin/sos${params}`);
      setSosEvents(data.sos_events);
      setCounts(data.counts);
    } catch (error) {
      toast.error('Failed to load SOS events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSOS();
    // Poll for updates every 15 seconds
    const interval = setInterval(loadSOS, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const handleAction = async (sosId, action, notes = '') => {
    setActionLoading(sosId);
    try {
      await api(`/api/admin/sos/${sosId}`, {
        method: 'PUT',
        body: JSON.stringify({ action, notes }),
      });
      toast.success(`SOS ${action === 'review' ? 'marked as reviewed' : 'resolved'}!`);
      loadSOS();
      setSelectedSOS(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'reviewed': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'resolved': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-sos-page">
      <Navigation currentPage="sos" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">SOS Monitoring</h1>
          <p className="text-gray-400">Monitor and respond to emergency alerts</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active', value: counts.active, color: 'bg-red-500', urgent: counts.active > 0 },
            { label: 'Reviewed', value: counts.reviewed, color: 'bg-yellow-500' },
            { label: 'Resolved', value: counts.resolved, color: 'bg-green-500' },
            { label: 'Total', value: counts.total, color: 'bg-white' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`bg-[#1A1A1A] rounded-xl p-4 border ${stat.urgent ? 'border-red-500 animate-pulse' : 'border-[#333]'}`}
            >
              <div className={`w-3 h-3 rounded-full ${stat.color} mb-2`} />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'active', 'reviewed', 'resolved'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition whitespace-nowrap ${
                filter === f
                  ? 'bg-white text-black'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-[#333]'
              }`}
              data-testid={`filter-${f}`}
            >
              {f === 'all' ? 'All SOS' : f}
              {f === 'active' && counts.active > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {counts.active}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* SOS List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
                <div className="skeleton h-6 w-32 mb-4 rounded" />
                <div className="skeleton h-4 w-48 rounded" />
              </div>
            ))}
          </div>
        ) : sosEvents.length === 0 ? (
          <div className="text-center py-16 bg-[#1A1A1A] rounded-xl border border-[#333]">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {filter === 'all' ? 'No SOS Events' : `No ${filter} SOS events`}
            </h3>
            <p className="text-gray-400">
              {filter === 'active' ? 'Great! No active emergencies right now.' : 'No events to display.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sosEvents.map((sos) => (
              <div
                key={sos.id}
                className={`bg-[#1A1A1A] rounded-xl p-6 border ${
                  sos.status === 'active' ? 'border-red-500/50 animate-pulse-subtle' : 'border-[#333]'
                }`}
                data-testid={`sos-event-${sos.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      sos.status === 'active' ? 'bg-red-500/20' : sos.status === 'reviewed' ? 'bg-yellow-500/20' : 'bg-green-500/20'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${
                        sos.status === 'active' ? 'text-red-500' : sos.status === 'reviewed' ? 'text-yellow-500' : 'text-green-500'
                      }`} />
                    </div>
                    <div>
                      <p className="text-white font-semibold">
                        SOS from {sos.triggered_by_name}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {new Date(sos.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(sos.status)}`}>
                    {sos.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-[#0D0D0D] rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-2">ROUTE</p>
                    <p className="text-white text-sm">{sos.ride_source}</p>
                    <p className="text-gray-400 text-xs my-1">to</p>
                    <p className="text-white text-sm">{sos.ride_destination}</p>
                  </div>
                  <div className="bg-[#0D0D0D] rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-2">PARTICIPANTS</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Driver:</span>
                        <span className="text-white text-sm">{sos.driver_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Rider:</span>
                        <span className="text-white text-sm">{sos.rider_name}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {sos.latitude && sos.longitude && (
                  <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4">
                    <p className="text-gray-500 text-xs mb-2">LOCATION</p>
                    <p className="text-white text-sm">
                      Lat: {sos.latitude.toFixed(6)}, Long: {sos.longitude.toFixed(6)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${sos.latitude},${sos.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#06C167] text-sm hover:underline inline-flex items-center gap-1 mt-2"
                    >
                      <MapPin className="w-4 h-4" /> View on Google Maps
                    </a>
                  </div>
                )}

                {sos.admin_notes && (
                  <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4">
                    <p className="text-gray-500 text-xs mb-2">ADMIN NOTES</p>
                    <p className="text-white text-sm">{sos.admin_notes}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {sos.status === 'active' && (
                    <button
                      onClick={() => setSelectedSOS({ ...sos, actionType: 'review' })}
                      disabled={actionLoading === sos.id}
                      className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium py-2 rounded-lg flex items-center justify-center gap-2 border border-yellow-500/50 transition"
                      data-testid={`review-sos-${sos.id}`}
                    >
                      <Eye className="w-4 h-4" />
                      Mark as Reviewed
                    </button>
                  )}
                  {(sos.status === 'active' || sos.status === 'reviewed') && (
                    <button
                      onClick={() => setSelectedSOS({ ...sos, actionType: 'resolve' })}
                      disabled={actionLoading === sos.id}
                      className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium py-2 rounded-lg flex items-center justify-center gap-2 border border-green-500/50 transition"
                      data-testid={`resolve-sos-${sos.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Resolve
                    </button>
                  )}
                  {sos.status === 'resolved' && (
                    <div className="flex-1 text-center text-green-400 py-2">
                      ✓ Resolved {sos.resolved_at && `at ${new Date(sos.resolved_at).toLocaleString()}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {selectedSOS && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSOS(null)}>
          <div 
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full border border-[#333] animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">
              {selectedSOS.actionType === 'review' ? 'Mark SOS as Reviewed' : 'Resolve SOS'}
            </h3>
            <p className="text-gray-400 mb-4">
              {selectedSOS.actionType === 'review' 
                ? 'Confirm that you have reviewed this SOS alert.'
                : 'Mark this SOS as resolved after taking appropriate action.'}
            </p>
            <textarea
              className="input-uber mb-4 h-24"
              placeholder="Add notes (optional)..."
              id="admin-notes"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedSOS(null)}
                className="flex-1 btn-uber-dark py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const notes = document.getElementById('admin-notes').value;
                  handleAction(selectedSOS.id, selectedSOS.actionType, notes);
                }}
                disabled={actionLoading === selectedSOS.id}
                className={`flex-1 py-2 rounded-lg font-medium ${
                  selectedSOS.actionType === 'review'
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                    : 'bg-green-500 hover:bg-green-600 text-black'
                } transition disabled:opacity-50`}
              >
                {actionLoading === selectedSOS.id ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Verification Required Banner
const VerificationBanner = ({ setCurrentPage }) => {
  const { user } = useAuth();
  
  if (user?.verification_status === 'verified' || user?.is_admin) return null;

  const messages = {
    unverified: "Verify your student ID to post or join rides",
    pending: "Your verification is pending review",
    rejected: "Your verification was rejected. Please resubmit."
  };

  const colors = {
    unverified: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    pending: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    rejected: "bg-red-500/10 border-red-500/30 text-red-400"
  };

  return (
    <div className={`${colors[user?.verification_status]} border rounded-xl p-4 mb-6 flex items-center justify-between`} data-testid="verification-banner">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">{messages[user?.verification_status]}</span>
      </div>
      {(user?.verification_status === 'unverified' || user?.verification_status === 'rejected') && (
        <button
          onClick={() => setCurrentPage('profile')}
          className="text-sm font-medium hover:underline flex items-center gap-1"
        >
          Verify Now <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Ride Card Component - Updated for Phase 5
const RideCard = ({ ride, onRequest, onViewDetails, showRequestButton = true, userRequests = [], onUrgentRequest }) => {
  const { user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const hasRequested = userRequests.some((r) => r.ride_id === ride.id);
  const requestStatus = userRequests.find((r) => r.ride_id === ride.id)?.status;
  const isVerified = user?.verification_status === 'verified';

  // Phase 5: Check if ride is eligible for urgent request (within 60 mins)
  const isUrgentEligible = () => {
    try {
      const rideDateTime = new Date(`${ride.date}T${ride.time}`);
      const now = new Date();
      const diffMins = (rideDateTime - now) / (1000 * 60);
      return diffMins > 0 && diffMins <= 60;
    } catch {
      return false;
    }
  };

  const handleUrgentRequest = () => {
    if (onUrgentRequest) {
      onUrgentRequest(ride.id);
    }
    setShowUrgentModal(false);
  };

  return (
    <>
      <div 
        className={`ride-card animate-fade-in ${ride.is_recommended ? 'border-[#06C167]/50 ring-1 ring-[#06C167]/30' : ''}`} 
        data-testid={`ride-card-${ride.id}`}
      >
        {/* Phase 5 & 7: Recommended/Recurring/Event badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {ride.is_recommended && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#06C167]/20 text-[#06C167]" data-testid="recommended-badge">
              <Star className="w-3 h-3" /> Recommended
            </span>
          )}
          {ride.is_recurring && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
              <Repeat className="w-3 h-3" /> Recurring
            </span>
          )}
          {ride.time_diff_minutes !== undefined && ride.time_diff_minutes <= 30 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
              <Clock className="w-3 h-3" /> {ride.time_diff_minutes === 0 ? 'Exact time' : `${ride.time_diff_minutes}min diff`}
            </span>
          )}
          {/* Phase 7: Event Tag Badge */}
          {ride.event_tag_name && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400" data-testid="event-tag-badge">
              <Tag className="w-3 h-3" /> {ride.event_tag_name}
            </span>
          )}
        </div>
        
        {/* Phase 7: Driver's Community Info */}
        {(ride.driver_branch_name || ride.driver_academic_year_name) && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
            <GraduationCap className="w-3 h-3" />
            {ride.driver_branch_name && <span>{ride.driver_branch_name}</span>}
            {ride.driver_branch_name && ride.driver_academic_year_name && <span>•</span>}
            {ride.driver_academic_year_name && <span>{ride.driver_academic_year_name}</span>}
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#06C167]" />
              <span className="text-gray-400 text-sm">From</span>
            </div>
            <h3 className="text-white font-semibold text-lg">{ride.source}</h3>
          </div>
          <span className={`status-badge status-${ride.status}`}>
            {ride.status}
          </span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-px h-8 bg-[#333] ml-1" />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-white" />
            <span className="text-gray-400 text-sm">To</span>
          </div>
          <h3 className="text-white font-semibold text-lg">{ride.destination}</h3>
        </div>

        {/* Phase 5: Pickup Point Display */}
        {ride.pickup_point_name && (
          <div className="mb-4 p-3 bg-[#0D0D0D] rounded-lg border border-[#333]">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-[#06C167]" />
              <span className="text-gray-400">Pickup:</span>
              <span className="text-white font-medium">{ride.pickup_point_name}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4 py-4 border-y border-[#333]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-300 text-sm">{ride.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-300 text-sm">{ride.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-gray-300 text-sm">{ride.seats_available} seats left</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span className="text-gray-300 text-sm">₹{ride.cost_per_rider}/person</span>
          </div>
        </div>

        {/* Phase 6: Driver Info with Rating & Trust */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 hover:bg-[#333] rounded-lg px-2 py-1 -ml-2 transition"
            data-testid={`view-driver-${ride.id}`}
          >
            <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center">
              <User className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 text-sm">{ride.driver_name}</span>
                <VerifiedBadge status={ride.driver_verification_status} size="xs" />
              </div>
              <div className="flex items-center gap-2">
                {/* Driver Rating */}
                {ride.driver_average_rating ? (
                  <span className="flex items-center gap-0.5 text-xs" data-testid="driver-rating-display">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-yellow-400">{ride.driver_average_rating.toFixed(1)}</span>
                    <span className="text-gray-500">({ride.driver_total_ratings})</span>
                  </span>
                ) : (
                  <span className="text-gray-500 text-xs">New driver</span>
                )}
                {/* Driver Trust Badge */}
                {ride.driver_trust_level && (
                  <TrustBadge trustLevel={ride.driver_trust_level} size="sm" />
                )}
              </div>
            </div>
          </button>

          {showRequestButton && (
            hasRequested ? (
              <span className={`status-badge status-${requestStatus}`}>
                {requestStatus === 'requested' ? 'Pending' : requestStatus}
              </span>
            ) : isVerified ? (
              <div className="flex items-center gap-2">
                {/* Phase 5: Urgent Request Option */}
                {isUrgentEligible() && (
                  <button
                    onClick={() => setShowUrgentModal(true)}
                    className="p-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition"
                    title="Urgent Request"
                    data-testid={`urgent-request-${ride.id}`}
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onRequest(ride.id)}
                  className="btn-uber-green py-2 px-4 text-sm flex items-center gap-2"
                  data-testid={`request-ride-${ride.id}`}
                >
                  Request <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span className="text-gray-500 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Verify to request
              </span>
            )
          )}
        </div>
      </div>

      {showProfile && (
        <ProfileModal userId={ride.driver_id} onClose={() => setShowProfile(false)} />
      )}

      {/* Phase 5: Urgent Request Confirmation Modal */}
      {showUrgentModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowUrgentModal(false)}>
          <div 
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-sm w-full border border-yellow-500/50 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            data-testid="urgent-modal"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Urgent Ride Request</h3>
              <p className="text-gray-400 text-sm">
                This will highlight your request to the driver for immediate attention. Use for time-sensitive commutes.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleUrgentRequest}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
                data-testid="confirm-urgent-btn"
              >
                <Zap className="w-5 h-5" />
                Send Urgent Request
              </button>
              <button
                onClick={() => {
                  setShowUrgentModal(false);
                  onRequest(ride.id);
                }}
                className="w-full btn-uber-dark py-3"
              >
                Send Regular Request
              </button>
              <button
                onClick={() => setShowUrgentModal(false)}
                className="w-full text-gray-400 hover:text-white py-2 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Driver Dashboard
const DriverDashboard = ({ setCurrentPage }) => {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, completed: 0, total: 0 });

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    try {
      const data = await api('/api/rides/driver/my-rides');
      setRides(data.rides);
      setStats({
        active: data.rides.filter((r) => r.status === 'active').length,
        completed: data.rides.filter((r) => r.status === 'completed').length,
        total: data.rides.length,
      });
    } catch (error) {
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  const completeRide = async (rideId) => {
    try {
      await api(`/api/rides/${rideId}/complete`, { method: 'PUT' });
      toast.success('Ride marked as completed');
      loadRides();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteRide = async (rideId) => {
    try {
      await api(`/api/rides/${rideId}`, { method: 'DELETE' });
      toast.success('Ride deleted');
      loadRides();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const isVerified = user?.verification_status === 'verified';

  return (
    <div className="min-h-screen bg-black" data-testid="driver-dashboard">
      <Navigation currentPage="dashboard" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-white">
              Welcome back, {user?.name}
            </h1>
            <VerifiedBadge status={user?.verification_status} size="md" />
          </div>
          <p className="text-gray-400">Manage your rides and requests</p>
        </div>

        <VerificationBanner setCurrentPage={setCurrentPage} />

        {/* Phase 7: Eco Impact Banner */}
        <EcoImpactBanner />

        {/* Phase 6: Pending Ratings Banner */}
        <PendingRatingsBanner 
          onRateClick={(ride) => {
            localStorage.setItem('pendingRateRide', JSON.stringify(ride));
            setCurrentPage('requests');
          }}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Active Rides', value: stats.active, color: 'bg-[#06C167]' },
            { label: 'Completed', value: stats.completed, color: 'bg-blue-500' },
            { label: 'Total Rides', value: stats.total, color: 'bg-white' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`bg-[#1A1A1A] rounded-xl p-6 border border-[#333] animate-slide-up stagger-${i + 1}`}
            >
              <div className={`w-3 h-3 rounded-full ${stat.color} mb-4`} />
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-8">
          {isVerified ? (
            <button
              onClick={() => setCurrentPage('post-ride')}
              className="btn-uber flex items-center gap-2"
              data-testid="post-ride-btn"
            >
              <Plus className="w-5 h-5" /> Post New Ride
            </button>
          ) : (
            <button
              onClick={() => setCurrentPage('profile')}
              className="btn-uber-dark flex items-center gap-2 opacity-80"
              data-testid="verify-to-post-btn"
            >
              <AlertCircle className="w-5 h-5" /> Verify to Post Rides
            </button>
          )}
          <button
            onClick={() => setCurrentPage('requests')}
            className="btn-uber-dark flex items-center gap-2"
            data-testid="view-requests-btn"
          >
            <Activity className="w-5 h-5" /> View Requests
          </button>
        </div>

        {/* Rides List */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Your Rides</h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="ride-card">
                  <div className="skeleton h-6 w-32 mb-4 rounded" />
                  <div className="skeleton h-4 w-48 mb-2 rounded" />
                  <div className="skeleton h-4 w-40 rounded" />
                </div>
              ))}
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No rides posted yet</p>
              {isVerified ? (
                <button
                  onClick={() => setCurrentPage('post-ride')}
                  className="btn-uber-green"
                >
                  Post Your First Ride
                </button>
              ) : (
                <button
                  onClick={() => setCurrentPage('profile')}
                  className="btn-uber-dark"
                >
                  Verify to Start Posting
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rides.map((ride) => (
                <div key={ride.id} className="ride-card" data-testid={`driver-ride-${ride.id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold">{ride.source}</h3>
                      <p className="text-gray-400 text-sm">to {ride.destination}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`status-badge status-${ride.status}`}>
                        {ride.status}
                      </span>
                      {/* Phase 5: Recurring Badge */}
                      {ride.is_recurring && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                          <Repeat className="w-3 h-3" /> Recurring
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-4 h-4" /> {ride.date}
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" /> {ride.time}
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Users className="w-4 h-4" /> {ride.seats_taken}/{ride.available_seats} booked
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <DollarSign className="w-4 h-4" /> ₹{ride.estimated_cost} total
                    </div>
                  </div>

                  {/* Phase 5: Pickup Point Display */}
                  {ride.pickup_point_name && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-[#06C167] bg-[#06C167]/10 px-3 py-2 rounded-lg">
                      <Building2 className="w-4 h-4" />
                      <span>Pickup: {ride.pickup_point_name}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {ride.status === 'active' && (
                      <>
                        <button
                          onClick={() => completeRide(ride.id)}
                          className="flex-1 btn-uber-green py-2 text-sm"
                          data-testid={`complete-ride-${ride.id}`}
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => deleteRide(ride.id)}
                          className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition"
                          data-testid={`delete-ride-${ride.id}`}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Rider Dashboard
const RiderDashboard = ({ setCurrentPage }) => {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ridesData, requestsData] = await Promise.all([
        api('/api/rides'),
        api('/api/ride-requests/my-requests'),
      ]);
      setRides(ridesData.rides.slice(0, 4));
      setRequests(requestsData.requests);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const requestRide = async (rideId) => {
    try {
      await api('/api/ride-requests', {
        method: 'POST',
        body: JSON.stringify({ ride_id: rideId }),
      });
      toast.success('Ride requested!');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const stats = {
    pending: requests.filter((r) => r.status === 'requested').length,
    accepted: requests.filter((r) => r.status === 'accepted').length,
    completed: requests.filter((r) => r.status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-black" data-testid="rider-dashboard">
      <Navigation currentPage="dashboard" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-white">
              Hey, {user?.name}! 👋
            </h1>
            <VerifiedBadge status={user?.verification_status} size="md" />
          </div>
          <p className="text-gray-400">Find your next ride</p>
        </div>

        <VerificationBanner setCurrentPage={setCurrentPage} />

        {/* Phase 7: Eco Impact Banner */}
        <EcoImpactBanner />

        {/* Phase 6: Pending Ratings Banner */}
        <PendingRatingsBanner 
          onRateClick={(ride) => {
            // Store ride info for rating modal
            localStorage.setItem('pendingRateRide', JSON.stringify(ride));
            setCurrentPage('my-requests');
          }}
        />

        {/* Quick Search */}
        <div
          className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] mb-8 cursor-pointer card-hover"
          onClick={() => setCurrentPage('browse')}
          data-testid="quick-search"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Where are you going?</p>
              <p className="text-gray-500 text-sm">Find available rides</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Pending', value: stats.pending, color: 'bg-yellow-500' },
            { label: 'Accepted', value: stats.accepted, color: 'bg-[#06C167]' },
            { label: 'Completed', value: stats.completed, color: 'bg-blue-500' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`bg-[#1A1A1A] rounded-xl p-4 border border-[#333] animate-slide-up stagger-${i + 1}`}
            >
              <div className={`w-2 h-2 rounded-full ${stat.color} mb-2`} />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Available Rides */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Available Rides</h2>
            <button
              onClick={() => setCurrentPage('browse')}
              className="text-[#06C167] hover:underline text-sm flex items-center gap-1"
            >
              See all <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="ride-card">
                  <div className="skeleton h-6 w-32 mb-4 rounded" />
                  <div className="skeleton h-4 w-48 mb-2 rounded" />
                </div>
              ))}
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-8 bg-[#1A1A1A] rounded-xl border border-[#333]">
              <Car className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No rides available right now</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  onRequest={requestRide}
                  userRequests={requests}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Post Ride Page - Updated for Phase 5
const PostRidePage = ({ setCurrentPage }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    source_lat: null,
    source_lng: null,
    destination_lat: null,
    destination_lng: null,
    date: '',
    time: '',
    available_seats: 3,
    estimated_cost: '',
    // Phase 5: New fields
    pickup_point: '',
    is_recurring: false,
    recurrence_pattern: '',
    recurrence_days_ahead: 7,
    // Phase 7: Event tag
    event_tag: '',
  });
  const [loading, setLoading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [recurrencePatterns, setRecurrencePatterns] = useState([]);
  const [eventTags, setEventTags] = useState([]);

  // Load pickup points, recurrence patterns, and event tags
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [ppData, rpData, etData] = await Promise.all([
          api('/api/pickup-points'),
          api('/api/recurrence-patterns'),
          api('/api/event-tags'),
        ]);
        setPickupPoints(ppData.pickup_points);
        setRecurrencePatterns(rpData.patterns);
        setEventTags(etData.event_tags);
      } catch (error) {
        console.error('Failed to load options:', error);
      }
    };
    loadOptions();
  }, []);

  // Redirect if not verified
  if (user?.verification_status !== 'verified') {
    return (
      <div className="min-h-screen bg-black" data-testid="post-ride-page">
        <Navigation currentPage="post-ride" setCurrentPage={setCurrentPage} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Verification Required</h2>
          <p className="text-gray-400 mb-6">You need to verify your student ID before posting rides.</p>
          <button
            onClick={() => setCurrentPage('profile')}
            className="btn-uber"
          >
            Complete Verification
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate coordinates are selected
    if (!formData.source_lat || !formData.destination_lat) {
      toast.error('Please select locations from the map for accurate route display');
      return;
    }

    // Phase 5: Validate recurring ride requirements
    if (formData.is_recurring && !formData.recurrence_pattern) {
      toast.error('Please select a recurrence pattern for recurring rides');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api('/api/rides', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          available_seats: parseInt(formData.available_seats),
          estimated_cost: parseFloat(formData.estimated_cost),
          pickup_point: formData.pickup_point || null,
          recurrence_days_ahead: formData.is_recurring ? parseInt(formData.recurrence_days_ahead) : null,
          event_tag: formData.event_tag || null,
        }),
      });
      
      // Phase 5: Show message about recurring rides created
      if (response.recurring_rides_created > 0) {
        toast.success(`Ride posted! + ${response.recurring_rides_created} recurring instances created`);
      } else {
        toast.success('Ride posted successfully!');
      }
      setCurrentPage('dashboard');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSourceSelect = (location) => {
    setFormData({
      ...formData,
      source: location.address,
      source_lat: location.lat,
      source_lng: location.lng
    });
  };
  
  const handleDestSelect = (location) => {
    setFormData({
      ...formData,
      destination: location.address,
      destination_lat: location.lat,
      destination_lng: location.lng
    });
  };

  return (
    <div className="min-h-screen bg-black" data-testid="post-ride-page">
      <Navigation currentPage="post-ride" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Post a Ride</h1>
          <p className="text-gray-400">Share your journey and split costs</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#06C167]" /> Route
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Pickup Location</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="input-uber flex-1"
                    placeholder="Select from map..."
                    readOnly
                    required
                    data-testid="ride-source"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSourcePicker(true)}
                    className="btn-uber-green px-4 flex items-center gap-2"
                    data-testid="select-source-btn"
                  >
                    <MapPinned className="w-4 h-4" />
                    Select
                  </button>
                </div>
                {formData.source_lat && (
                  <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Location selected
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Drop Location</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="input-uber flex-1"
                    placeholder="Select from map..."
                    readOnly
                    required
                    data-testid="ride-destination"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDestPicker(true)}
                    className="btn-uber-green px-4 flex items-center gap-2"
                    data-testid="select-dest-btn"
                  >
                    <MapPinned className="w-4 h-4" />
                    Select
                  </button>
                </div>
                {formData.destination_lat && (
                  <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Location selected
                  </p>
                )}
              </div>
            </div>
            
            {/* Route Preview */}
            {formData.source_lat && formData.destination_lat && (
              <div className="mt-4">
                <p className="text-gray-400 text-sm mb-2">Route Preview:</p>
                <RouteMap 
                  sourceLat={formData.source_lat}
                  sourceLng={formData.source_lng}
                  destLat={formData.destination_lat}
                  destLng={formData.destination_lng}
                  sourceLabel={formData.source}
                  destLabel={formData.destination}
                />
              </div>
            )}
          </div>

          {/* Phase 5: Pickup Point Selection */}
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#06C167]" /> Campus Pickup Point
            </h3>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Select RVCE Pickup Point (Optional)</label>
              <select
                value={formData.pickup_point}
                onChange={(e) => setFormData({ ...formData, pickup_point: e.target.value })}
                className="input-uber"
                data-testid="pickup-point-select"
              >
                <option value="">-- No specific pickup point --</option>
                {pickupPoints.map((pp) => (
                  <option key={pp.id} value={pp.id}>
                    {pp.name} - {pp.description}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Selecting a campus pickup point helps riders find your ride easily
              </p>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#06C167]" /> Schedule
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input-uber"
                  required
                  data-testid="ride-date"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="input-uber"
                  required
                  data-testid="ride-time"
                />
              </div>
            </div>
          </div>

          {/* Phase 7: Event Tag Selection */}
          {eventTags.length > 0 && (
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#06C167]" /> Event Tag (Optional)
              </h3>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Link this ride to a college event</label>
                <select
                  value={formData.event_tag}
                  onChange={(e) => setFormData({ ...formData, event_tag: e.target.value })}
                  className="input-uber"
                  data-testid="event-tag-select"
                >
                  <option value="">-- No event tag --</option>
                  {eventTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name} {tag.description ? `- ${tag.description}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Tagging your ride helps students find rides for the same event
                </p>
              </div>
            </div>
          )}

          {/* Phase 5: Recurring Ride Options */}
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Repeat className="w-5 h-5 text-[#06C167]" /> Recurring Ride
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Make this a recurring ride</p>
                  <p className="text-gray-500 text-sm">Automatically create rides for multiple days</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_recurring: !formData.is_recurring })}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    formData.is_recurring ? 'bg-[#06C167]' : 'bg-[#333]'
                  }`}
                  data-testid="recurring-toggle"
                >
                  <div 
                    className={`w-6 h-6 bg-white rounded-full transition-transform ${
                      formData.is_recurring ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {formData.is_recurring && (
                <div className="space-y-4 pt-4 border-t border-[#333] animate-fade-in">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Recurrence Pattern</label>
                    <select
                      value={formData.recurrence_pattern}
                      onChange={(e) => setFormData({ ...formData, recurrence_pattern: e.target.value })}
                      className="input-uber"
                      required={formData.is_recurring}
                      data-testid="recurrence-pattern-select"
                    >
                      <option value="">-- Select pattern --</option>
                      {recurrencePatterns.map((pattern) => (
                        <option key={pattern.id} value={pattern.id}>
                          {pattern.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Generate rides for next (days)</label>
                    <select
                      value={formData.recurrence_days_ahead}
                      onChange={(e) => setFormData({ ...formData, recurrence_days_ahead: e.target.value })}
                      className="input-uber"
                      data-testid="recurrence-days-select"
                    >
                      {[7, 14, 21, 30].map((days) => (
                        <option key={days} value={days}>
                          {days} days
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      Rides will be created only for days matching the pattern
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#06C167]" /> Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Available Seats</label>
                <select
                  value={formData.available_seats}
                  onChange={(e) => setFormData({ ...formData, available_seats: e.target.value })}
                  className="input-uber"
                  data-testid="ride-seats"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? 'seat' : 'seats'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Total Cost (₹)</label>
                <input
                  type="number"
                  value={formData.estimated_cost}
                  onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                  className="input-uber"
                  placeholder="500"
                  min="0"
                  required
                  data-testid="ride-cost"
                />
              </div>
            </div>
            {formData.estimated_cost && formData.available_seats && (
              <div className="mt-4 p-4 bg-[#06C167]/10 rounded-lg border border-[#06C167]/30">
                <p className="text-[#06C167] text-sm">
                  Cost per rider: ₹{Math.round(parseFloat(formData.estimated_cost) / parseInt(formData.available_seats))}
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !formData.source_lat || !formData.destination_lat}
            className="w-full btn-uber text-lg py-4 disabled:opacity-50"
            data-testid="submit-ride"
          >
            {loading ? 'Posting...' : formData.is_recurring ? 'Post Recurring Ride' : 'Post Ride'}
          </button>
        </form>
      </div>
      
      {/* Map Picker Modals */}
      <MapLocationPicker
        isOpen={showSourcePicker}
        onClose={() => setShowSourcePicker(false)}
        onSelect={handleSourceSelect}
        title="Select Pickup Location"
        initialPosition={formData.source_lat ? { lat: formData.source_lat, lng: formData.source_lng } : null}
      />
      
      <MapLocationPicker
        isOpen={showDestPicker}
        onClose={() => setShowDestPicker(false)}
        onSelect={handleDestSelect}
        title="Select Drop Location"
        initialPosition={formData.destination_lat ? { lat: formData.destination_lat, lng: formData.destination_lng } : null}
      />
    </div>
  );
};

// Browse Rides Page - Updated for Phase 5 with Smart Matching
const BrowseRidesPage = ({ setCurrentPage }) => {
  const [rides, setRides] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendedCount, setRecommendedCount] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [eventTags, setEventTags] = useState([]);
  const [branches, setBranches] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [filters, setFilters] = useState({ 
    destination: '', 
    source: '',
    date: '',
    // Phase 5: Smart matching filters
    preferred_time: '',
    time_window: '',
    pickup_point: '',
    // Phase 7: Community filters
    event_tag: '',
    branch: '',
    academic_year: ''
  });

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [ppData, etData, branchData, yearData] = await Promise.all([
          api('/api/pickup-points'),
          api('/api/event-tags'),
          api('/api/branches'),
          api('/api/academic-years')
        ]);
        setPickupPoints(ppData.pickup_points);
        setEventTags(etData.event_tags);
        setBranches(branchData.branches);
        setAcademicYears(yearData.academic_years);
      } catch (error) {
        console.error('Failed to load filter options:', error);
      }
    };
    loadFilterOptions();
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.destination) params.append('destination', filters.destination);
      if (filters.source) params.append('source', filters.source);
      if (filters.date) params.append('date', filters.date);
      // Phase 5: Smart matching params
      if (filters.preferred_time) params.append('preferred_time', filters.preferred_time);
      if (filters.time_window) params.append('time_window', filters.time_window);
      if (filters.pickup_point) params.append('pickup_point', filters.pickup_point);
      // Phase 7: Community filters
      if (filters.event_tag) params.append('event_tag', filters.event_tag);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.academic_year) params.append('academic_year', filters.academic_year);
      
      const [ridesData, requestsData] = await Promise.all([
        api(`/api/rides?${params.toString()}`),
        api('/api/ride-requests/my-requests'),
      ]);
      setRides(ridesData.rides);
      setRequests(requestsData.requests);
      setRecommendedCount(ridesData.recommended_count || 0);
    } catch (error) {
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  const requestRide = async (rideId, isUrgent = false) => {
    try {
      await api('/api/ride-requests', {
        method: 'POST',
        body: JSON.stringify({ ride_id: rideId, is_urgent: isUrgent }),
      });
      toast.success(isUrgent ? '⚡ Urgent ride requested!' : 'Ride requested successfully!');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadData();
  };

  const clearFilters = () => {
    setFilters({
      destination: '',
      source: '',
      date: '',
      preferred_time: '',
      time_window: '',
      pickup_point: '',
      event_tag: '',
      branch: '',
      academic_year: ''
    });
  };

  const hasActiveFilters = filters.source || filters.destination || filters.date || 
                           filters.preferred_time || filters.time_window || filters.pickup_point ||
                           filters.event_tag || filters.branch || filters.academic_year;

  return (
    <div className="min-h-screen bg-black" data-testid="browse-rides-page">
      <Navigation currentPage="browse" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Browse Rides</h1>
          <p className="text-gray-400">Find available rides to your destination</p>
        </div>

        <VerificationBanner setCurrentPage={setCurrentPage} />

        {/* Search Filters - Updated for Phase 5 */}
        <form onSubmit={handleSearch} className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333] mb-8 animate-fade-in">
          {/* Basic Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">From (Source)</label>
              <input
                type="text"
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                className="input-uber"
                placeholder="Search source..."
                data-testid="search-source"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">To (Destination)</label>
              <input
                type="text"
                value={filters.destination}
                onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
                className="input-uber"
                placeholder="Search destination..."
                data-testid="search-destination"
              />
            </div>
            <div className="md:w-44">
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="input-uber"
                data-testid="search-date"
              />
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-2 transition"
              data-testid="advanced-filters-toggle"
            >
              <Filter className="w-4 h-4" />
              {showAdvancedFilters ? 'Hide' : 'Show'} Smart Filters
              <ChevronRight className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-90' : ''}`} />
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-red-400 transition"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Phase 5: Advanced Smart Matching Filters */}
          {showAdvancedFilters && (
            <div className="space-y-4 pt-4 border-t border-[#333] animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Preferred Time</label>
                  <input
                    type="time"
                    value={filters.preferred_time}
                    onChange={(e) => setFilters({ ...filters, preferred_time: e.target.value })}
                    className="input-uber"
                    data-testid="search-preferred-time"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Time Window</label>
                  <select
                    value={filters.time_window}
                    onChange={(e) => setFilters({ ...filters, time_window: e.target.value })}
                    className="input-uber"
                    data-testid="search-time-window"
                  >
                    <option value="">Any time</option>
                    <option value="15">± 15 minutes</option>
                    <option value="30">± 30 minutes</option>
                    <option value="60">± 60 minutes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Campus Pickup Point</label>
                  <select
                    value={filters.pickup_point}
                    onChange={(e) => setFilters({ ...filters, pickup_point: e.target.value })}
                    className="input-uber"
                    data-testid="search-pickup-point"
                  >
                    <option value="">Any pickup point</option>
                    {pickupPoints.map((pp) => (
                      <option key={pp.id} value={pp.id}>{pp.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Phase 7: Community & Event Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Event
                  </label>
                  <select
                    value={filters.event_tag}
                    onChange={(e) => setFilters({ ...filters, event_tag: e.target.value })}
                    className="input-uber"
                    data-testid="search-event-tag"
                  >
                    <option value="">All events</option>
                    {eventTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>{tag.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Branch
                  </label>
                  <select
                    value={filters.branch}
                    onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                    className="input-uber"
                    data-testid="search-branch"
                  >
                    <option value="">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Year
                  </label>
                  <select
                    value={filters.academic_year}
                    onChange={(e) => setFilters({ ...filters, academic_year: e.target.value })}
                    className="input-uber"
                    data-testid="search-academic-year"
                  >
                    <option value="">All years</option>
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button type="submit" className="btn-uber flex-1 flex items-center justify-center gap-2" data-testid="search-btn">
              <Search className="w-5 h-5" /> Search Rides
            </button>
          </div>
        </form>

        {/* Phase 5: Recommended Rides Indicator */}
        {recommendedCount > 0 && !loading && (
          <div className="mb-6 p-4 bg-[#06C167]/10 border border-[#06C167]/30 rounded-xl flex items-center gap-3 animate-fade-in">
            <Star className="w-5 h-5 text-[#06C167]" />
            <p className="text-[#06C167]">
              Found <span className="font-bold">{recommendedCount}</span> recommended {recommendedCount === 1 ? 'ride' : 'rides'} matching your search!
            </p>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ride-card">
                <div className="skeleton h-6 w-32 mb-4 rounded" />
                <div className="skeleton h-4 w-48 mb-2 rounded" />
                <div className="skeleton h-4 w-40 rounded" />
              </div>
            ))}
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No rides found</h3>
            <p className="text-gray-400">Try adjusting your search filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                onRequest={(rideId) => requestRide(rideId, false)}
                onUrgentRequest={(rideId) => requestRide(rideId, true)}
                userRequests={requests}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// My Requests Page (Rider) - Updated for Phase 3
const MyRequestsPage = ({ setCurrentPage }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await api('/api/ride-requests/my-requests');
      setRequests(data.requests);
    } catch (error) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  // Group requests by status for better organization
  const activeRequests = requests.filter(r => ['accepted', 'ongoing'].includes(r.status));
  const pendingRequests = requests.filter(r => r.status === 'requested');
  const pastRequests = requests.filter(r => ['completed', 'rejected'].includes(r.status));

  return (
    <div className="min-h-screen bg-black" data-testid="my-requests-page">
      <Navigation currentPage="my-requests" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">My Ride Requests</h1>
          <p className="text-gray-400">Track your ride requests and communicate with drivers</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="ride-card">
                <div className="skeleton h-6 w-32 mb-4 rounded" />
                <div className="skeleton h-4 w-48 rounded" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No requests yet</h3>
            <p className="text-gray-400 mb-4">Start by browsing available rides</p>
            <button
              onClick={() => setCurrentPage('browse')}
              className="btn-uber-green"
            >
              Browse Rides
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Rides (Accepted/Ongoing) */}
            {activeRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-[#06C167]" />
                  Active Rides
                </h2>
                <div className="space-y-4">
                  {activeRequests.map((request) => (
                    <div key={request.id} className="ride-card animate-fade-in border-[#06C167]/50" data-testid={`request-${request.id}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-white font-semibold">{request.ride_source}</h3>
                          <p className="text-gray-400 text-sm">to {request.ride_destination}</p>
                        </div>
                        <span className={`status-badge status-${request.status}`}>
                          {request.status}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> {request.ride_date}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" /> {request.ride_time}
                        </div>
                        {/* Phase 5: Pickup Point Display */}
                        {request.pickup_point_name && (
                          <div className="flex items-center gap-2 text-[#06C167]">
                            <Building2 className="w-4 h-4" /> {request.pickup_point_name}
                          </div>
                        )}
                      </div>

                      {/* PIN Display for Accepted Rides */}
                      {request.status === 'accepted' && request.ride_pin && (
                        <div className="mb-4 p-4 bg-[#0D0D0D] rounded-lg border border-[#333]">
                          <div className="flex items-center gap-2 mb-2">
                            <Key className="w-4 h-4 text-[#06C167]" />
                            <p className="text-gray-400 text-sm">Your Ride PIN (share with driver)</p>
                          </div>
                          <div className="pin-display" data-testid={`ride-pin-${request.id}`}>
                            {request.ride_pin}
                          </div>
                          <p className="text-gray-500 text-xs mt-2 text-center">
                            Give this PIN to your driver to start the ride
                          </p>
                        </div>
                      )}

                      {/* Ride Started Info - Show View Live Ride Button */}
                      {request.status === 'ongoing' && (
                        <div className="mb-4">
                          {request.ride_started_at && (
                            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-4">
                              <p className="text-purple-400 text-sm flex items-center gap-2">
                                <Play className="w-4 h-4" />
                                Ride started at {new Date(request.ride_started_at).toLocaleTimeString()}
                              </p>
                            </div>
                          )}
                          <button
                            onClick={() => setCurrentPage(`live-ride:${request.id}`)}
                            className="w-full bg-[#06C167] hover:bg-[#05a857] text-black font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
                            data-testid={`view-live-ride-${request.id}`}
                          >
                            <NavigationIcon className="w-5 h-5" />
                            View Live Ride
                          </button>
                        </div>
                      )}

                      {/* Chat Button */}
                      <button
                        onClick={() => setShowChat(request)}
                        className="w-full btn-uber-dark py-3 flex items-center justify-center gap-2"
                        data-testid={`chat-btn-${request.id}`}
                      >
                        <MessageCircle className="w-5 h-5" />
                        Chat with Driver
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  Pending Requests
                </h2>
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div 
                      key={request.id} 
                      className={`ride-card animate-fade-in ${request.is_urgent ? 'border-yellow-500/50 ring-1 ring-yellow-500/30' : ''}`} 
                      data-testid={`request-${request.id}`}
                    >
                      {/* Phase 5: Urgent Request Badge */}
                      {request.is_urgent && (
                        <div className="flex items-center gap-2 mb-3 -mt-1">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50" data-testid="urgent-badge-rider">
                            <Zap className="w-3 h-3" /> URGENT REQUEST
                          </span>
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-white font-semibold">{request.ride_source}</h3>
                          <p className="text-gray-400 text-sm">to {request.ride_destination}</p>
                        </div>
                        <span className="status-badge status-requested">
                          {request.is_urgent ? 'Urgent' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> {request.ride_date}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" /> {request.ride_time}
                        </div>
                        {/* Phase 5: Pickup Point Display */}
                        {request.pickup_point_name && (
                          <div className="flex items-center gap-2 text-[#06C167]">
                            <Building2 className="w-4 h-4" /> {request.pickup_point_name}
                          </div>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm mt-3">
                        {request.is_urgent ? '⚡ Priority request - awaiting driver response...' : 'Waiting for driver approval...'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Rides */}
            {pastRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-gray-500" />
                  Past Rides
                </h2>
                <div className="space-y-4">
                  {pastRequests.map((request) => (
                    <div key={request.id} className="ride-card animate-fade-in opacity-75" data-testid={`request-${request.id}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-white font-semibold">{request.ride_source}</h3>
                          <p className="text-gray-400 text-sm">to {request.ride_destination}</p>
                        </div>
                        <span className={`status-badge status-${request.status}`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> {request.ride_date}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" /> {request.ride_time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Modal */}
        {showChat && (
          <ChatModal
            requestId={showChat.id}
            otherUserName="Driver"
            onClose={() => setShowChat(null)}
          />
        )}
      </div>
    </div>
  );
};

// Driver Requests Page - Updated for Phase 3
const DriverRequestsPage = ({ setCurrentPage }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(null);
  const [showChat, setShowChat] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [pinInput, setPinInput] = useState({});
  const [startingRide, setStartingRide] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const [pendingData, acceptedData] = await Promise.all([
        api('/api/ride-requests/driver/pending'),
        api('/api/ride-requests/driver/accepted'),
      ]);
      setPendingRequests(pendingData.requests);
      setAcceptedRequests(acceptedData.requests);
    } catch (error) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId, action) => {
    try {
      await api(`/api/ride-requests/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });
      toast.success(`Request ${action}ed`);
      loadRequests();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleStartRide = async (requestId) => {
    const pin = pinInput[requestId];
    if (!pin || pin.length !== 4) {
      toast.error('Please enter a valid 4-digit PIN');
      return;
    }

    setStartingRide(requestId);
    try {
      await api(`/api/ride-requests/${requestId}/start`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      toast.success('Ride started successfully!');
      setPinInput({ ...pinInput, [requestId]: '' });
      loadRequests();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setStartingRide(null);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="driver-requests-page">
      <Navigation currentPage="requests" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Ride Requests</h1>
          <p className="text-gray-400">Manage incoming requests and active rides</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 rounded-xl font-medium transition flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-white text-black'
                : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
            }`}
            data-testid="tab-pending"
          >
            <Clock className="w-4 h-4" />
            Pending
            {pendingRequests.length > 0 && (
              <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('accepted')}
            className={`px-6 py-3 rounded-xl font-medium transition flex items-center gap-2 ${
              activeTab === 'accepted'
                ? 'bg-white text-black'
                : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
            }`}
            data-testid="tab-accepted"
          >
            <CheckCircle className="w-4 h-4" />
            Active Rides
            {acceptedRequests.length > 0 && (
              <span className="bg-[#06C167] text-black text-xs px-2 py-0.5 rounded-full">
                {acceptedRequests.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="ride-card">
                <div className="skeleton h-6 w-32 mb-4 rounded" />
                <div className="skeleton h-4 w-48 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Pending Requests Tab */}
            {activeTab === 'pending' && (
              pendingRequests.length === 0 ? (
                <div className="text-center py-16">
                  <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No pending requests</h3>
                  <p className="text-gray-400">Check back later for new ride requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div 
                      key={request.id} 
                      className={`ride-card animate-fade-in ${request.is_urgent ? 'border-yellow-500/50 ring-1 ring-yellow-500/30' : ''}`} 
                      data-testid={`pending-request-${request.id}`}
                    >
                      {/* Phase 5: Urgent Request Badge */}
                      {request.is_urgent && (
                        <div className="flex items-center gap-2 mb-3 -mt-1">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 animate-pulse" data-testid="urgent-badge">
                            <Zap className="w-3 h-3" /> URGENT REQUEST
                          </span>
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <button 
                            onClick={() => setShowProfile(request.rider_id)}
                            className="flex items-center gap-2 hover:underline"
                          >
                            <h3 className="text-white font-semibold">{request.rider_name}</h3>
                            <VerifiedBadge status={request.rider_verification_status} size="xs" />
                          </button>
                          <p className="text-gray-400 text-sm">{request.rider_email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <VerificationStatusBadge status={request.rider_verification_status} />
                          <span className="status-badge status-requested">Pending</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
                        <span>{request.ride_source} → {request.ride_destination}</span>
                        <span>{request.ride_date} at {request.ride_time}</span>
                        {/* Phase 5: Pickup Point Display */}
                        {request.pickup_point_name && (
                          <span className="inline-flex items-center gap-1 text-[#06C167]">
                            <Building2 className="w-3 h-3" /> {request.pickup_point_name}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRequest(request.id, 'accept')}
                          className={`flex-1 py-2 flex items-center justify-center gap-2 ${
                            request.is_urgent 
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-black font-bold' 
                              : 'btn-uber-green'
                          }`}
                          data-testid={`accept-request-${request.id}`}
                        >
                          <CheckCircle className="w-4 h-4" /> {request.is_urgent ? 'Accept Urgent' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleRequest(request.id, 'reject')}
                          className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center gap-2 hover:bg-red-500/30 transition"
                          data-testid={`reject-request-${request.id}`}
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Accepted/Active Rides Tab */}
            {activeTab === 'accepted' && (
              acceptedRequests.length === 0 ? (
                <div className="text-center py-16">
                  <Car className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No active rides</h3>
                  <p className="text-gray-400">Accept ride requests to see them here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {acceptedRequests.map((request) => (
                    <div 
                      key={request.id} 
                      className={`ride-card animate-fade-in ${request.status === 'ongoing' ? 'border-purple-500/50' : 'border-[#06C167]/50'}`}
                      data-testid={`accepted-request-${request.id}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <button 
                            onClick={() => setShowProfile(request.rider_id)}
                            className="flex items-center gap-2 hover:underline"
                          >
                            <h3 className="text-white font-semibold">{request.rider_name}</h3>
                            <VerifiedBadge status={request.rider_verification_status} size="xs" />
                          </button>
                          <p className="text-gray-400 text-sm">{request.rider_email}</p>
                        </div>
                        <span className={`status-badge status-${request.status}`}>
                          {request.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                        <span>{request.ride_source} → {request.ride_destination}</span>
                        <span>{request.ride_date} at {request.ride_time}</span>
                      </div>

                      {/* PIN Verification Section - Only for Accepted (not started) rides */}
                      {request.status === 'accepted' && (
                        <div className="mb-4 p-4 bg-[#0D0D0D] rounded-lg border border-[#333]">
                          <div className="flex items-center gap-2 mb-3">
                            <Key className="w-4 h-4 text-[#06C167]" />
                            <p className="text-white font-medium">Verify Rider PIN to Start</p>
                          </div>
                          <p className="text-gray-500 text-sm mb-3">
                            Ask the rider for their 4-digit PIN to confirm their identity
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={pinInput[request.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setPinInput({ ...pinInput, [request.id]: val });
                              }}
                              className="input-uber pin-input flex-1"
                              placeholder="Enter PIN"
                              maxLength={4}
                              data-testid={`pin-input-${request.id}`}
                            />
                            <button
                              onClick={() => handleStartRide(request.id)}
                              disabled={startingRide === request.id || (pinInput[request.id]?.length !== 4)}
                              className="btn-uber-green px-6 flex items-center gap-2 disabled:opacity-50"
                              data-testid={`start-ride-btn-${request.id}`}
                            >
                              {startingRide === request.id ? (
                                'Starting...'
                              ) : (
                                <>
                                  <Play className="w-4 h-4" /> Start Ride
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Ride Started Info with View Live Ride button for drivers */}
                      {request.status === 'ongoing' && (
                        <div className="mb-4">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-3">
                            <p className="text-purple-400 text-sm flex items-center gap-2">
                              <Play className="w-4 h-4" />
                              Ride in progress
                              {request.ride_started_at && (
                                <span className="text-purple-300">
                                  • Started at {new Date(request.ride_started_at).toLocaleTimeString()}
                                </span>
                              )}
                            </p>
                          </div>
                          {/* View Live Ride Button for Driver */}
                          <button
                            onClick={() => setCurrentPage(`live-ride:${request.id}`)}
                            className="w-full bg-[#06C167] hover:bg-[#05a857] text-black font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
                            data-testid={`driver-view-live-ride-${request.id}`}
                          >
                            <NavigationIcon className="w-5 h-5" />
                            View Live Ride
                          </button>
                        </div>
                      )}

                      {/* Chat Button */}
                      <button
                        onClick={() => setShowChat(request)}
                        className="w-full btn-uber-dark py-3 flex items-center justify-center gap-2"
                        data-testid={`chat-btn-${request.id}`}
                      >
                        <MessageCircle className="w-5 h-5" />
                        Chat with Rider
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {showProfile && (
          <ProfileModal userId={showProfile} onClose={() => setShowProfile(null)} />
        )}

        {showChat && (
          <ChatModal
            requestId={showChat.id}
            otherUserName={showChat.rider_name}
            onClose={() => setShowChat(null)}
          />
        )}
      </div>
    </div>
  );
};

// Verification Section Component (for Profile Page)
const VerificationSection = () => {
  const { user, refreshUser } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadVerificationStatus();
  }, []);

  const loadVerificationStatus = async () => {
    try {
      const data = await api('/api/verification/status');
      setVerificationStatus(data);
    } catch (error) {
      console.error('Failed to load verification status');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result;
        await api('/api/verification/upload', {
          method: 'POST',
          body: JSON.stringify({ student_id_image: base64Image }),
        });
        toast.success('Student ID uploaded successfully!');
        setSelectedImage(null);
        setPreviewUrl(null);
        loadVerificationStatus();
        refreshUser();
      };
      reader.readAsDataURL(selectedImage);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const canUpload = user?.verification_status === 'unverified' || user?.verification_status === 'rejected';

  return (
    <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] mb-6" data-testid="verification-section">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-[#06C167]" />
        Identity Verification
      </h3>

      {/* Current Status */}
      <div className="flex items-center justify-between mb-4 p-4 bg-[#0D0D0D] rounded-lg">
        <div>
          <p className="text-gray-400 text-sm mb-1">Verification Status</p>
          <VerificationStatusBadge status={user?.verification_status} />
        </div>
        {user?.verification_status === 'verified' && (
          <div className="flex items-center gap-2 text-green-400">
            <BadgeCheck className="w-6 h-6" />
            <span className="text-sm">Verified</span>
          </div>
        )}
      </div>

      {/* Rejection Reason */}
      {user?.verification_status === 'rejected' && verificationStatus?.rejection_reason && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-medium mb-1">Rejection Reason:</p>
          <p className="text-gray-300 text-sm">{verificationStatus.rejection_reason}</p>
        </div>
      )}

      {/* Upload Section */}
      {canUpload && (
        <div className="border-2 border-dashed border-[#333] rounded-lg p-6">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            ref={fileInputRef}
            data-testid="id-upload-input"
          />
          
          {previewUrl ? (
            <div className="text-center">
              <img 
                src={previewUrl} 
                alt="ID Preview" 
                className="max-h-48 mx-auto rounded-lg mb-4"
              />
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="btn-uber-green py-2 px-6"
                  data-testid="upload-id-btn"
                >
                  {uploading ? 'Uploading...' : 'Submit for Verification'}
                </button>
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setPreviewUrl(null);
                  }}
                  className="btn-uber-dark py-2 px-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div 
              className="text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">Upload Student ID</p>
              <p className="text-gray-500 text-sm mb-4">Click to select your college ID card (front side)</p>
              <button className="btn-uber-dark py-2 px-4" data-testid="select-id-btn">
                Select Image
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Status */}
      {user?.verification_status === 'pending' && (
        <div className="text-center py-6">
          <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-3 animate-pulse" />
          <p className="text-white font-medium mb-1">Verification Pending</p>
          <p className="text-gray-400 text-sm">Your student ID is being reviewed by admin</p>
        </div>
      )}

      {/* Verified Status */}
      {user?.verification_status === 'verified' && (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-3">
            <Check className="w-8 h-8 text-black" />
          </div>
          <p className="text-white font-medium mb-1">You're Verified!</p>
          <p className="text-gray-400 text-sm">You have full access to all CampusPool features</p>
        </div>
      )}

      {/* Instructions */}
      {canUpload && (
        <div className="mt-4 p-4 bg-[#0D0D0D] rounded-lg">
          <p className="text-gray-400 text-sm">
            <strong className="text-white">Instructions:</strong> Upload a clear photo of your college-issued student ID card (front side). 
            This helps us ensure that only genuine students use CampusPool.
          </p>
        </div>
      )}
    </div>
  );
};

// Profile Page
const ProfilePage = ({ setCurrentPage }) => {
  const { user, updateUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    role: user?.role || 'rider',
    vehicle_model: user?.vehicle_model || '',
    vehicle_number: user?.vehicle_number || '',
    vehicle_color: user?.vehicle_color || '',
    branch: user?.branch || '',
    academic_year: user?.academic_year || '',
  });
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  // Load branches and academic years
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [branchData, yearData] = await Promise.all([
          api('/api/branches'),
          api('/api/academic-years')
        ]);
        setBranches(branchData.branches);
        setAcademicYears(yearData.academic_years);
      } catch (error) {
        console.error('Failed to load community options:', error);
      }
    };
    loadOptions();
  }, []);

  // Update formData when user data changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        role: user.role || 'rider',
        vehicle_model: user.vehicle_model || '',
        vehicle_number: user.vehicle_number || '',
        vehicle_color: user.vehicle_color || '',
        branch: user.branch || '',
        academic_year: user.academic_year || '',
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api('/api/profile/community', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      updateUser(data.user);
      toast.success('Profile updated!');
      setEditing(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get branch and year names
  const branchName = branches.find(b => b.id === user?.branch)?.name;
  const yearName = academicYears.find(y => y.id === user?.academic_year)?.name;

  return (
    <div className="min-h-screen bg-black" data-testid="profile-page">
      <Navigation currentPage="profile" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
          <p className="text-gray-400">Manage your account</p>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] mb-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-[#333] flex items-center justify-center relative">
              <User className="w-10 h-10 text-gray-400" />
              {user?.verification_status === 'verified' && (
                <div className="absolute -bottom-1 -right-1">
                  <VerifiedBadge status="verified" size="md" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">{user?.name}</h2>
              </div>
              <p className="text-gray-400">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`status-badge ${user?.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
                  {user?.role}
                </span>
                <VerificationStatusBadge status={user?.verification_status} />
                {/* Phase 6: Trust Badge */}
                {user?.trust_level && (
                  <TrustBadge trustLevel={user.trust_level} size="sm" />
                )}
              </div>
              {/* Phase 7: Community Info Display */}
              {(branchName || yearName) && (
                <div className="flex items-center gap-2 mt-2 text-gray-400 text-sm">
                  <GraduationCap className="w-4 h-4 text-[#06C167]" />
                  {branchName && <span>{branchName}</span>}
                  {branchName && yearName && <span>•</span>}
                  {yearName && <span>{yearName}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Phase 6: Rating Section */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#0D0D0D] rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Your Rating</p>
              {user?.average_rating ? (
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold text-white">{user.average_rating.toFixed(1)}</span>
                  <span className="text-gray-500 text-sm">({user.total_ratings || 0})</span>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No ratings yet</p>
              )}
            </div>
            <div className="bg-[#0D0D0D] rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Completed Rides</p>
              <p className="text-2xl font-bold text-white">{user?.ride_count || 0}</p>
            </div>
          </div>

          {/* Ride Count */}
          {user?.ride_count !== undefined && (
            <div className="bg-[#0D0D0D] rounded-lg p-4 mb-6">
              <p className="text-gray-400 text-sm">Completed Rides</p>
              <p className="text-2xl font-bold text-white">{user.ride_count}</p>
            </div>
          )}

          {!user?.is_admin && (
            editing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-uber"
                    data-testid="profile-name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="input-uber"
                    data-testid="profile-role"
                  >
                    <option value="rider">Rider</option>
                    <option value="driver">Driver</option>
                  </select>
                </div>
                
                {/* Vehicle Details Section - Only for drivers */}
                {(formData.role === 'driver' || user?.role === 'driver') && (
                  <div className="pt-4 border-t border-[#333]">
                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                      <Car className="w-4 h-4 text-[#06C167]" />
                      Vehicle Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Vehicle Model</label>
                        <input
                          type="text"
                          value={formData.vehicle_model}
                          onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                          className="input-uber"
                          placeholder="e.g., Honda City, Maruti Swift"
                          data-testid="vehicle-model"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Vehicle Number</label>
                        <input
                          type="text"
                          value={formData.vehicle_number}
                          onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                          className="input-uber"
                          placeholder="e.g., KA-01-AB-1234"
                          data-testid="vehicle-number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Vehicle Color</label>
                        <input
                          type="text"
                          value={formData.vehicle_color}
                          onChange={(e) => setFormData({ ...formData, vehicle_color: e.target.value })}
                          className="input-uber"
                          placeholder="e.g., White, Silver, Black"
                          data-testid="vehicle-color"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Phase 7: Community Details Section */}
                <div className="pt-4 border-t border-[#333]">
                  <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[#06C167]" />
                    Academic Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Branch</label>
                      <select
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                        className="input-uber"
                        data-testid="profile-branch"
                      >
                        <option value="">Select Branch</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Year</label>
                      <select
                        value={formData.academic_year}
                        onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                        className="input-uber"
                        data-testid="profile-year"
                      >
                        <option value="">Select Year</option>
                        {academicYears.map((y) => (
                          <option key={y.id} value={y.id}>{y.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="flex-1 btn-uber-green" data-testid="save-profile">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="btn-uber-dark"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Vehicle Details Display - Only for drivers */}
                {user?.role === 'driver' && (
                  <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4">
                    <p className="text-gray-500 text-xs mb-2 flex items-center gap-1">
                      <Car className="w-3 h-3" /> VEHICLE DETAILS
                    </p>
                    {(user?.vehicle_model || user?.vehicle_number || user?.vehicle_color) ? (
                      <div className="space-y-1">
                        {user?.vehicle_model && (
                          <p className="text-white text-sm font-medium">{user.vehicle_model}</p>
                        )}
                        {user?.vehicle_number && (
                          <p className="text-[#06C167] text-sm font-mono">{user.vehicle_number}</p>
                        )}
                        {user?.vehicle_color && (
                          <p className="text-gray-400 text-xs">{user.vehicle_color}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No vehicle details added. Click Edit Profile to add.</p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="btn-uber-dark w-full"
                  data-testid="edit-profile-btn"
                >
                  Edit Profile
                </button>
              </>
            )
          )}
        </div>

        {/* Verification Section (only for non-admin users) */}
        {!user?.is_admin && <VerificationSection />}

        {/* Phase 7: Badges Display */}
        {!user?.is_admin && user?.badges && user.badges.length > 0 && (
          <div className="mb-6">
            <BadgesDisplay badges={user.badges} />
          </div>
        )}

        <button
          onClick={logout}
          className="w-full py-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition flex items-center justify-center gap-2"
          data-testid="logout-profile-btn"
        >
          <LogOut className="w-5 h-5" /> Sign Out
        </button>
      </div>
    </div>
  );
};

// Admin Verifications Page
const AdminVerificationsPage = ({ setCurrentPage }) => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    loadVerifications();
  }, [filter]);

  const loadVerifications = async () => {
    setLoading(true);
    try {
      const endpoint = filter === 'pending' ? '/api/admin/verifications' : '/api/admin/verifications/all';
      const data = await api(endpoint);
      let items = data.verifications;
      
      if (filter !== 'pending' && filter !== 'all') {
        items = items.filter(v => v.verification_status === filter);
      }
      
      setVerifications(items);
    } catch (error) {
      toast.error('Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    setActionLoading(true);
    try {
      await api(`/api/admin/verifications/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      });
      toast.success('User verified successfully');
      loadVerifications();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    
    setActionLoading(true);
    try {
      await api(`/api/admin/verifications/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'reject', reason: rejectReason }),
      });
      toast.success('Verification rejected');
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedUser(null);
      loadVerifications();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-verifications-page">
      <Navigation currentPage="verifications" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">ID Verifications</h1>
          <p className="text-gray-400">Review and manage student verification requests</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'pending', label: 'Pending' },
            { id: 'verified', label: 'Verified' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'all', label: 'All' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === tab.id
                  ? 'bg-white text-black'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
              }`}
              data-testid={`filter-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
                <div className="flex gap-4">
                  <div className="skeleton w-32 h-32 rounded-lg" />
                  <div className="flex-1">
                    <div className="skeleton h-6 w-32 mb-2 rounded" />
                    <div className="skeleton h-4 w-48 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : verifications.length === 0 ? (
          <div className="text-center py-16">
            <FileCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No {filter} verifications</h3>
            <p className="text-gray-400">
              {filter === 'pending' ? 'All verification requests have been processed' : 'No records found'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {verifications.map((verification) => (
              <div 
                key={verification.id} 
                className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] animate-fade-in"
                data-testid={`verification-item-${verification.id}`}
              >
                <div className="flex flex-col md:flex-row gap-6">
                  {/* ID Image */}
                  {verification.student_id_image && (
                    <div className="md:w-64 flex-shrink-0">
                      <p className="text-gray-400 text-sm mb-2">Student ID</p>
                      <img 
                        src={verification.student_id_image} 
                        alt="Student ID"
                        className="w-full rounded-lg border border-[#333] cursor-pointer hover:opacity-80 transition"
                        onClick={() => window.open(verification.student_id_image, '_blank')}
                        data-testid={`id-image-${verification.id}`}
                      />
                    </div>
                  )}
                  
                  {/* User Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-white">{verification.name}</h3>
                        <p className="text-gray-400">{verification.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`status-badge ${verification.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
                          {verification.role}
                        </span>
                        <VerificationStatusBadge status={verification.verification_status || 'pending'} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-500">Submitted</p>
                        <p className="text-gray-300">
                          {verification.submitted_at 
                            ? new Date(verification.submitted_at).toLocaleString() 
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Member Since</p>
                        <p className="text-gray-300">
                          {verification.created_at 
                            ? new Date(verification.created_at).toLocaleDateString() 
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {verification.rejection_reason && (
                      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-400 text-sm">
                          <strong>Rejection Reason:</strong> {verification.rejection_reason}
                        </p>
                      </div>
                    )}

                    {/* Actions (only for pending) */}
                    {(verification.verification_status === 'pending' || !verification.verification_status) && verification.student_id_image && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(verification.id)}
                          disabled={actionLoading}
                          className="flex-1 btn-uber-green py-2 flex items-center justify-center gap-2"
                          data-testid={`approve-${verification.id}`}
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(verification);
                            setShowRejectModal(true);
                          }}
                          disabled={actionLoading}
                          className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center gap-2 hover:bg-red-500/30 transition"
                          data-testid={`reject-${verification.id}`}
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowRejectModal(false)}>
          <div 
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full mx-4 border border-[#333]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-white mb-4">Reject Verification</h3>
            <p className="text-gray-400 mb-4">
              Please provide a reason for rejecting {selectedUser?.name}'s verification:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input-uber h-24 resize-none mb-4"
              placeholder="e.g., ID photo is unclear, incorrect document..."
              data-testid="reject-reason-input"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                data-testid="confirm-reject-btn"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="btn-uber-dark"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = ({ setCurrentPage }) => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [reports, setReports] = useState({ pending: 0, total: 0 });
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, usersData, ridesData, reportsData] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/users'),
        api('/api/admin/rides'),
        api('/api/admin/reports').catch(() => ({ reports: [], stats: { pending: 0 } })),
      ]);
      setStats(statsData.stats);
      setUsers(usersData.users);
      setRides(ridesData.rides);
      setReports({ pending: reportsData.stats?.pending || 0, total: reportsData.reports?.length || 0 });
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-dashboard">
      <Navigation currentPage="admin" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Monitor and manage CampusPool</p>
        </div>

        {/* Quick Action - Active SOS Alerts (Phase 4) */}
        {stats?.active_sos > 0 && (
          <div 
            className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-4 flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition animate-pulse"
            onClick={() => setCurrentPage('sos')}
            data-testid="active-sos-banner"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-400 font-medium">
                🚨 {stats.active_sos} active SOS alert{stats.active_sos > 1 ? 's' : ''} require attention!
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-red-400" />
          </div>
        )}

        {/* Quick Action - Pending Reports (Phase 8) */}
        {reports.pending > 0 && (
          <div 
            className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-4 flex items-center justify-between cursor-pointer hover:bg-orange-500/20 transition"
            onClick={() => setCurrentPage('reports')}
            data-testid="pending-reports-banner"
          >
            <div className="flex items-center gap-3">
              <Flag className="w-5 h-5 text-orange-400" />
              <span className="text-orange-400">
                {reports.pending} pending report{reports.pending > 1 ? 's' : ''} to review
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-orange-400" />
          </div>
        )}

        {/* Quick Action - Pending Verifications */}
        {stats?.pending_verifications > 0 && (
          <div 
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-center justify-between cursor-pointer hover:bg-yellow-500/20 transition"
            onClick={() => setCurrentPage('verifications')}
            data-testid="pending-verifications-banner"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400">
                {stats.pending_verifications} pending verification{stats.pending_verifications > 1 ? 's' : ''} to review
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-yellow-400" />
          </div>
        )}

        {/* Quick Actions Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          <button
            onClick={() => setCurrentPage('users')}
            className="bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-xl p-4 flex items-center gap-3 transition"
            data-testid="quick-users"
          >
            <Users className="w-5 h-5 text-blue-400" />
            <span className="text-white text-sm">Users</span>
          </button>
          <button
            onClick={() => setCurrentPage('rides-monitoring')}
            className="bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-xl p-4 flex items-center gap-3 transition"
            data-testid="quick-rides"
          >
            <Car className="w-5 h-5 text-[#06C167]" />
            <span className="text-white text-sm">Rides</span>
          </button>
          <button
            onClick={() => setCurrentPage('reports')}
            className="bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-xl p-4 flex items-center gap-3 transition"
            data-testid="quick-reports"
          >
            <Flag className="w-5 h-5 text-orange-400" />
            <span className="text-white text-sm">Reports</span>
          </button>
          <button
            onClick={() => setCurrentPage('audit-logs')}
            className="bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-xl p-4 flex items-center gap-3 transition"
            data-testid="quick-audit"
          >
            <ScrollText className="w-5 h-5 text-purple-400" />
            <span className="text-white text-sm">Audit Logs</span>
          </button>
          <button
            onClick={() => setCurrentPage('verifications')}
            className="bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-xl p-4 flex items-center gap-3 transition"
            data-testid="quick-verifications"
          >
            <FileCheck className="w-5 h-5 text-green-400" />
            <span className="text-white text-sm">Verify</span>
          </button>
          <button
            onClick={() => setCurrentPage('analytics')}
            className="bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-xl p-4 flex items-center gap-3 transition"
            data-testid="quick-analytics"
          >
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span className="text-white text-sm">Analytics</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {['overview', 'users', 'rides'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-xl font-medium capitalize transition ${
                activeTab === tab
                  ? 'bg-white text-black'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
              }`}
              data-testid={`admin-tab-${tab}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
                <div className="skeleton h-8 w-16 mb-2 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'overview' && stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                {[
                  { label: 'Total Users', value: stats.total_users, color: 'bg-white' },
                  { label: 'Verified Users', value: stats.verified_users, color: 'bg-green-500' },
                  { label: 'Pending Verifications', value: stats.pending_verifications, color: 'bg-yellow-500', link: 'verifications' },
                  { label: 'Unverified', value: stats.unverified_users, color: 'bg-gray-500' },
                  { label: 'Riders', value: stats.total_riders, color: 'bg-blue-500' },
                  { label: 'Drivers', value: stats.total_drivers, color: 'bg-[#06C167]' },
                  { label: 'Active Rides', value: stats.active_rides, color: 'bg-purple-500', link: 'rides-monitoring' },
                  { label: 'Completed Rides', value: stats.completed_rides, color: 'bg-cyan-500', link: 'rides-monitoring' },
                  { label: 'Active SOS', value: stats.active_sos || 0, color: 'bg-red-500', link: 'sos' },
                  { label: 'Total SOS', value: stats.total_sos || 0, color: 'bg-red-300', link: 'sos' },
                  { label: 'Pending Reports', value: stats.pending_reports || 0, color: 'bg-orange-500', link: 'reports' },
                  { label: 'Total Reports', value: stats.total_reports || 0, color: 'bg-orange-300', link: 'reports' },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    onClick={() => stat.link && setCurrentPage(stat.link)}
                    className={`bg-[#1A1A1A] rounded-xl p-6 border ${
                      stat.link ? 'border-[#333] hover:border-[#555] cursor-pointer' : 'border-[#333]'
                    } animate-slide-up transition`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                    data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${stat.color} mb-3`} />
                    <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                    <p className="text-gray-500 text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden animate-fade-in">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0D0D0D]">
                      <tr>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Name</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Email</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Role</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Verification</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Rides</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-t border-[#333]" data-testid={`admin-user-${user.id}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-white">{user.name}</span>
                              <VerifiedBadge status={user.verification_status} size="xs" />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-400">{user.email}</td>
                          <td className="px-6 py-4">
                            <span className={`status-badge ${user.is_admin ? 'bg-purple-500/20 text-purple-400' : user.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
                              {user.is_admin ? 'admin' : user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <VerificationStatusBadge status={user.verification_status} />
                          </td>
                          <td className="px-6 py-4 text-gray-400">{user.ride_count || 0}</td>
                          <td className="px-6 py-4 text-gray-500 text-sm">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'rides' && (
              <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden animate-fade-in">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0D0D0D]">
                      <tr>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Route</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Driver</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Date</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Seats</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rides.map((ride) => (
                        <tr key={ride.id} className="border-t border-[#333]" data-testid={`admin-ride-${ride.id}`}>
                          <td className="px-6 py-4">
                            <p className="text-white">{ride.source}</p>
                            <p className="text-gray-500 text-sm">to {ride.destination}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{ride.driver_name}</span>
                              <VerifiedBadge status={ride.driver_verification_status} size="xs" />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-400">{ride.date} {ride.time}</td>
                          <td className="px-6 py-4 text-gray-400">{ride.seats_taken}/{ride.available_seats}</td>
                          <td className="px-6 py-4">
                            <span className={`status-badge status-${ride.status}`}>
                              {ride.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Phase 7: Admin Event Tags Management Page
const AdminEventTagsPage = ({ setCurrentPage }) => {
  const [eventTags, setEventTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadEventTags = async () => {
    try {
      const data = await api('/api/event-tags?include_inactive=true');
      setEventTags(data.event_tags);
    } catch (error) {
      toast.error('Failed to load event tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventTags();
  }, []);

  const openCreateModal = () => {
    setEditingTag(null);
    setFormData({ name: '', description: '' });
    setShowModal(true);
  };

  const openEditModal = (tag) => {
    setEditingTag(tag);
    setFormData({ name: tag.name, description: tag.description || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      if (editingTag) {
        await api(`/api/admin/event-tags/${editingTag.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        toast.success('Event tag updated');
      } else {
        await api('/api/admin/event-tags', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        toast.success('Event tag created');
      }
      setShowModal(false);
      loadEventTags();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTagStatus = async (tag) => {
    try {
      await api(`/api/admin/event-tags/${tag.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !tag.is_active }),
      });
      toast.success(`Tag ${tag.is_active ? 'deactivated' : 'activated'}`);
      loadEventTags();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteTag = async (tag) => {
    if (!window.confirm(`Delete "${tag.name}"? This will remove the tag from all rides.`)) return;
    try {
      await api(`/api/admin/event-tags/${tag.id}`, { method: 'DELETE' });
      toast.success('Event tag deleted');
      loadEventTags();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-event-tags-page">
      <Navigation currentPage="event-tags" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Event Tags</h1>
            <p className="text-gray-400">Manage event tags for ride categorization</p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn-uber-green flex items-center gap-2"
            data-testid="create-event-tag-btn"
          >
            <Plus className="w-5 h-5" />
            Create Tag
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500">Loading event tags...</div>
          </div>
        ) : eventTags.length === 0 ? (
          <div className="text-center py-12 bg-[#1A1A1A] rounded-xl border border-[#333]">
            <Tag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-white mb-2">No event tags yet</p>
            <p className="text-gray-500 text-sm mb-4">Create tags like "Exams", "Fests", "Seminars"</p>
            <button onClick={openCreateModal} className="btn-uber-green">
              Create First Tag
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {eventTags.map((tag) => (
              <div
                key={tag.id}
                className={`bg-[#1A1A1A] rounded-xl p-4 border ${tag.is_active ? 'border-[#333]' : 'border-red-500/30 opacity-60'} flex items-center justify-between`}
                data-testid={`event-tag-item-${tag.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tag.is_active ? 'bg-purple-500/20' : 'bg-gray-500/20'}`}>
                    <Tag className={`w-5 h-5 ${tag.is_active ? 'text-purple-400' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="text-white font-medium">{tag.name}</p>
                    {tag.description && (
                      <p className="text-gray-500 text-sm">{tag.description}</p>
                    )}
                    {!tag.is_active && (
                      <span className="text-xs text-red-400">(Inactive)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTagStatus(tag)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${tag.is_active ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
                    data-testid={`toggle-tag-${tag.id}`}
                  >
                    {tag.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEditModal(tag)}
                    className="px-3 py-1.5 rounded-lg text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                    data-testid={`edit-tag-${tag.id}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTag(tag)}
                    className="px-3 py-1.5 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    data-testid={`delete-tag-${tag.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setCurrentPage('admin')}
          className="w-full btn-uber-dark mt-6"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full border border-[#333] animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            data-testid="event-tag-modal"
          >
            <h3 className="text-xl font-bold text-white mb-6">
              {editingTag ? 'Edit Event Tag' : 'Create Event Tag'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-uber"
                  placeholder="e.g., Mid-Semester Exams"
                  maxLength={50}
                  data-testid="event-tag-name-input"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-uber min-h-[80px]"
                  placeholder="Brief description of the event..."
                  maxLength={200}
                  data-testid="event-tag-desc-input"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 btn-uber-dark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 btn-uber-green"
                  data-testid="submit-event-tag-btn"
                >
                  {submitting ? 'Saving...' : editingTag ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Phase 8: Admin User Management Page
const AdminUsersPage = ({ setCurrentPage }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('all'); // all, active, disabled, verified, unverified
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = async () => {
    try {
      const data = await api('/api/admin/users');
      setUsers(data.users);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUserStatusToggle = async (user) => {
    setActionLoading(user.id);
    try {
      await api(`/api/admin/users/${user.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          is_active: !user.is_active,
          reason: user.is_active ? 'Disabled by admin' : 'Re-enabled by admin'
        }),
      });
      toast.success(`User ${user.is_active ? 'disabled' : 'enabled'} successfully`);
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeVerification = async (user) => {
    if (!window.confirm(`Revoke verification for ${user.name}?`)) return;
    setActionLoading(user.id);
    try {
      await api(`/api/admin/verifications/${user.id}/revoke`, {
        method: 'PUT',
      });
      toast.success('Verification revoked');
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE ${user.name}?\n\nThis will remove:\n- User account\n- All rides posted\n- All ride requests\n- All chat messages\n- All ratings\n- All reports\n\nThis action CANNOT be undone!`)) return;
    setActionLoading(user.id);
    try {
      await api(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });
      toast.success(`User ${user.name} permanently deleted`);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(user => {
    if (user.is_admin) return false; // Exclude admin from management
    if (searchQuery && !user.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !user.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    switch (filter) {
      case 'active': return user.is_active !== false;
      case 'disabled': return user.is_active === false;
      case 'verified': return user.verification_status === 'verified';
      case 'unverified': return user.verification_status !== 'verified';
      default: return true;
    }
  });

  return (
    <div className="min-h-screen bg-black" data-testid="admin-users-page">
      <Navigation currentPage="users" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-gray-400">Manage user accounts and permissions</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-uber flex-1 max-w-md"
            data-testid="user-search-input"
          />
          <div className="flex gap-2 overflow-x-auto">
            {['all', 'active', 'disabled', 'verified', 'unverified'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg capitalize whitespace-nowrap ${
                  filter === f ? 'bg-white text-black' : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
                }`}
                data-testid={`filter-${f}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500">Loading users...</div>
          </div>
        ) : (
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0D0D0D]">
                  <tr>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">User</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Role</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Status</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Verification</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Rating</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-[#333]" data-testid={`user-row-${user.id}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white flex items-center gap-2">
                            {user.name}
                            {user.is_active === false && (
                              <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">Disabled</span>
                            )}
                          </p>
                          <p className="text-gray-500 text-sm">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`status-badge ${user.role === 'driver' ? 'status-active' : 'status-accepted'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                          user.is_active !== false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {user.is_active !== false ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {user.is_active !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <VerificationStatusBadge status={user.verification_status} />
                      </td>
                      <td className="px-6 py-4">
                        {user.average_rating ? (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Star className="w-4 h-4 fill-yellow-400" />
                            {user.average_rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="px-3 py-1.5 rounded-lg text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                            data-testid={`view-user-${user.id}`}
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleUserStatusToggle(user)}
                            disabled={actionLoading === user.id}
                            className={`px-3 py-1.5 rounded-lg text-sm ${
                              user.is_active !== false 
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            } disabled:opacity-50`}
                            data-testid={`toggle-user-${user.id}`}
                          >
                            {actionLoading === user.id ? '...' : user.is_active !== false ? 'Disable' : 'Enable'}
                          </button>
                          {user.verification_status === 'verified' && (
                            <button
                              onClick={() => handleRevokeVerification(user)}
                              disabled={actionLoading === user.id}
                              className="px-3 py-1.5 rounded-lg text-sm bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
                              data-testid={`revoke-verification-${user.id}`}
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 rounded-lg text-sm bg-red-600/30 text-red-300 hover:bg-red-600/50 disabled:opacity-50"
                            data-testid={`delete-user-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-lg w-full border border-[#333] animate-fade-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            data-testid="user-detail-modal"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#333] flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-white text-lg font-semibold">{selectedUser.name}</p>
                  <p className="text-gray-400">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0D0D0D] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Role</p>
                  <p className="text-white capitalize">{selectedUser.role}</p>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Status</p>
                  <p className={selectedUser.is_active !== false ? 'text-green-400' : 'text-red-400'}>
                    {selectedUser.is_active !== false ? 'Active' : 'Disabled'}
                  </p>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Verification</p>
                  <p className="text-white capitalize">{selectedUser.verification_status}</p>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Rides</p>
                  <p className="text-white">{selectedUser.ride_count || 0}</p>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Rating</p>
                  <p className="text-white">{selectedUser.average_rating ? `${selectedUser.average_rating.toFixed(1)}/5` : 'N/A'}</p>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Warnings</p>
                  <p className="text-white">{selectedUser.warning_count || 0}</p>
                </div>
              </div>

              {selectedUser.created_at && (
                <p className="text-gray-500 text-sm">
                  Joined: {new Date(selectedUser.created_at).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleDeleteUser(selectedUser)}
                disabled={actionLoading === selectedUser.id}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600/30 text-red-300 hover:bg-red-600/50 flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="modal-delete-user"
              >
                <Trash2 className="w-4 h-4" />
                {actionLoading === selectedUser.id ? 'Deleting...' : 'Delete User'}
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 btn-uber-dark"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Phase 8: Admin Reports Page
const AdminReportsPage = ({ setCurrentPage }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, under_review, resolved, dismissed
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [stats, setStats] = useState({ pending: 0, under_review: 0 });

  const loadReports = async () => {
    try {
      const status = filter !== 'all' ? filter : '';
      const data = await api(`/api/admin/reports${status ? `?status=${status}` : ''}`);
      setReports(data.reports);
      setStats({ pending: data.stats?.pending || 0, under_review: data.stats?.under_review || 0 });
    } catch (error) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [filter]);

  const handleReportAction = async (reportId, action, adminNotes = '') => {
    setActionLoading(reportId);
    try {
      await api(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        body: JSON.stringify({ action, admin_notes: adminNotes }),
      });
      toast.success(`Report ${action === 'dismiss' ? 'dismissed' : 'handled'} successfully`);
      setSelectedReport(null);
      loadReports();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'safety': return 'bg-red-500/20 text-red-400';
      case 'behavior': return 'bg-yellow-500/20 text-yellow-400';
      case 'misuse': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      case 'under_review': return 'bg-blue-500/20 text-blue-400';
      case 'resolved': return 'bg-green-500/20 text-green-400';
      case 'dismissed': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-reports-page">
      <Navigation currentPage="reports" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Report Management</h1>
          <p className="text-gray-400">Review and handle user reports</p>
        </div>

        {/* Stats Banner */}
        {(stats.pending > 0 || stats.under_review > 0) && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-medium">{stats.pending} Pending</span>
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                <span className="text-blue-400 font-medium">{stats.under_review} Under Review</span>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['all', 'pending', 'under_review', 'resolved', 'dismissed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg capitalize whitespace-nowrap ${
                filter === f ? 'bg-white text-black' : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
              }`}
              data-testid={`filter-${f}`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500">Loading reports...</div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 bg-[#1A1A1A] rounded-xl border border-[#333]">
            <Flag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-white mb-2">No reports found</p>
            <p className="text-gray-500 text-sm">Great! No user reports to handle.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333]"
                data-testid={`report-item-${report.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(report.category)}`}>
                        {report.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(report.status)}`}>
                        {report.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-white mb-2">{report.description}</p>
                    <div className="text-gray-500 text-sm space-y-1">
                      <p>Reporter: <span className="text-gray-400">{report.reporter_name}</span></p>
                      {report.reported_user_name && (
                        <p>Reported User: <span className="text-gray-400">{report.reported_user_name}</span></p>
                      )}
                      <p>Submitted: {new Date(report.created_at).toLocaleString()}</p>
                    </div>
                    {report.admin_notes && (
                      <div className="mt-2 p-2 bg-[#0D0D0D] rounded-lg">
                        <p className="text-gray-500 text-xs">Admin Notes:</p>
                        <p className="text-gray-400 text-sm">{report.admin_notes}</p>
                      </div>
                    )}
                  </div>
                  {report.status === 'pending' && (
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="btn-uber-green px-4 py-2 text-sm"
                      data-testid={`handle-report-${report.id}`}
                    >
                      Handle
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Handle Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReport(null)}>
          <div
            className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full border border-[#333] animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            data-testid="handle-report-modal"
          >
            <h3 className="text-xl font-bold text-white mb-4">Handle Report</h3>
            
            <div className="bg-[#0D0D0D] rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-sm">{selectedReport.description}</p>
              {selectedReport.reported_user_name && (
                <p className="text-gray-500 text-sm mt-2">Reported User: {selectedReport.reported_user_name}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Admin Notes</label>
              <textarea
                id="admin-report-notes"
                className="input-uber w-full h-24 resize-none"
                placeholder="Add notes about this report..."
              />
            </div>

            <p className="text-gray-400 text-sm mb-4">Select action:</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const notes = document.getElementById('admin-report-notes').value;
                  handleReportAction(selectedReport.id, 'warn', notes);
                }}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition disabled:opacity-50"
                data-testid="action-warn"
              >
                <AlertCircle className="w-4 h-4 inline mr-2" /> Warn User
              </button>
              <button
                onClick={() => {
                  const notes = document.getElementById('admin-report-notes').value;
                  handleReportAction(selectedReport.id, 'suspend', notes);
                }}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition disabled:opacity-50"
                data-testid="action-suspend"
              >
                <Ban className="w-4 h-4 inline mr-2" /> Suspend User
              </button>
              <button
                onClick={() => {
                  const notes = document.getElementById('admin-report-notes').value;
                  handleReportAction(selectedReport.id, 'disable', notes);
                }}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition disabled:opacity-50"
                data-testid="action-disable"
              >
                <UserX className="w-4 h-4 inline mr-2" /> Disable Account
              </button>
              <button
                onClick={() => {
                  const notes = document.getElementById('admin-report-notes').value;
                  handleReportAction(selectedReport.id, 'dismiss', notes);
                }}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition disabled:opacity-50"
                data-testid="action-dismiss"
              >
                <XCircle className="w-4 h-4 inline mr-2" /> Dismiss Report
              </button>
            </div>

            <button
              onClick={() => setSelectedReport(null)}
              className="w-full btn-uber-dark mt-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Phase 8: Admin Audit Logs Page
const AdminAuditLogsPage = ({ setCurrentPage }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, user, verification, sos, report
  const [limit, setLimit] = useState(50);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const actionType = filter !== 'all' ? filter : '';
      const data = await api(`/api/admin/audit-logs?limit=${limit}${actionType ? `&action_type=${actionType}` : ''}`);
      setLogs(data.audit_logs);
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filter, limit]);

  const getActionIcon = (actionType) => {
    if (actionType.includes('user')) return <User className="w-4 h-4" />;
    if (actionType.includes('verification')) return <FileCheck className="w-4 h-4" />;
    if (actionType.includes('sos')) return <AlertTriangle className="w-4 h-4" />;
    if (actionType.includes('report')) return <Flag className="w-4 h-4" />;
    return <Shield className="w-4 h-4" />;
  };

  const getActionColor = (actionType) => {
    if (actionType.includes('disabled') || actionType.includes('revoked')) return 'text-red-400';
    if (actionType.includes('enabled') || actionType.includes('approved') || actionType.includes('promoted')) return 'text-green-400';
    if (actionType.includes('rejected') || actionType.includes('resolved')) return 'text-yellow-400';
    return 'text-blue-400';
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-audit-logs-page">
      <Navigation currentPage="audit-logs" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Audit Logs</h1>
          <p className="text-gray-400">Track all admin actions for transparency</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-2 overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'user', label: 'User Actions' },
              { id: 'verification', label: 'Verifications' },
              { id: 'sos', label: 'SOS' },
              { id: 'report', label: 'Reports' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                  filter === f.id ? 'bg-white text-black' : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
                }`}
                data-testid={`filter-${f.id}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="input-uber w-32"
            data-testid="limit-select"
          >
            <option value={25}>25 logs</option>
            <option value={50}>50 logs</option>
            <option value={100}>100 logs</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500">Loading audit logs...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 bg-[#1A1A1A] rounded-xl border border-[#333]">
            <ScrollText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-white mb-2">No audit logs found</p>
            <p className="text-gray-500 text-sm">Admin actions will appear here.</p>
          </div>
        ) : (
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden">
            <div className="space-y-0">
              {logs.map((log, index) => (
                <div
                  key={log.id}
                  className={`p-4 ${index !== logs.length - 1 ? 'border-b border-[#333]' : ''}`}
                  data-testid={`audit-log-${log.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-[#0D0D0D] flex items-center justify-center ${getActionColor(log.action_type)}`}>
                      {getActionIcon(log.action_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${getActionColor(log.action_type)}`}>
                          {log.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-500 text-sm">{log.target_type}</span>
                      </div>
                      <p className="text-gray-400 text-sm">
                        By: <span className="text-white">{log.admin_name}</span>
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2 text-sm text-gray-500">
                          {log.details.user_name && <span>User: {log.details.user_name}</span>}
                          {log.details.reason && <span className="block">Reason: {log.details.reason}</span>}
                          {log.details.notes && <span className="block">Notes: {log.details.notes}</span>}
                        </div>
                      )}
                      <p className="text-gray-600 text-xs mt-2">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Phase 8: Admin Ride Monitoring Page
const AdminRidesMonitoringPage = ({ setCurrentPage }) => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stats, setStats] = useState({ total: 0, cancelled_count: 0 });

  const loadRides = async () => {
    setLoading(true);
    try {
      let params = [];
      if (statusFilter !== 'all') params.push(`status=${statusFilter}`);
      if (dateFrom) params.push(`date_from=${dateFrom}`);
      if (dateTo) params.push(`date_to=${dateTo}`);
      const queryString = params.length > 0 ? `?${params.join('&')}` : '';
      const data = await api(`/api/admin/rides/monitoring${queryString}`);
      setRides(data.rides);
      setStats(data.stats);
    } catch (error) {
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRides();
  }, [statusFilter, dateFrom, dateTo]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'completed': return 'bg-blue-500/20 text-blue-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-black" data-testid="admin-rides-monitoring-page">
      <Navigation currentPage="rides-monitoring" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Ride Monitoring</h1>
          <p className="text-gray-400">Monitor and track all rides across the platform</p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333]">
            <p className="text-gray-500 text-sm">Total Rides</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-red-500/30">
            <p className="text-gray-500 text-sm">Cancelled</p>
            <p className="text-2xl font-bold text-red-400">{stats.cancelled_count}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#333] mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex gap-2 flex-wrap">
              {['all', 'active', 'completed', 'cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg capitalize ${
                    statusFilter === status ? 'bg-white text-black' : 'bg-[#0D0D0D] text-gray-400 hover:text-white'
                  }`}
                  data-testid={`filter-status-${status}`}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="flex gap-3 items-center ml-auto">
              <div>
                <label className="text-gray-500 text-xs block mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input-uber py-2"
                  data-testid="filter-date-from"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input-uber py-2"
                  data-testid="filter-date-to"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-gray-400 hover:text-white text-sm mt-4"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500">Loading rides...</div>
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-12 bg-[#1A1A1A] rounded-xl border border-[#333]">
            <Car className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-white mb-2">No rides found</p>
            <p className="text-gray-500 text-sm">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0D0D0D]">
                  <tr>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Route</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Driver</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Date/Time</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Seats</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Status</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">SOS</th>
                  </tr>
                </thead>
                <tbody>
                  {rides.map((ride) => (
                    <tr key={ride.id} className="border-t border-[#333]" data-testid={`ride-row-${ride.id}`}>
                      <td className="px-6 py-4">
                        <p className="text-white">{ride.source}</p>
                        <p className="text-gray-500 text-sm">→ {ride.destination}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{ride.driver_name}</span>
                          <VerifiedBadge status={ride.driver_verification_status} size="xs" />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        <p>{ride.date}</p>
                        <p className="text-sm text-gray-500">{ride.time}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-400">{ride.seats_taken}/{ride.available_seats}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ride.status)}`}>
                          {ride.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {ride.sos_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {ride.sos_count}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Phase 8: Admin Analytics Page
const AdminAnalyticsPage = ({ setCurrentPage }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await api('/api/admin/analytics');
        setAnalytics(data);
      } catch (error) {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black" data-testid="admin-analytics-page">
        <Navigation currentPage="analytics" setCurrentPage={setCurrentPage} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500">Loading analytics...</div>
          </div>
        </div>
      </div>
    );
  }

  const maxRides = Math.max(...(analytics?.daily_rides?.map(d => d.rides) || [1]));

  return (
    <div className="min-h-screen bg-black" data-testid="admin-analytics-page">
      <Navigation currentPage="analytics" setCurrentPage={setCurrentPage} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-2">Analytics Overview</h1>
          <p className="text-gray-400">System insights and engagement metrics</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Rides Chart */}
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#06C167]" />
              Rides (Last 7 Days)
            </h3>
            <div className="flex items-end gap-2 h-40">
              {analytics?.daily_rides?.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-[#06C167] rounded-t-sm transition-all hover:bg-[#08d975]"
                    style={{ height: `${(day.rides / maxRides) * 100}%`, minHeight: day.rides > 0 ? '8px' : '2px' }}
                    title={`${day.rides} rides`}
                  />
                  <span className="text-gray-500 text-xs mt-2">{day.day}</span>
                  <span className="text-white text-xs font-medium">{day.rides}</span>
                </div>
              ))}
            </div>
          </div>

          {/* User Roles Distribution */}
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              User Distribution
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400 text-sm">Riders</span>
                  <span className="text-white">{analytics?.user_roles?.riders || 0}</span>
                </div>
                <div className="h-3 bg-[#0D0D0D] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${((analytics?.user_roles?.riders || 0) / ((analytics?.user_roles?.riders || 0) + (analytics?.user_roles?.drivers || 0))) * 100 || 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400 text-sm">Drivers</span>
                  <span className="text-white">{analytics?.user_roles?.drivers || 0}</span>
                </div>
                <div className="h-3 bg-[#0D0D0D] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#06C167] rounded-full transition-all"
                    style={{ width: `${((analytics?.user_roles?.drivers || 0) / ((analytics?.user_roles?.riders || 0) + (analytics?.user_roles?.drivers || 0))) * 100 || 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400 text-sm">Admins</span>
                  <span className="text-white">{analytics?.user_roles?.admins || 0}</span>
                </div>
                <div className="h-3 bg-[#0D0D0D] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${analytics?.user_roles?.admins ? 10 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              Verification Status
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0D0D0D] rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-400">{analytics?.verification_status?.verified || 0}</p>
                <p className="text-gray-500 text-sm">Verified</p>
              </div>
              <div className="bg-[#0D0D0D] rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-yellow-400">{analytics?.verification_status?.pending || 0}</p>
                <p className="text-gray-500 text-sm">Pending</p>
              </div>
              <div className="bg-[#0D0D0D] rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-gray-400">{analytics?.verification_status?.unverified || 0}</p>
                <p className="text-gray-500 text-sm">Unverified</p>
              </div>
              <div className="bg-[#0D0D0D] rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-400">{analytics?.verification_status?.rejected || 0}</p>
                <p className="text-gray-500 text-sm">Rejected</p>
              </div>
            </div>
          </div>

          {/* Report Categories */}
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Flag className="w-5 h-5 text-orange-400" />
              Report Categories
            </h3>
            <div className="space-y-3">
              {[
                { key: 'safety', label: 'Safety', color: 'bg-red-500' },
                { key: 'behavior', label: 'Behavior', color: 'bg-yellow-500' },
                { key: 'misuse', label: 'Misuse', color: 'bg-orange-500' },
                { key: 'other', label: 'Other', color: 'bg-gray-500' },
              ].map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="text-gray-400 flex-1">{label}</span>
                  <span className="text-white font-medium">{analytics?.report_categories?.[key] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SOS Status */}
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333] lg:col-span-2">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              SOS Events Summary
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-400">{analytics?.sos_statuses?.active || 0}</p>
                <p className="text-gray-500 text-sm">Active</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-yellow-400">{analytics?.sos_statuses?.under_review || 0}</p>
                <p className="text-gray-500 text-sm">Under Review</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-400">{analytics?.sos_statuses?.resolved || 0}</p>
                <p className="text-gray-500 text-sm">Resolved</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Phase 8: Report User Modal (for regular users)
const ReportUserModal = ({ targetUserId, targetUserName, rideId, onClose }) => {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || !description) {
      toast.error('Please fill all fields');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          reported_user_id: targetUserId,
          ride_id: rideId,
          category,
          description
        }),
      });
      toast.success('Report submitted successfully');
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#1A1A1A] rounded-xl p-6 max-w-md w-full border border-[#333] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="report-user-modal"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Report {targetUserName ? `${targetUserName}` : 'Issue'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-uber w-full"
              required
              data-testid="report-category"
            >
              <option value="">Select category</option>
              <option value="safety">Safety Concern</option>
              <option value="behavior">Inappropriate Behavior</option>
              <option value="misuse">Platform Misuse</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-uber w-full h-32 resize-none"
              placeholder="Please describe the issue in detail..."
              required
              minLength={10}
              maxLength={1000}
              data-testid="report-description"
            />
            <p className="text-gray-500 text-xs mt-1">{description.length}/1000 characters</p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 btn-uber-dark">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 btn-uber-green disabled:opacity-50"
              data-testid="submit-report"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main App Component
const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [authMode, setAuthMode] = useState('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Car className="w-8 h-8 text-black" />
          </div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return authMode === 'login' ? (
      <LoginPage onSwitch={() => setAuthMode('signup')} />
    ) : (
      <SignupPage onSwitch={() => setAuthMode('login')} />
    );
  }

  // Admin routes
  if (user.is_admin) {
    switch (currentPage) {
      case 'verifications':
        return <AdminVerificationsPage setCurrentPage={setCurrentPage} />;
      case 'sos':
        return <AdminSOSPage setCurrentPage={setCurrentPage} />;
      case 'event-tags':
        return <AdminEventTagsPage setCurrentPage={setCurrentPage} />;
      case 'users':
        return <AdminUsersPage setCurrentPage={setCurrentPage} />;
      case 'reports':
        return <AdminReportsPage setCurrentPage={setCurrentPage} />;
      case 'audit-logs':
        return <AdminAuditLogsPage setCurrentPage={setCurrentPage} />;
      case 'rides-monitoring':
        return <AdminRidesMonitoringPage setCurrentPage={setCurrentPage} />;
      case 'analytics':
        return <AdminAnalyticsPage setCurrentPage={setCurrentPage} />;
      case 'profile':
        return <ProfilePage setCurrentPage={setCurrentPage} />;
      default:
        return <AdminDashboard setCurrentPage={setCurrentPage} />;
    }
  }

  // Driver routes
  if (user.role === 'driver') {
    switch (currentPage) {
      case 'post-ride':
        return <PostRidePage setCurrentPage={setCurrentPage} />;
      case 'requests':
        return <DriverRequestsPage setCurrentPage={setCurrentPage} />;
      case 'stats':
        return <StatsPage setCurrentPage={setCurrentPage} />;
      case 'history':
        return <RideHistoryPage setCurrentPage={setCurrentPage} />;
      case 'live-ride':
        return <LiveRideScreen requestId={currentPage.split(':')[1] || localStorage.getItem('liveRideId')} onBack={() => setCurrentPage('requests')} />;
      case 'profile':
        return <ProfilePage setCurrentPage={setCurrentPage} />;
      default:
        if (currentPage.startsWith('live-ride:')) {
          return <LiveRideScreen requestId={currentPage.split(':')[1]} onBack={() => setCurrentPage('requests')} />;
        }
        return <DriverDashboard setCurrentPage={setCurrentPage} />;
    }
  }

  // Rider routes
  switch (currentPage) {
    case 'browse':
      return <BrowseRidesPage setCurrentPage={setCurrentPage} />;
    case 'my-requests':
      return <MyRequestsPage setCurrentPage={setCurrentPage} />;
    case 'stats':
      return <StatsPage setCurrentPage={setCurrentPage} />;
    case 'history':
      return <RideHistoryPage setCurrentPage={setCurrentPage} />;
    case 'profile':
      return <ProfilePage setCurrentPage={setCurrentPage} />;
    default:
      if (currentPage.startsWith('live-ride:')) {
        return <LiveRideScreen requestId={currentPage.split(':')[1]} onBack={() => setCurrentPage('my-requests')} />;
      }
      return <RiderDashboard setCurrentPage={setCurrentPage} />;
  }
};

function App() {
  return (
    <AuthProvider>
      <div className="dark">
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              color: '#fff',
              border: '1px solid #333',
            },
          }}
        />
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;
