const express = require('express');
const matchController = require('../controllers/matchController');
const { verifyToken, verifyTokenOptional, isAdmin } = require('../middlewares/authMiddleware');
const router = express.Router();

// --- CÁC ROUTE CỤ THỂ PHẢI ĐẶT LÊN TRÊN CÙNG ---

// 1. Route lấy danh sách Server
router.get('/servers', verifyToken, matchController.getServers);

// 2. Route lấy Map Pool (QUAN TRỌNG: Phải đặt trước /:id)
router.get('/maps/active', matchController.getMapPool);

// 3. Route lấy danh sách tất cả trận đấu
router.get('/', matchController.getAllMatches);

// 4. Route tạo trận (Admin Only)
router.post('/create', verifyToken, isAdmin, matchController.createMatch);

// --- CÁC ROUTE CÓ PARAM /:id PHẢI ĐẶT DƯỚI CÙNG ---

// Lấy thông tin chi tiết một match
router.get('/:id', matchController.getMatchDetail);

// Lấy lịch sử chat (Guest xem được)
router.get('/:id/chat', verifyTokenOptional, matchController.getMatchChat);

// Cập nhật cài đặt Match
router.put('/:id/settings', verifyToken, isAdmin, matchController.updateSettings);

// Lấy thống kê chi tiết trận đấu (Post-Match)
router.get('/:id/stats', matchController.getMatchStats);

// Captain Pick
router.post('/:id/captains', verifyToken, isAdmin, matchController.setCaptains);
router.post('/:id/pick', verifyToken, matchController.pickPlayer);

// Join Slot (Team1/Team2/Spectator)
router.post('/:id/join', verifyToken, matchController.joinSlot);
router.post('/:id/leave', verifyToken, matchController.leaveMatch);
router.post('/:id/veto', verifyToken, matchController.vetoMap);
router.post('/:id/start', verifyToken, matchController.startMatch);
router.post('/:id/cancel', verifyToken, matchController.cancelMatch); // Route hủy trận

router.get('/:id/config', matchController.getMatchConfig);
router.post('/:id/rcon', verifyToken, matchController.sendMatchRcon);

module.exports = router;