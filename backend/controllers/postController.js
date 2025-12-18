const Post = require('../models/Post');

exports.createPost = async (req, res) => {
    try {
        const { title, content } = req.body;
        const author_id = req.user.uid;

        if (!title || !content) return res.status(400).json({ message: "Thiếu tiêu đề hoặc nội dung" });

        const id = await Post.create({ title, content, author_id });
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
        await Post.delete(id);
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

        await Post.update(id, title, content);
        res.json({ message: "Cập nhật thành công" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server" });
    }
};
