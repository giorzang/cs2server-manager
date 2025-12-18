import { useMemo, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Shield, Swords, Eye, Play, User as UserIcon, Gamepad2, Link as LinkIcon, Map as MapIcon, Copy, Terminal, Ban, Users, Crown, Plus, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';
import clsx from 'clsx';
import VetoBoard from './VetoBoard';
import MatchSettingsModal from './MatchSettingsModal';
import ChatBox from './ChatBox';
import type { Participant, MatchContextType } from '../../types/common';

export default function MatchLobby() {
    const { match, participants, mapPool, isAdmin, isLocked, handleJoin, handleStartMatch, socket } = useOutletContext<MatchContextType>();
    const { user } = useAuthStore();

    // Local state
    const [selectedCap1, setSelectedCap1] = useState('');
    const [selectedCap2, setSelectedCap2] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    // Phân loại người chơi
    const team1Players = useMemo(() => participants.filter(p => p.team === 'TEAM1'), [participants]);
    const team2Players = useMemo(() => participants.filter(p => p.team === 'TEAM2'), [participants]);
    const spectators = useMemo(() => participants.filter(p => p.team === 'SPECTATOR'), [participants]);
    const waitingPlayers = useMemo(() => participants.filter(p => p.team === 'WAITING'), [participants]);
    const mySlot = useMemo(() => participants.find(p => p.user_id === user?.id), [participants, user]);

    // Helpers
    const getPlayedMaps = () => {
        if (!match) return [];
        const vetoLog = Array.isArray(match.veto_log) ? match.veto_log : [];
        if (match.series_type === 'BO1') {
            return match.map_result ? [match.map_result] : [];
        }
        const picks = vetoLog.filter(l => l.action === 'PICK').map(l => l.map);
        if (match.map_result) picks.push(match.map_result);
        return picks;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Đã copy: " + text);
    };

    const handleCancelMatch = async () => {
        if (!confirm("⚠️ CẢNH BÁO: Bạn có chắc chắn muốn HỦY trận đấu này ngay lập tức?\nLệnh 'css_forceend' sẽ được gửi tới server và trạng thái trận đấu sẽ chuyển thành CANCELLED.")) return;
        try {
            await api.post(`/api/matches/${match.id}/cancel`);
        } catch (error: any) {
            alert("Lỗi: " + (error.response?.data?.message || error.message));
        }
    };

    const handleSetCaptains = async () => {
        if (!selectedCap1 || !selectedCap2) return alert("Vui lòng chọn 2 Captain từ danh sách chờ");
        try {
            await api.post(`/api/matches/${match.id}/captains`, { captain1Id: selectedCap1, captain2Id: selectedCap2 });
        } catch (err: any) { alert(err.response?.data?.message); }
    };

    const handlePickPlayer = async (targetId: string) => {
        try {
            await api.post(`/api/matches/${match.id}/pick`, { targetUserId: targetId });
        } catch (err: any) { alert(err.response?.data?.message); }
    };

    const PlayerSlot = ({ player, emptyText, onJoin, isCaptain }: { player?: Participant, emptyText?: string, onJoin?: () => void, isCaptain?: boolean }) => {
        if (player) {
            return (
                <div className={clsx("flex items-center gap-3 p-3 rounded border animate-in fade-in zoom-in duration-200 relative",
                    isCaptain ? "bg-yellow-900/30 border-yellow-600" : "bg-slate-800/80 border-slate-700"
                )}>
                    {isCaptain && <Crown size={14} className="absolute -top-2 -right-2 text-yellow-500 bg-slate-900 rounded-full" />}
                    <img src={player.avatar_url} className="w-8 h-8 rounded" alt="avatar" />
                    <span className={clsx("font-bold truncate", player.user_id === user?.id ? "text-orange-400" : "text-slate-200")}>
                        {player.username}
                    </span>
                </div>
            );
        }

        const isDisabled = isLocked || match.status === 'PICKING';

        return (
            <button
                onClick={onJoin}
                disabled={isDisabled}
                className={clsx(
                    "w-full flex items-center justify-center gap-2 border border-dashed p-3 rounded transition-all",
                    isDisabled
                        ? "border-slate-800 text-slate-700 cursor-not-allowed"
                        : "border-slate-700 text-slate-500 hover:text-white hover:border-slate-500 hover:bg-slate-800"
                )}
            >
                <UserIcon size={16} /> {match.status === 'PICKING' ? "Chờ Captain..." : (emptyText || "Trống")}
            </button>
        );
    };

    const renderCenterPanel = () => {
        if (match.status === 'PENDING' || match.status === 'PICKING') {
            let currentTurn = '';
            if (match.status === 'PICKING') {
                const t1 = team1Players.length;
                const t2 = team2Players.length;
                if (t1 === t2) currentTurn = 'TEAM1';
                else if (t1 > t2) currentTurn = 'TEAM2';
                else currentTurn = 'TEAM1';
            }
            const isMyTurn = (currentTurn === 'TEAM1' && match.captain1_id === user?.id) ||
                (currentTurn === 'TEAM2' && match.captain2_id === user?.id);
            const isCaptainMode = match.is_captain_mode === 1;

            return (
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex-1">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-slate-400 font-bold flex items-center gap-2 text-sm uppercase">
                                <Users size={16} /> Hàng chờ ({waitingPlayers.length})
                            </h3>
                            <div className="flex items-center gap-2">
                                {!mySlot && match.status !== 'PICKING' && (
                                    <button onClick={() => handleJoin('WAITING')} className="bg-orange-600 hover:bg-orange-500 text-white text-xs px-3 py-1 rounded">
                                        Tham gia
                                    </button>
                                )}
                                {isAdmin && match.status === 'PENDING' && (
                                    <button onClick={() => setShowSettings(true)} className="bg-slate-700 hover:bg-slate-600 text-slate-300 p-1 rounded" title="Cài đặt trận đấu">
                                        <Settings size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {match.status === 'PENDING' && isAdmin && isCaptainMode && (
                            <div className="mb-4 bg-slate-800 p-3 rounded border border-slate-700 animate-in fade-in">
                                <h4 className="text-white text-sm font-bold mb-2 flex items-center gap-2"><Crown size={14} className="text-yellow-500" /> Chọn Captain</h4>
                                {waitingPlayers.length < 2 ? (
                                    <p className="text-xs text-yellow-500">Cần ít nhất 2 người trong hàng chờ.</p>
                                ) : (
                                    <>
                                        <div className="flex gap-2 mb-2">
                                            <select className="bg-slate-900 text-white p-1 rounded text-sm w-1/2 border border-slate-600" onChange={e => setSelectedCap1(e.target.value)} value={selectedCap1}>
                                                <option value="">-- Cap 1 --</option>
                                                {waitingPlayers.map(p => <option key={p.user_id} value={p.user_id}>{p.username}</option>)}
                                            </select>
                                            <select className="bg-slate-900 text-white p-1 rounded text-sm w-1/2 border border-slate-600" onChange={e => setSelectedCap2(e.target.value)} value={selectedCap2}>
                                                <option value="">-- Cap 2 --</option>
                                                {waitingPlayers.filter(p => p.user_id !== selectedCap1).map(p => <option key={p.user_id} value={p.user_id}>{p.username}</option>)}
                                            </select>
                                        </div>
                                        <button onClick={handleSetCaptains} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded">
                                            Bắt đầu Pick
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {match.status === 'PENDING' && isAdmin && !isCaptainMode && (
                            <div className="border-t border-slate-800 pt-4 text-center">
                                <button
                                    onClick={handleStartMatch}
                                    className="bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded font-bold text-sm transition-colors flex items-center gap-2 mx-auto shadow-lg shadow-green-900/20 hover:scale-105"
                                >
                                    <Play size={18} /> {match.is_veto_enabled === 0 ? "BẮT ĐẦU NGAY (NO VETO)" : "BẮT ĐẦU VETO"}
                                </button>
                                {match.is_veto_enabled === 0 && (
                                    <p className="text-[10px] text-yellow-500 mt-2">Map: {mapPool.find(m => m.map_key === match.map_result)?.display_name || match.map_result || "Chưa chọn"}</p>
                                )}
                            </div>
                        )}

                        {match.status === 'PENDING' && isCaptainMode && !isAdmin && (
                            <p className="text-center text-xs text-blue-400 mt-4 animate-pulse">Chờ Admin chọn Captain...</p>
                        )}

                        {match.status === 'PICKING' && (
                            <div className="mb-4 text-center animate-in slide-in-from-top duration-300">
                                <div className={clsx("inline-block px-4 py-2 rounded-full text-sm font-bold border shadow-lg",
                                    currentTurn === 'TEAM1' ? "bg-orange-900/50 text-orange-400 border-orange-500 shadow-orange-900/20" : "bg-blue-900/50 text-blue-400 border-blue-500 shadow-blue-900/20"
                                )}>
                                    Lượt Pick: {currentTurn === 'TEAM1' ? match.team1_name : match.team2_name}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 max-h-[400px] overflow-y-auto mt-2">
                            {waitingPlayers.map(p => (
                                <div key={p.user_id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-600">
                                    <div className="flex items-center gap-3">
                                        <img src={p.avatar_url} className="w-8 h-8 rounded" />
                                        <span className="text-slate-200 font-medium">{p.username}</span>
                                    </div>
                                    {match.status === 'PICKING' && isMyTurn && (
                                        <button
                                            onClick={() => handlePickPlayer(p.user_id)}
                                            className="bg-green-600 hover:bg-green-500 text-white p-1.5 rounded shadow-lg animate-pulse" title="Pick người này">
                                            <Plus size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {waitingPlayers.length === 0 && <p className="text-slate-600 italic text-center py-8 text-sm">Danh sách trống</p>}
                        </div>
                    </div>

                    {/* Spectator Box */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                        <h3 className="text-slate-500 font-bold mb-2 flex items-center gap-2 text-xs uppercase"><Eye size={14} /> Spectators ({spectators.length})</h3>
                        <div className="flex flex-wrap gap-2">
                            {spectators.map(p => (
                                <img key={p.user_id} src={p.avatar_url} className="w-6 h-6 rounded-full border border-slate-700" title={p.username} />
                            ))}
                        </div>
                        <button
                            onClick={() => handleJoin('SPECTATOR')}
                            disabled={mySlot?.team === 'SPECTATOR' || isLocked}
                            className="w-full text-[10px] text-slate-500 hover:text-white border border-dashed border-slate-800 hover:border-slate-600 p-1 rounded mt-2 transition-colors"
                        >
                            Join Spec
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-6">
                <div className="text-center py-10">
                    <span className="text-6xl font-black text-slate-800 select-none font-mono">VS</span>
                </div>
            </div>
        );
    };

    const renderMatchStatus = () => {
        if (match.status === 'VETO') return <VetoBoard match={match} mySlot={mySlot} />;
        if (match.status === 'LIVE' || match.status === 'FINISHED') {
            const playedMaps = getPlayedMaps();
            const connectCmd = `connect ${match.ip}:${match.port}`;
            return (
                <div className="mb-8 space-y-6">
                    {match.status === 'LIVE' && (
                        <div className="bg-slate-900 border border-green-500/30 rounded-xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><Gamepad2 size={120} /></div>
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">LIVE</span>
                                        <h2 className="text-2xl font-bold text-white">Server Info</h2>
                                    </div>
                                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-slate-700 mt-2">
                                        <Terminal size={16} className="text-slate-500" />
                                        <code className="text-green-400 font-mono text-sm">{connectCmd}</code>
                                        <button onClick={() => copyToClipboard(connectCmd)} className="text-slate-400 hover:text-white" title="Copy"><Copy size={16} /></button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {isAdmin && (
                                        <button
                                            onClick={handleCancelMatch}
                                            className="bg-red-900/80 hover:bg-red-800 text-white px-4 py-3 rounded font-bold shadow-lg flex items-center gap-2 border border-red-700"
                                        >
                                            <Ban size={18} /> HỦY TRẬN
                                        </button>
                                    )}
                                    <a href={`steam://connect/${match.ip}:${match.port}`} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded font-bold shadow-lg flex items-center gap-2">
                                        <LinkIcon size={18} /> CONNECT
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><MapIcon /> Danh sách Map thi đấu</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {playedMaps.map((mapKey, idx) => {
                            const mapInfo = mapPool.find(m => m.map_key === mapKey);
                            const mapIndex = idx + 1;
                            return (
                                <Link to={`${mapIndex}`} key={mapKey} className="group relative h-32 rounded-lg overflow-hidden border border-slate-700 hover:border-orange-500 transition-all block">
                                    {mapInfo?.image_url && <img src={mapInfo.image_url} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />}
                                    <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center">
                                        <span className="text-slate-300 font-bold text-sm tracking-widest mb-1">MAP {mapIndex}</span>
                                        <span className="text-2xl font-black text-white uppercase">{mapInfo?.display_name || mapKey}</span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div>
            {showSettings && <MatchSettingsModal match={match} mapPool={mapPool} onClose={() => setShowSettings(false)} />}
            {renderMatchStatus()}

            {/* Main Lobby Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* TEAM 1 */}
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-orange-900/40 to-slate-900 border-l-4 border-orange-500 p-4 rounded-r">
                        <h2 className="text-xl font-bold text-orange-500 flex items-center gap-2">
                            <Swords size={20} /> {match.team1_name}
                        </h2>
                        <p className="text-xs text-slate-500">{team1Players.length}/5</p>
                    </div>
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <PlayerSlot
                                key={i}
                                player={team1Players[i]}
                                emptyText="Vào Team 1"
                                onJoin={() => handleJoin('TEAM1')}
                                isCaptain={team1Players[i]?.user_id === match.captain1_id}
                            />
                        ))}
                    </div>
                </div>

                {/* CENTER PANEL (Waiting List or VS) */}
                {renderCenterPanel()}

                {/* TEAM 2 */}
                <div className="space-y-4">
                    <div className="bg-gradient-to-l from-blue-900/40 to-slate-900 border-r-4 border-blue-500 p-4 rounded-l text-right">
                        <h2 className="text-xl font-bold text-blue-500 flex items-center gap-2 justify-end">
                            {match.team2_name} <Shield size={20} />
                        </h2>
                        <p className="text-xs text-slate-500">{team2Players.length}/5</p>
                    </div>
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <PlayerSlot
                                key={i}
                                player={team2Players[i]}
                                emptyText="Vào Team 2"
                                onJoin={() => handleJoin('TEAM2')}
                                isCaptain={team2Players[i]?.user_id === match.captain2_id}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <ChatBox matchId={match.id} socket={socket} mySlot={mySlot} matchStatus={match.status} participants={participants} />
        </div>
    );
}