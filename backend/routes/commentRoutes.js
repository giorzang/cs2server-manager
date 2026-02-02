const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/:postId', commentController.getCommentsByPost);
router.post('/:postId', verifyToken, commentController.createComment);
router.delete('/:id', verifyToken, commentController.deleteComment);

module.exports = router;
