const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

let io;

// Middleware xác thực Socket
const authMiddleware = (socket, next) => {
    const token = socket.handshake.auth.token;
    console.log(`🔌 Socket connecting... Token provided? ${!!token}`);
    
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                console.warn("❌ Socket Auth Verify Failed:", err.message);
                // Vẫn cho connect để debug, nhưng user = undefined
                next();
            } else {
                console.log("✅ Socket Auth Success. User:", decoded.uid);
                socket.user = decoded; // { uid, role }
                next();
            }
        });
    } else {
        console.log("ℹ️ Socket connecting as Guest (No Token)");
        next();
    }
};

exports.init = (server) => {
    io = socketIo(server, {
        cors: {
            origin: true, 
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.use(authMiddleware);

    io.on('connection', (socket) => {
        const userId = socket.user ? socket.user.uid : 'Guest';
        console.log(`✅ Socket connected: ${socket.id} (User: ${userId})`);

        socket.on('join_match_room', async (matchId) => {
            if (!matchId) return;
            
            // 1. Join Global Match Room
            const roomName = `match_${matchId}`;
            socket.join(roomName);
            console.log(`User ${userId} ---> Joined Room: ${roomName}`);

            // 2. Join Team Room (Nếu đã login và đã tham gia match)
            if (socket.user && socket.user.uid) {
                try {
                    const [rows] = await pool.execute(
                        'SELECT team FROM match_participants WHERE match_id = ? AND user_id = ?', 
                        [matchId, socket.user.uid]
                    );
                    if (rows.length > 0) {
                        const myTeam = rows[0].team; // 'TEAM1', 'TEAM2', 'SPECTATOR'
                        const teamRoom = `match_${matchId}_${myTeam}`;
                        socket.join(teamRoom);
                        console.log(`User ${userId} ---> Joined Team Room: ${teamRoom}`);
                    }
                } catch (e) { console.error("Error joining team room:", e); }
            }
        });

        // Xử lý gửi tin nhắn
        socket.on('chat_message', async (data) => {
            console.log(`📩 Received chat_message from ${socket.id}:`, data);
            
            // data: { matchId, message, scope: 'GLOBAL' | 'TEAM' }
            if (!socket.user || !socket.user.uid) {
                console.warn(`⚠️ Guest tried to chat (Socket User: ${JSON.stringify(socket.user)})`);
                return; // Chỉ user login mới được chat
            }
            
            const { matchId, message, scope } = data;
            const content = message?.trim();
            if (!content) return;

            try {
                // Lấy thông tin user (Avatar, Name) và Team hiện tại
                const [rows] = await pool.execute(`
                    SELECT p.team, u.username, u.avatar_url 
                    FROM match_participants p
                    JOIN users u ON p.user_id = u.id
                    WHERE p.match_id = ? AND p.user_id = ?
                `, [matchId, socket.user.uid]);

                if (rows.length === 0) {
                    console.warn(`⚠️ User ${socket.user.uid} not in match ${matchId} tried to chat`);
                    // return;  <-- Tạm thời comment dòng này để cho phép Admin (không join slot) chat test
                }

                // Nếu không join slot, giả lập thông tin user từ DB users (cho Admin chat)
                let participant;
                if (rows.length > 0) {
                    participant = rows[0];
                } else {
                    // Fallback for Admin testing: Fetch basic user info
                     const [uRows] = await pool.execute('SELECT username, avatar_url FROM users WHERE id = ?', [socket.user.uid]);
                     if (uRows.length > 0) {
                         participant = { ...uRows[0], team: 'SPECTATOR' }; // Mặc định Admin là Spec
                         console.log("ℹ️ User not in slot, chatting as Spectator (Admin/Test)");
                     } else {
                         return;
                     }
                }

                let targetScope = scope; // 'GLOBAL'
                
                // Nếu chat Team -> check team hợp lệ
                if (scope === 'TEAM') {
                    if (['TEAM1', 'TEAM2', 'SPECTATOR'].includes(participant.team)) {
                        targetScope = participant.team; // Ghi đè scope thành tên team cụ thể
                    } else {
                        targetScope = 'GLOBAL'; // Nếu đang WAITING thì chat GLOBAL luôn
                    }
                } else {
                    targetScope = 'GLOBAL';
                }

                // Lưu DB
                const [res] = await pool.execute(
                    'INSERT INTO match_chat (match_id, user_id, message, scope) VALUES (?, ?, ?, ?)',
                    [matchId, socket.user.uid, content, targetScope]
                );

                const msgPayload = {
                    id: res.insertId,
                    user_id: socket.user.uid,
                    username: participant.username,
                    avatar_url: participant.avatar_url,
                    team: participant.team, // Team của người gửi
                    message: content,
                    scope: targetScope, // 'GLOBAL', 'TEAM1', ...
                    created_at: new Date().toISOString(),
                    sender_team: participant.team // Thêm field này để frontend tô màu
                };

                // Emit
                if (targetScope === 'GLOBAL') {
                    io.to(`match_${matchId}`).emit('new_chat_message', msgPayload);
                } else {
                    // Chat Team -> Gửi cho room team VÀ người gửi (để chắc chắn hiển thị)
                    io.to(`match_${matchId}_${targetScope}`).emit('new_chat_message', msgPayload);
                    // Nếu socket người gửi chưa join room team (do bug nào đó), gửi riêng cho nó
                    socket.emit('new_chat_message', msgPayload);
                }

            } catch (err) {
                console.error("Chat Error:", err);
            }
        });

        socket.on('disconnect', () => {
            // console.log('Client disconnected');
        });
    });

    return io;
};

exports.getIo = () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
};
