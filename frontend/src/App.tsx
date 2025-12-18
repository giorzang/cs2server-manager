import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom'; // Import Router
import { useAuthStore } from './store/useAuthStore';
import { Monitor, LogOut, Edit2, Check, X, Users as UsersIcon, Trophy, Swords, Newspaper } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import Matches from './pages/Matches';
import MatchLayout from './components/match/MatchLayout';
import MatchLobby from './components/match/MatchLobby';
import MatchMapStats from './components/match/MatchMapStats';
import api from './services/api';

function App() {
  const { user, checkAuth, isLoading, logout } = useAuthStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    
    if (tokenFromUrl) {
      localStorage.setItem('authToken', tokenFromUrl);
      window.location.href = '/';
      return;
    }
    
    checkAuth();
  }, []);

  const handleLogin = () => {
    window.location.href = '/auth/steam';
  };

  const startEditing = () => {
    if (user) {
      setEditingName(user.username);
      setIsEditingName(true);
    }
  };

  const cancelEditing = () => {
    setIsEditingName(false);
    setEditingName('');
  };

  const saveName = async () => {
    if (!editingName.trim()) return;
    try {
      await api.put('/auth/profile', { username: editingName });
      await checkAuth();
      setIsEditingName(false);
    } catch (error) {
      console.error("Failed to update name", error);
      alert("Không thể đổi tên");
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Đang tải...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-white hover:text-orange-500 transition-colors">
            <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center shadow-lg shadow-orange-600/20">
              <Monitor size={18} className="text-white"/>
            </div>
            CS2 Manager
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
              <Newspaper size={16} /> Tin Tức
            </Link>
            <Link to="/matches" className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
              <Swords size={16} /> Trận Đấu
            </Link>
            <Link to="/tournaments" className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
              <Trophy size={16} /> Giải Đấu
            </Link>
            <Link to="/users" className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
              <UsersIcon size={16} /> BXH
            </Link>
          </nav>
        </div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-800 py-1.5 px-3 rounded-full border border-slate-700">
              <img src={user.avatar_url} alt="Avatar" className="w-6 h-6 rounded-full"/>
              
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input 
                    type="text" 
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none w-32"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                      if (e.key === 'Escape') cancelEditing();
                    }}
                  />
                  <button onClick={saveName} className="p-1 text-green-500 hover:bg-slate-700 rounded-full"><Check size={14}/></button>
                  <button onClick={cancelEditing} className="p-1 text-red-500 hover:bg-slate-700 rounded-full"><X size={14}/></button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-sm">{user.username}</span>
                  <button onClick={startEditing} className="text-slate-500 hover:text-white transition-colors"><Edit2 size={12} /></button>
                </>
              )}
              {user.is_admin === 1 && <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded text-white font-bold tracking-wider">ADMIN</span>}
            </div>
            <button onClick={logout} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><LogOut size={20}/></button>
          </div>
        ) : (
          <button onClick={handleLogin} className="bg-[#171a21] hover:bg-[#2a475e] text-white px-5 py-2 rounded flex items-center gap-2 font-bold transition-all border border-slate-700 text-sm">Đăng nhập Steam</button>
        )}
      </header>

      {/* Routing Content */}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/users" element={<Users />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        
        <Route path="/matches/:id" element={<MatchLayout />}>
            <Route index element={<MatchLobby />} />
            <Route path=":mapnumber" element={<MatchMapStats />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;