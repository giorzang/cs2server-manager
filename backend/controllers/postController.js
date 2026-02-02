const Post = require('../models/Post');
const socketManager = require('../socket/socketManager');

exports.createPost = async (req, res) => {
    try {
        const { title, content } = req.body;
        const author_id = req.user.uid;

        if (!title || !content) return res.status(400).json({ message: "Thiếu tiêu đề hoặc nội dung" });

        const id = await Post.create({ title, content, author_id });

        // Emit real-time update
        const newPost = await Post.findByIdWithDetails(id);
        const io = socketManager.getIo();
        io.to('news_room').emit('new_post', newPost);

        res.status(201).json({ message: "Đăng bài thành công", id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server" });
    }
};

exports.getAllPosts = async (req, res) => {
    try {
        const posts = await Post.findAll();
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
};

exports.deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.findById(id);

        if (!post) {
            return res.status(404).json({ message: "Bài viết không tồn tại" });
        }

        // Check if user is author or admin
        if (post.author_id !== req.user.uid && req.user.role !== 1) {
            return res.status(403).json({ message: "Bạn không có quyền xóa bài viết này" });
        }

        await Post.delete(id);

        // Emit real-time update
        const io = socketManager.getIo();
        io.to('news_room').emit('delete_post', { id: parseInt(id) });

        res.json({ message: "Đã xóa bài viết" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
};

exports.updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ message: "Thiếu dữ liệu" });

        const post = await Post.findById(id);

        if (!post) {
            return res.status(404).json({ message: "Bài viết không tồn tại" });
        }

        // Check if user is author or admin
        if (post.author_id !== req.user.uid && req.user.role !== 1) {
            return res.status(403).json({ message: "Bạn không có quyền sửa bài viết này" });
        }

        await Post.update(id, title, content);

        // Emit real-time update
        const updatedPost = await Post.findByIdWithDetails(id);
        const io = socketManager.getIo();
        io.to('news_room').emit('update_post', updatedPost);

        res.json({ message: "Cập nhật thành công" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server" });
    }
};
