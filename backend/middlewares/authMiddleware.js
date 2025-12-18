const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Client gửi: "Bearer eyJhbGciOi..." -> Lấy phần sau chữ Bearer
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Không tìm thấy Token" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
        }

        // Token ngon -> Lưu thông tin giải mã vào req.user để controller dùng
        req.user = decoded;
        next();
    });
};

const verifyTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            req.user = null; // Token lỗi coi như guest
        } else {
            req.user = decoded;
        }
        next();
    });
};

const isAdmin = (req, res, next) => {
    // req.user đã có từ verifyToken
    // role: 1 -> Admin, 0 -> User thường
    if (req.user && req.user.role === 1) {
        next();
    } else {
        return res.status(403).json({ message: "Quyền hạn không đủ (Admin only)" });
    }
};

module.exports = { verifyToken, verifyTokenOptional, isAdmin };