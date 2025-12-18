const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

router.get('/', postController.getAllPosts);
router.post('/create', verifyToken, isAdmin, postController.createPost);
router.put('/:id', verifyToken, isAdmin, postController.updatePost);
router.delete('/:id', verifyToken, isAdmin, postController.deletePost);

module.exports = router;
