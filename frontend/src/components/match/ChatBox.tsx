import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, ChevronDown, ChevronUp, Users, Globe } from 'lucide-react';
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
    const [isOpen, setIsOpen] = useState(true);
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
            if (!isOpen) setUnreadCount(prev => prev + 1);
        };

        socket.on('new_chat_message', handleNewMessage);
        return () => {
            socket.off('new_chat_message', handleNewMessage);
        };
    }, [socket, isOpen]);

    // Auto scroll
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

    return (
        <div className={clsx(
            "fixed bottom-4 right-4 z-50 flex flex-col transition-all duration-300 shadow-2xl rounded-t-lg overflow-hidden border border-slate-700 bg-slate-900 w-80 md:w-96",
            isOpen ? "h-[450px]" : "h-12"
        )}>
            {/* Header (Toggle) */}
            <div 
                className="bg-slate-800 p-3 flex justify-between items-center cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-orange-500"/>
                    <span className="font-bold text-white text-sm">Match Chat</span>
                    {unreadCount > 0 && (
                        <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronDown size={18} className="text-slate-400"/> : <ChevronUp size={18} className="text-slate-400"/>}
            </div>

            {/* Body */}
            <div className={clsx("flex-1 flex flex-col bg-slate-900/95 backdrop-blur", !isOpen && "hidden")}>
                
                {/* Tabs */}
                <div className="flex text-[10px] font-bold border-b border-slate-700">
                    <button 
                        onClick={() => setActiveTab('GLOBAL')}
                        className={clsx("flex-1 py-2 flex items-center justify-center gap-1 hover:bg-slate-800 transition-colors", 
                            activeTab === 'GLOBAL' ? "text-orange-400 border-b-2 border-orange-400 bg-slate-800/50" : "text-slate-500"
                        )}
                    >
                        <Globe size={12}/> GLOBAL
                    </button>
                    
                    {canChatTeam ? (
                        <button 
                            onClick={() => setActiveTab('TEAM')}
                            className={clsx("flex-1 py-2 flex items-center justify-center gap-1 hover:bg-slate-800 transition-colors", 
                                activeTab === 'TEAM' ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/50" : "text-slate-500"
                            )}
                        >
                            <Users size={12}/> {mySlot?.team}
                        </button>
                    ) : (
                        <div className="flex-1 py-2 flex items-center justify-center gap-1 text-slate-700 cursor-not-allowed select-none bg-slate-950" title="Chat Team chỉ mở khi vào trận">
                            <Users size={12}/> TEAM (Locked)
                        </div>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {displayedMessages.map((msg, i) => {
                        const isMe = msg.user_id === user?.id;
                        const currentTeam = getPlayerTeam(msg.user_id) || msg.sender_team;

                        return (
                            <div key={i} className={clsx("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    {!isMe && <img src={msg.avatar_url} className="w-4 h-4 rounded-full" alt=""/>}
                                    <span className={clsx("text-[10px] font-bold", 
                                        currentTeam === 'TEAM1' ? "text-orange-400" : (currentTeam === 'TEAM2' ? "text-blue-400" : "text-slate-400")
                                    )}>
                                        {msg.username}
                                    </span>
                                </div>
                                <div className={clsx("px-3 py-1.5 rounded-lg max-w-[90%] break-words shadow-sm text-xs md:text-sm", 
                                    isMe 
                                        ? "bg-orange-600 text-white rounded-br-none" 
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
                <form onSubmit={handleSend} className="p-2 border-t border-slate-700 flex gap-2 bg-slate-800/30">
                    <input 
                        className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500 placeholder:text-slate-500"
                        placeholder={`Gửi tới ${activeTab === 'GLOBAL' ? 'Global' : 'Team'}...`}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                    />
                    <button type="submit" disabled={!input.trim()} className="text-slate-400 hover:text-orange-500 transition-colors p-1">
                        <Send size={16}/>
                    </button>
                </form>
            </div>
        </div>
    );
}
