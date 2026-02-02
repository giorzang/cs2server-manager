const Comment = require('../models/Comment');
const socketManager = require('../socket/socketManager');

exports.createComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const author_id = req.user.uid;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: "Nội dung bình luận không được để trống" });
        }

        const id = await Comment.create({ content: content.trim(), post_id: postId, author_id });

        // Get full comment with user info for real-time emit
        const comments = await Comment.findByPostId(postId);
        const newComment = comments.find(c => c.id === id);

        // Emit real-time update
        const io = socketManager.getIo();
        io.to('news_room').emit('new_comment', {
            postId: parseInt(postId),
            comment: newComment
        });

        res.status(201).json({ message: "Bình luận thành công", id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server" });
    }
};

exports.getCommentsByPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const comments = await Comment.findByPostId(postId);
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        const comment = await Comment.findById(id);

        if (!comment) {
            return res.status(404).json({ message: "Bình luận không tồn tại" });
        }

        // Check if user is author or admin
        if (comment.author_id !== req.user.uid && req.user.role !== 1) {
            return res.status(403).json({ message: "Bạn không có quyền xóa bình luận này" });
        }

        const postId = comment.post_id;
        await Comment.delete(id);

        // Emit real-time update
        const io = socketManager.getIo();
        io.to('news_room').emit('delete_comment', {
            postId: postId,
            commentId: parseInt(id)
        });

        res.json({ message: "Đã xóa bình luận" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
};
