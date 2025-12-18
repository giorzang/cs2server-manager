import { useEffect, useState, useRef } from 'react';
import { Newspaper, Plus, Trash2, Calendar, Bold, Italic, Link as LinkIcon, Image as ImageIcon, Eye, Code, List, Pen, Edit2 } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import type { Post } from '../types/common';

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
  const [editId, setEditId] = useState<number | null>(null); // ID bài viết đang sửa
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPosts = () => {
    setLoading(true);
    api.get('/api/posts')
      .then(res => setPosts(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

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
              // Update
              await api.put(`/api/posts/${editId}`, { title: newTitle, content: newContent });
          } else {
              // Create
              await api.post('/api/posts/create', { title: newTitle, content: newContent });
          }
          setShowCreate(false);
          setNewTitle('');
          setNewContent('');
          setEditId(null);
          fetchPosts();
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
          fetchPosts();
      } catch (error) { console.error(error); }
  };

  // ... (Keep Markdown helpers as is) ...
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
      e.target.value = ''; // Reset input

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
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
                <Newspaper className="text-blue-500" /> Tin Tức
            </h1>
            <p className="text-slate-400 mt-1">Cập nhật thông tin mới nhất từ cộng đồng</p>
        </div>
        
        {user?.is_admin === 1 && (
            <button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2 transition-colors">
                <Plus size={20}/> Đăng Bài
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
                          {/* Toolbar */}
                          <div className="bg-slate-800 p-2 border-b border-slate-700 flex gap-2 shrink-0">
                              <button type="button" onClick={() => applyMarkdown('**text**', 'text')} className="p-1 rounded hover:bg-slate-700 text-slate-300"><Bold size={18}/></button>
                              <button type="button" onClick={() => applyMarkdown('*text*', 'text')} className="p-1 rounded hover:bg-slate-700 text-slate-300"><Italic size={18}/></button>
                              <button type="button" onClick={handleInsertLink} className="p-1 rounded hover:bg-slate-700 text-slate-300"><LinkIcon size={18}/></button>
                              <button type="button" onClick={handleInsertImageClick} className="p-1 rounded hover:bg-slate-700 text-slate-300"><ImageIcon size={18}/></button>
                              <button type="button" onClick={() => applyMarkdown('`code`', 'code')} className="p-1 rounded hover:bg-slate-700 text-slate-300"><Code size={18}/></button>
                              <button type="button" onClick={() => applyMarkdown('- List item\n- List item', 'List item')} className="p-1 rounded hover:bg-slate-700 text-slate-300"><List size={18}/></button>
                              <div className="flex-grow"></div>
                              <button type="button" onClick={() => setEditorTab('write')} className={`p-1 rounded ${editorTab === 'write' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}><Pen size={18}/></button>
                              <button type="button" onClick={() => setEditorTab('preview')} className={`p-1 rounded ${editorTab === 'preview' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}><Eye size={18}/></button>
                          </div>

                          {/* Editor/Preview Area */}
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
                              {creating ? 'Lưu bài' : (editId ? 'Cập Nhật' : 'Đăng Ngay')}
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
                  <div key={post.id} className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-blue-500/30 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                              <img src={post.avatar_url} alt={post.username} className="w-10 h-10 rounded-full border border-slate-600"/>
                              <div>
                                  <span className="font-bold text-slate-200 block">{post.username}</span>
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                      <Calendar size={12}/> {new Date(post.created_at).toLocaleDateString()} lúc {new Date(post.created_at).toLocaleTimeString()}
                                  </span>
                              </div>
                          </div>
                          {user?.is_admin === 1 && (
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleOpenEdit(post)} className="text-slate-500 hover:text-white p-2 bg-slate-900 rounded border border-slate-700 hover:border-slate-500" title="Sửa bài">
                                      <Edit2 size={16}/>
                                  </button>
                                  <button onClick={() => handleDeletePost(post.id)} className="text-slate-500 hover:text-red-500 p-2 bg-slate-900 rounded border border-slate-700 hover:border-red-500" title="Xóa bài">
                                      <Trash2 size={16}/>
                                  </button>
                              </div>
                          )}
                      </div>
                      
                      <h2 className="text-2xl font-bold text-white mb-3">{post.title}</h2>
                      {/* Removed whitespace-pre-wrap to let Markdown render properly */}
                      <div className="text-slate-300 prose prose-invert max-w-none prose-img:rounded-lg prose-a:text-blue-400">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {post.content}
                          </ReactMarkdown>
                      </div>
                  </div>
              ))}
              
              {posts.length === 0 && (
                  <div className="text-center py-16 border border-dashed border-slate-800 rounded-lg text-slate-500">
                      <Newspaper size={48} className="mx-auto mb-4 opacity-50"/>
                      <p>Chưa có tin tức nào.</p>
                  </div>
              )}
          </div>
      )}
    </div>
  );
}
