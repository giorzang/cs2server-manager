import { useEffect, useState, useRef } from 'react';
import { Newspaper, Plus, Trash2, Calendar, Bold, Italic, Link as LinkIcon, Image as ImageIcon, Eye, Code, List, Pen, Edit2, MessageCircle, Send } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import type { Post, Comment } from '../types/common';

// Markdown Libraries
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TextareaAutosize from 'react-textarea-autosize';

export default function Dashboard() {
    const { user } = useAuthStore();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    // Create/Edit Post State
    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [creating, setCreating] = useState(false);
    const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Comment State
    const [comments, setComments] = useState<Record<number, Comment[]>>({});
    const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});
    const [newComment, setNewComment] = useState<Record<number, string>>({});
    const [loadingComments, setLoadingComments] = useState<Record<number, boolean>>({});

    // Animation state for new posts
    const [animatingPosts, setAnimatingPosts] = useState<Set<number>>(new Set());

    const fetchPosts = () => {
        setLoading(true);
        api.get('/api/posts')
            .then(res => setPosts(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const fetchComments = async (postId: number) => {
        setLoadingComments(prev => ({ ...prev, [postId]: true }));
        try {
            const res = await api.get(`/api/comments/${postId}`);
            setComments(prev => ({ ...prev, [postId]: res.data }));
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingComments(prev => ({ ...prev, [postId]: false }));
        }
    };

    const toggleComments = (postId: number) => {
        const isExpanded = expandedComments[postId];
        setExpandedComments(prev => ({ ...prev, [postId]: !isExpanded }));
        if (!isExpanded && !comments[postId]) {
            fetchComments(postId);
        }
    };

    // Socket connection effect
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        const newSocket = io('/', {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('📡 Connected to news socket');
            newSocket.emit('join_news_room');
        });

        // Real-time post events
        newSocket.on('new_post', (post: Post) => {
            setPosts(prev => {
                // Prevent duplicate if it's our own post
                if (prev.some(p => p.id === post.id)) return prev;
                // Add animation flag
                setAnimatingPosts(animSet => new Set(animSet).add(post.id));
                setTimeout(() => {
                    setAnimatingPosts(animSet => {
                        const newSet = new Set(animSet);
                        newSet.delete(post.id);
                        return newSet;
                    });
                }, 500);
                return [post, ...prev];
            });
        });

        newSocket.on('update_post', (updatedPost: Post) => {
            setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
        });

        newSocket.on('delete_post', ({ id }: { id: number }) => {
            setPosts(prev => prev.filter(p => p.id !== id));
        });

        // Real-time comment events
        newSocket.on('new_comment', ({ postId, comment }: { postId: number; comment: Comment }) => {
            // Update comment count on post
            setPosts(prev => prev.map(p =>
                p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p
            ));
            // If comments are expanded, add to list
            setComments(prev => {
                if (!prev[postId]) return prev;
                if (prev[postId].some(c => c.id === comment.id)) return prev;
                return { ...prev, [postId]: [...prev[postId], comment] };
            });
        });

        newSocket.on('delete_comment', ({ postId, commentId }: { postId: number; commentId: number }) => {
            // Update comment count on post
            setPosts(prev => prev.map(p =>
                p.id === postId ? { ...p, comment_count: Math.max((p.comment_count || 1) - 1, 0) } : p
            ));
            // Remove from comments list
            setComments(prev => {
                if (!prev[postId]) return prev;
                return { ...prev, [postId]: prev[postId].filter(c => c.id !== commentId) };
            });
        });

        return () => {
            newSocket.emit('leave_news_room');
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        fetchPosts();
    }, []);

    const handleOpenCreate = () => {
        setEditId(null);
        setNewTitle('');
        setNewContent('');
        setShowCreate(true);
    };

    const handleOpenEdit = (post: Post) => {
        setEditId(post.id);
        setNewTitle(post.title);
        setNewContent(post.content);
        setShowCreate(true);
    };

    const handleSavePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !newContent.trim()) return;

        setCreating(true);
        try {
            if (editId) {
                await api.put(`/api/posts/${editId}`, { title: newTitle, content: newContent });
            } else {
                await api.post('/api/posts/create', { title: newTitle, content: newContent });
            }
            setShowCreate(false);
            setNewTitle('');
            setNewContent('');
            setEditId(null);
            // No need to fetchPosts - socket will handle it
        } catch (error: any) {
            alert(error.response?.data?.message || "Lỗi lưu bài");
        } finally {
            setCreating(false);
        }
    };

    const handleDeletePost = async (id: number) => {
        if (!confirm("Bạn có chắc muốn xóa bài này?")) return;
        try {
            await api.delete(`/api/posts/${id}`);
            // No need to fetchPosts - socket will handle it
        } catch (error: any) {
            alert(error.response?.data?.message || "Lỗi xóa bài");
        }
    };

    const handleAddComment = async (postId: number) => {
        const content = newComment[postId]?.trim();
        if (!content) return;

        try {
            await api.post(`/api/comments/${postId}`, { content });
            setNewComment(prev => ({ ...prev, [postId]: '' }));
            // No need to refetch - socket will handle it
        } catch (error: any) {
            alert(error.response?.data?.message || "Lỗi thêm bình luận");
        }
    };

    const handleDeleteComment = async (commentId: number, _postId: number) => {
        if (!confirm("Xóa bình luận này?")) return;
        try {
            await api.delete(`/api/comments/${commentId}`);
            // No need to refetch - socket will handle it
        } catch (error: any) {
            alert(error.response?.data?.message || "Lỗi xóa bình luận");
        }
    };

    const canModifyPost = (post: Post) => {
        if (!user) return false;
        return user.id === post.author_id || user.is_admin === 1;
    };

    const canModifyComment = (comment: Comment) => {
        if (!user) return false;
        return user.id === comment.author_id || user.is_admin === 1;
    };

    const applyMarkdown = (syntax: string, placeholder?: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        let newText = value.substring(0, start) + syntax + value.substring(end);
        let cursorOffset = start + syntax.length;

        if (placeholder) {
            newText = value.substring(0, start) + syntax.replace(placeholder, placeholder) + value.substring(end);
            cursorOffset = start + syntax.indexOf(placeholder) + placeholder.length;
        }

        setNewContent(newText);
        setTimeout(() => {
            if (textarea) {
                textarea.focus();
                textarea.selectionStart = textarea.selectionEnd = cursorOffset;
            }
        }, 0);
    };

    const handleInsertImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await api.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const imageUrl = res.data.url;
            applyMarkdown(`![${file.name}](${imageUrl})`, file.name);
        } catch (error: any) {
            alert("Lỗi upload ảnh: " + (error.response?.data?.message || error.message));
        }
    };

    const handleInsertLink = () => {
        const linkUrl = prompt("Nhập URL của liên kết:");
        if (linkUrl) {
            applyMarkdown(`[Link Text](${linkUrl})`, "Link Text");
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 text-white max-w-4xl">
            {/* CSS for animations */}
            <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in {
          animation: slideIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Newspaper className="text-blue-500" /> Tin Tức
                    </h1>
                    <p className="text-slate-400 mt-1">Cập nhật thông tin mới nhất từ cộng đồng</p>
                </div>

                {user && (
                    <button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2 transition-colors">
                        <Plus size={20} /> Đăng Bài
                    </button>
                )}
            </div>

            {showCreate && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <h3 className="text-xl font-bold mb-4 text-white">{editId ? "Chỉnh sửa bài viết" : "Đăng bài viết mới"}</h3>
                        <form onSubmit={handleSavePost} className="space-y-4 flex-1 flex flex-col overflow-hidden">
                            <input
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-blue-500 outline-none font-bold shrink-0"
                                placeholder="Tiêu đề bài viết..."
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                autoFocus
                            />

                            <div className="flex-1 flex flex-col border border-slate-700 rounded overflow-hidden min-h-0">
                                <div className="bg-slate-800 p-2 border-b border-slate-700 flex gap-2 shrink-0">
                                    <button type="button" onClick={() => applyMarkdown('**text**', 'text')} className="p-1 rounded hover:bg-slate-700 text-slate-300"><Bold size={18} /></button>
                                    <button type="button" onClick={() => applyMarkdown('*text*', 'text')} className="p-1 rounded hover:bg-slate-700 text-slate-300"><Italic size={18} /></button>
                                    <button type="button" onClick={handleInsertLink} className="p-1 rounded hover:bg-slate-700 text-slate-300"><LinkIcon size={18} /></button>
                                    <button type="button" onClick={handleInsertImageClick} className="p-1 rounded hover:bg-slate-700 text-slate-300"><ImageIcon size={18} /></button>
                                    <button type="button" onClick={() => applyMarkdown('`code`', 'code')} className="p-1 rounded hover:bg-slate-700 text-slate-300"><Code size={18} /></button>
                                    <button type="button" onClick={() => applyMarkdown('- List item\n- List item', 'List item')} className="p-1 rounded hover:bg-slate-700 text-slate-300"><List size={18} /></button>
                                    <div className="flex-grow"></div>
                                    <button type="button" onClick={() => setEditorTab('write')} className={`p-1 rounded ${editorTab === 'write' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}><Pen size={18} /></button>
                                    <button type="button" onClick={() => setEditorTab('preview')} className={`p-1 rounded ${editorTab === 'preview' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}><Eye size={18} /></button>
                                </div>

                                {editorTab === 'write' ? (
                                    <div className="flex-1 overflow-y-auto bg-slate-950">
                                        <TextareaAutosize
                                            ref={textareaRef}
                                            className="w-full bg-slate-950 p-3 text-white focus:outline-none resize-none min-h-full"
                                            placeholder="Nội dung bài viết (hỗ trợ Markdown)..."
                                            value={newContent}
                                            onChange={e => setNewContent(e.target.value)}
                                            minRows={15}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-1 bg-slate-950 p-3 overflow-y-auto prose prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {newContent || "Xem trước nội dung Markdown của bạn tại đây."}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 shrink-0 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-400 hover:text-white">Hủy</button>
                                <button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold">
                                    {creating ? 'Đang lưu...' : (editId ? 'Cập Nhật' : 'Đăng Ngay')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* POST LIST */}
            {loading ? (
                <div className="text-center py-10 text-slate-500">Đang tải tin tức...</div>
            ) : (
                <div className="space-y-6">
                    {posts.map(post => (
                        <div
                            key={post.id}
                            className={`bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-blue-500/30 transition-all group ${animatingPosts.has(post.id) ? 'animate-slide-in' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <img src={post.avatar_url} alt={post.username} className="w-10 h-10 rounded-full border border-slate-600" />
                                    <div>
                                        <span className="font-bold text-slate-200 block">{post.username}</span>
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <Calendar size={12} /> {new Date(post.created_at).toLocaleDateString()} lúc {new Date(post.created_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                                {canModifyPost(post) && (
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenEdit(post)} className="text-slate-500 hover:text-white p-2 bg-slate-900 rounded border border-slate-700 hover:border-slate-500" title="Sửa bài">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDeletePost(post.id)} className="text-slate-500 hover:text-red-500 p-2 bg-slate-900 rounded border border-slate-700 hover:border-red-500" title="Xóa bài">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-3">{post.title}</h2>
                            <div className="text-slate-300 prose prose-invert max-w-none prose-img:rounded-lg prose-a:text-blue-400">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {post.content}
                                </ReactMarkdown>
                            </div>

                            {/* Comment Section */}
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <button
                                    onClick={() => toggleComments(post.id)}
                                    className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors text-sm"
                                >
                                    <MessageCircle size={16} />
                                    {expandedComments[post.id] ? 'Ẩn bình luận' : 'Xem bình luận'}
                                    <span className="bg-slate-700 px-2 py-0.5 rounded-full text-xs">
                                        {post.comment_count || 0}
                                    </span>
                                </button>

                                {expandedComments[post.id] && (
                                    <div className="mt-4 space-y-3 animate-fade-in">
                                        {loadingComments[post.id] ? (
                                            <div className="text-slate-500 text-sm">Đang tải bình luận...</div>
                                        ) : (
                                            <>
                                                {comments[post.id]?.map(comment => (
                                                    <div key={comment.id} className="flex gap-3 bg-slate-900/50 p-3 rounded-lg animate-fade-in">
                                                        <img src={comment.avatar_url} alt={comment.username} className="w-8 h-8 rounded-full" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-sm text-slate-200">{comment.username}</span>
                                                                    <span className="text-xs text-slate-500">
                                                                        {new Date(comment.created_at).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                                {canModifyComment(comment) && (
                                                                    <button
                                                                        onClick={() => handleDeleteComment(comment.id, post.id)}
                                                                        className="text-slate-500 hover:text-red-500 p-1"
                                                                        title="Xóa bình luận"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className="text-slate-300 text-sm mt-1">{comment.content}</p>
                                                        </div>
                                                    </div>
                                                ))}

                                                {comments[post.id]?.length === 0 && (
                                                    <div className="text-slate-500 text-sm">Chưa có bình luận nào.</div>
                                                )}

                                                {/* Add Comment Form */}
                                                {user && (
                                                    <div className="flex gap-2 mt-3">
                                                        <input
                                                            type="text"
                                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                                            placeholder="Viết bình luận..."
                                                            value={newComment[post.id] || ''}
                                                            onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                            onKeyDown={e => e.key === 'Enter' && handleAddComment(post.id)}
                                                        />
                                                        <button
                                                            onClick={() => handleAddComment(post.id)}
                                                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors"
                                                            title="Gửi bình luận"
                                                        >
                                                            <Send size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {posts.length === 0 && (
                        <div className="text-center py-16 border border-dashed border-slate-800 rounded-lg text-slate-500">
                            <Newspaper size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Chưa có tin tức nào.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
