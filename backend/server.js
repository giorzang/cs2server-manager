require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const http = require('http'); // Import module http của Node
const socketManager = require('./socket/socketManager'); // Import file vừa tạo

// Import các module đã tách
const passportConfig = require('./config/passport');
const authRoutes = require('./routes/authRoutes');
const matchRoutes = require('./routes/matchRoutes');
const matchzyRoutes = require('./routes/matchzyRoutes'); // Import MatchZy Routes
const userRoutes = require('./routes/userRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');
const postRoutes = require('./routes/postRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const path = require('path'); // Import path module

const app = express();

// Middleware cơ bản
// origin: true -> Cho phép mọi domain (reflect request origin) kết nối và gửi cookie/credentials
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Phục vụ file tĩnh (Uploads)
app.use(express.static(path.join(__dirname, 'public')));

// Session (Chỉ dùng tạm để passport thực hiện bắt tay OpenID)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Khởi tạo Passport
app.use(passport.initialize());
app.use(passport.session());
passportConfig(passport); // Nạp cấu hình từ file config/passport.js

// Đăng ký Routes
app.use('/auth', authRoutes); // Tất cả API bắt đầu bằng /auth
app.use('/api/matches', matchRoutes);
app.use('/api/matchzy', matchzyRoutes); // Đăng ký MatchZy Routes
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);

// --- SERVE FRONTEND (PRODUCTION) ---
// Phục vụ file tĩnh từ thư mục build của Frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Handle React Routing: Các request không phải API sẽ trả về index.html
// Express 5: Dùng Regex /.*/ để bắt tất cả
app.get(/.*/, (req, res) => {
    // Nếu request bắt đầu bằng /api hoặc /auth mà không khớp route nào ở trên -> Trả về 404 JSON
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
        return res.status(404).json({ message: "API Not Found" });
    }
    // Còn lại trả về React App
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
// -----------------------------------

// 1. Tạo HTTP Server từ Express App
const server = http.createServer(app);

// 2. Khởi tạo Socket.io gắn vào Server này
socketManager.init(server);

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});