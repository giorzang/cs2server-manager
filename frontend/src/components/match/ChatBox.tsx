import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, ChevronDown, Users, Globe } from 'lucide-react';
import api from '../../services/api';
import clsx from 'clsx';
import { Socket } from 'socket.io-client';
import { useAuthStore } from '../../store/useAuthStore';
import type { Participant } from '../../types/common';

interface ChatMessage {
    id: number;
    user_id: string;
    username: string;
    avatar_url: string;
    message: string;
    scope: 'GLOBAL' | 'TEAM1' | 'TEAM2' | 'SPECTATOR';
    created_at: string;
    sender_team?: string;
}

interface Props {
    matchId: number;
    socket: Socket | null;
    mySlot?: Participant;
    matchStatus: string;
    participants: Participant[];
}

export default function ChatBox({ matchId, socket, mySlot, matchStatus, participants }: Props) {
    const { user } = useAuthStore();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [activeTab, setActiveTab] = useState<'GLOBAL' | 'TEAM'>('GLOBAL');
    const [isOpen, setIsOpen] = useState(false); // Default closed (Bubble mode)
    const bottomRef = useRef<HTMLDivElement>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    // Load history
    useEffect(() => {
        api.get(`/api/matches/${matchId}/chat`)
            .then(res => setMessages(res.data))
            .catch(console.error);
    }, [matchId]);

    // Socket Listener
    useEffect(() => {
        if (!socket) return;
        
        const handleNewMessage = (msg: any) => {
            setMessages(prev => [...prev, msg]);
            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            }
        };

        socket.on('new_chat_message', handleNewMessage);
        return () => {
            socket.off('new_chat_message', handleNewMessage);
        };
    }, [socket, isOpen]);

    // Auto scroll & Reset unread
    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            setUnreadCount(0);
        }
    }, [messages, activeTab, isOpen]);

    // Logic kiểm tra quyền Chat Team
    const canChatTeam = mySlot && ['TEAM1', 'TEAM2', 'SPECTATOR'].includes(mySlot.team) && matchStatus !== 'PENDING';

    useEffect(() => {
        if (!canChatTeam && activeTab === 'TEAM') {
            setActiveTab('GLOBAL');
        }
    }, [canChatTeam, activeTab]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || !socket) return;

        socket.emit('chat_message', {
            matchId,
            message: input,
            scope: activeTab === 'TEAM' ? 'TEAM' : 'GLOBAL'
        });
        setInput('');
    };

    const getPlayerTeam = (userId: string) => {
        const participant = participants.find(p => p.user_id === userId);
        return participant ? participant.team : null;
    };

    const displayedMessages = messages.filter(m => {
        if (activeTab === 'GLOBAL') return m.scope === 'GLOBAL';
        if (activeTab === 'TEAM') return m.scope !== 'GLOBAL';
        return true;
    });

    // RENDER: BUBBLE MODE (Collapsed)
    if (!isOpen) {
        return (
            <div 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-secondary hover:bg-secondary-hover rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all hover:scale-110 border border-slate-600 group"
                title="Mở Chat"
            >
                <MessageSquare size={24} className="text-accent group-hover:text-white transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold animate-bounce border-2 border-primary shadow-sm">
                        {unreadCount}
                    </span>
                )}
            </div>
        );
    }

    // RENDER: WINDOW MODE (Expanded)
    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 md:w-96 h-[450px] flex flex-col bg-secondary border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
            {/* Header (Toggle) */}
            <div 
                className="bg-slate-900/50 p-3 flex justify-between items-center border-b border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors shrink-0"
                onClick={() => setIsOpen(false)}
            >
                <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-accent"/>
                    <span className="font-bold text-white text-sm">Match Chat</span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                >
                    <ChevronDown size={20}/>
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col bg-secondary backdrop-blur min-h-0">
                
                {/* Tabs */}
                <div className="flex text-[10px] font-bold border-b border-slate-700 shrink-0">
                    <button 
                        onClick={() => setActiveTab('GLOBAL')}
                        className={clsx("flex-1 py-2 flex items-center justify-center gap-1 hover:bg-slate-700 transition-colors", 
                            activeTab === 'GLOBAL' ? "text-accent border-b-2 border-accent bg-slate-800/50" : "text-slate-500"
                        )}
                    >
                        <Globe size={12}/> GLOBAL
                    </button>
                    
                    {canChatTeam ? (
                        <button 
                            onClick={() => setActiveTab('TEAM')}
                            className={clsx("flex-1 py-2 flex items-center justify-center gap-1 hover:bg-slate-700 transition-colors", 
                                activeTab === 'TEAM' ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/50" : "text-slate-500"
                            )}
                        >
                            <Users size={12}/> {mySlot?.team}
                        </button>
                    ) : (
                        <div className="flex-1 py-2 flex items-center justify-center gap-1 text-slate-600 cursor-not-allowed select-none bg-slate-900" title="Chat Team chỉ mở khi vào trận">
                            <Users size={12}/> TEAM (Locked)
                        </div>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm scrollbar-thin scrollbar-thumb-secondary-hover scrollbar-track-transparent">
                    {displayedMessages.map((msg, i) => {
                        const isMe = msg.user_id === user?.id;
                        const currentTeam = getPlayerTeam(msg.user_id) || msg.sender_team;

                        return (
                            <div key={i} className={clsx("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <div className="flex items-center gap-1.5 mb-1 px-1">
                                    {!isMe && <img src={msg.avatar_url} className="w-4 h-4 rounded-full" alt=""/>}
                                    <span className={clsx("text-[10px] font-bold", 
                                        currentTeam === 'TEAM1' ? "text-orange-400" : (currentTeam === 'TEAM2' ? "text-blue-400" : "text-slate-400")
                                    )}>
                                        {msg.username}
                                    </span>
                                </div>
                                <div className={clsx("px-3 py-2 rounded-2xl max-w-[85%] break-words shadow-sm text-xs md:text-sm", 
                                    isMe 
                                        ? "bg-accent text-white rounded-br-none" 
                                        : "bg-slate-700 text-slate-200 rounded-bl-none"
                                )}>
                                    {msg.message}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-3 border-t border-slate-700 flex gap-2 bg-slate-900/30 shrink-0">
                    <input 
                        className="flex-1 bg-primary border border-slate-700 rounded-full px-4 py-2 text-white text-xs focus:outline-none focus:border-accent placeholder:text-slate-500 transition-colors"
                        placeholder={`Gửi tới ${activeTab === 'GLOBAL' ? 'Global' : 'Team'}...`}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                    />
                    <button type="submit" disabled={!input.trim()} className="bg-accent hover:bg-accent-hover disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full p-2 transition-colors flex items-center justify-center shadow-lg">
                        <Send size={16}/>
                    </button>
                </form>
            </div>
        </div>
    );
}
