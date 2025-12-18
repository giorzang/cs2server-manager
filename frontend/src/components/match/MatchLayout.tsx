import { useEffect, useState, useRef } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { LogOut, Terminal, Send } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import type { Match, Participant, MapData, MatchContextType } from '../../types/common';
import clsx from 'clsx';
import { useMatchSound } from '../../hooks/useMatchSound';

export default function MatchLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [mapPool, setMapPool] = useState<MapData[]>([]);
  
  // RCON State (Giữ lại ở Layout vì Admin có thể chat RCON từ mọi nơi)
  const [rconCommand, setRconCommand] = useState('');
  const [rconLog, setRconLog] = useState<string[]>([]);
  const [sendingRcon, setSendingRcon] = useState(false);
  const [isJoining, setIsJoining] = useState(false); // Chặn spam nút Join
  const logEndRef = useRef<HTMLDivElement>(null);

  // Gọi hook âm thanh
  useMatchSound(socket);

  // 1. Kết nối & Lấy dữ liệu
  useEffect(() => {
    if (!id) return;

    api.get('/api/matches/maps/active').then(res => setMapPool(res.data)).catch(console.error);
    api.get(`/api/matches/${id}`)
      .then(res => {
        setMatch(res.data);
        setParticipants(res.data.participants || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching match:", err);
        if (err.response && err.response.status === 404) {
            navigate('/');
        } else {
            // Nếu lỗi server hoặc mạng, không redirect mà hiện lỗi
            setLoading(false); 
        }
      });

    const token = localStorage.getItem('authToken');
    const newSocket = io('/', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      auth: { token } // Gửi token để xác thực user
    });

    const joinRoom = () => {
        console.log('Socket connected, joining room:', id);
        newSocket.emit('join_match_room', id);
    };

    if (newSocket.connected) {
        joinRoom();
    } else {
        newSocket.on('connect', joinRoom);
    }

    newSocket.on('participants_update', (newList: Participant[]) => {
      setParticipants(newList);
    });

    newSocket.on('veto_update', (data: any) => {
        setMatch(prev => prev ? ({
            ...prev,
            status: data.status,
            veto_log: data.vetoLog,
            map_result: data.mapResult
        }) : null);
    });

    newSocket.on('match_details_update', (updatedMatch: Match) => {
        setMatch(prev => prev ? ({ ...prev, ...updatedMatch }) : updatedMatch);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [id, navigate]);

  // Scroll RCON log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rconLog]);

  const isAdmin = user?.id === match?.user_id;
  const isLocked = match?.status !== 'PENDING';

  const handleJoin = async (team: 'TEAM1' | 'TEAM2' | 'SPECTATOR' | 'WAITING') => {
    if (!match || !user) return;
    if (isLocked || isJoining) return; // Chặn nếu đang join
    
    setIsJoining(true);
    try {
      await api.post(`/api/matches/${match.id}/join`, { team });
    } catch (error: any) {
      alert(error.response?.data?.message || "Lỗi join team");
    } finally {
      // Delay một chút để tránh spam click liên tục ngay cả khi API trả về nhanh
      setTimeout(() => setIsJoining(false), 500);
    }
  };

  const handleLeave = async () => {
    if (!match) return;
    if (isLocked) {
        alert("Trận đấu đang diễn ra, bạn không thể rời phòng lúc này.");
        return;
    }
    try {
      await api.post(`/api/matches/${match.id}/leave`);
      navigate('/');
    } catch (error) { console.error(error); }
  };

  const handleStartMatch = async () => {
    if (!match) return;
    try {
        await api.post(`/api/matches/${match.id}/start`);
    } catch (error: any) {
        alert(error.response?.data?.message || "Lỗi khởi động");
    }
  };

  const handleSendRcon = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!rconCommand.trim() || !match) return;
      const cmd = rconCommand;
      setRconCommand('');
      setSendingRcon(true);
      setRconLog(prev => [...prev, `> ${cmd}`]);
      try {
          const res = await api.post(`/api/matches/${match.id}/rcon`, { command: cmd });
          const responseLines = res.data.response ? res.data.response.split('\n') : ['(No response)'];
          setRconLog(prev => [...prev, ...responseLines]);
      } catch (error: any) {
          setRconLog(prev => [...prev, `Error: ${error.response?.data?.message || error.message}`]);
      } finally {
          setSendingRcon(false);
      }
  };

  if (loading || !match) return <div className="text-white text-center mt-20">Đang tải...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      {/* Header Info */}
      <div className="flex justify-between items-start mb-4 bg-slate-900/50 p-6 rounded-xl border border-slate-800 backdrop-blur">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{match.display_name}</h1>
            <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded font-mono">{match.series_type}</span>
            <span className={clsx("text-xs px-2 py-1 rounded font-bold uppercase", 
                match.status === 'LIVE' ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"
            )}>
              {match.status}
            </span>
          </div>
          <p className="text-slate-400">Host: <span className="text-white font-medium">{match.admin_name}</span></p>
        </div>
        
        {!isLocked && (
            <button onClick={handleLeave} className="bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-400 px-4 py-2 rounded border border-slate-700 font-medium flex items-center gap-2 transition-colors">
                <LogOut size={18} /> Rời phòng
            </button>
        )}
      </div>

      {/* RCON Console (Only Admin) */}
      {isAdmin && match.status !== 'FINISHED' && (
        <div className="mb-8 bg-black/40 border border-slate-700 rounded-lg overflow-hidden font-mono text-sm">
            <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
                <span className="text-orange-400 font-bold flex items-center gap-2"><Terminal size={14}/> SERVER CONSOLE (RCON)</span>
                <span className="text-xs text-slate-500">Chỉ Admin nhìn thấy</span>
            </div>
            <div className="h-32 overflow-y-auto p-4 space-y-1 text-slate-300">
                {rconLog.length === 0 && <span className="text-slate-600 italic">Nhập lệnh để gửi tới server... (VD: status, maps, pause)</span>}
                {rconLog.map((line, i) => (
                    <div key={i} className={line.startsWith('>') ? "text-yellow-500 font-bold" : (line.startsWith('Error') ? "text-red-400" : "")}>{line}</div>
                ))}
                <div ref={logEndRef} />
            </div>
            <form onSubmit={handleSendRcon} className="flex border-t border-slate-700">
                <input 
                    type="text" 
                    value={rconCommand}
                    onChange={(e) => setRconCommand(e.target.value)}
                    placeholder="Nhập lệnh RCON..."
                    className="flex-1 bg-transparent px-4 py-3 text-white focus:outline-none placeholder:text-slate-600"
                />
                <button type="submit" disabled={sendingRcon} className="bg-slate-800 hover:bg-orange-600 text-white px-6 py-2 transition-colors disabled:opacity-50 border-l border-slate-700">
                    {sendingRcon ? '...' : <Send size={16}/>}
                </button>
            </form>
        </div>
      )}

      {/* Render Child Component (Lobby or MapStats) */}
      <Outlet context={{ match, participants, socket, mapPool, isAdmin, isLocked, handleJoin, handleStartMatch } satisfies MatchContextType} />
    </div>
  );
}
