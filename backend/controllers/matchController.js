const Match = require('../models/Match');
const Server = require('../models/Server');
const MatchParticipant = require('../models/MatchParticipant');
const Map = require('../models/Map');
const pool = require('../config/database');
const { getIo } = require('../socket/socketManager');
const { generateMatchzyJSON, sendRconCommand, processMatchzyStats } = require('../utils/matchzy');
const discord = require('../utils/discord');

// API: Tạo Match mới
exports.createMatch = async (req, res) => {
    try {
        const { display_name, team1_name, team2_name, server_id, series_type, is_veto_enabled, is_captain_mode, map_result, pre_selected_maps, game_mode } = req.body;
        const user_id = req.user.uid;

        if (!display_name || !team1_name || !team2_name || !server_id || !series_type) {
            return res.status(400).json({ message: "Vui lòng nhập đủ tên 2 team và chọn server" });
        }

        const server = await Server.findById(server_id);
        if (!server) {
            return res.status(404).json({ message: "Server không tồn tại" });
        }

        // Mặc định
        const vetoEnabled = (is_veto_enabled !== undefined) ? (is_veto_enabled ? 1 : 0) : 1;
        const captainMode = (is_captain_mode !== undefined) ? (is_captain_mode ? 1 : 0) : 0;

        let finalMapResult = map_result;
        let finalPreSelectedMaps = pre_selected_maps || [];

        // Validate "No Veto" logic
        if (vetoEnabled === 0) {
            if (!Array.isArray(finalPreSelectedMaps) || finalPreSelectedMaps.length === 0) {
                if (map_result) finalPreSelectedMaps = [map_result];
                else return res.status(400).json({ message: "Vui lòng chọn map khi tắt Veto" });
            }

            const requiredMaps = series_type === 'BO1' ? 1 : (series_type === 'BO3' ? 3 : 5);
            if (finalPreSelectedMaps.length !== requiredMaps) {
                return res.status(400).json({ message: `Vui lòng chọn đúng ${requiredMaps} map cho thể thức ${series_type}` });
            }
            finalMapResult = finalPreSelectedMaps[0];
        } else {
            finalMapResult = null;
            finalPreSelectedMaps = [];
        }

        const matchId = await Match.create({
            display_name, user_id, server_id, team1_name, team2_name, series_type,
            is_veto_enabled: vetoEnabled,
            is_captain_mode: captainMode,
            map_result: finalMapResult,
            pre_selected_maps: finalPreSelectedMaps,
            game_mode: game_mode || 'competitive'
        });

        // Gửi Discord
        discord.sendMatchCreated(matchId, {
            display_name, series_type, is_veto_enabled: vetoEnabled, pre_selected_maps: finalPreSelectedMaps
        });

        res.status(201).json({
            message: "Tạo phòng thành công",
            matchId: matchId,
            matchData: {
                display_name, team1_name, team2_name, series_type, status: 'PENDING',
                is_veto_enabled: vetoEnabled,
                is_captain_mode: captainMode
            }
        });

    } catch (error) {
        console.error("Lỗi tạo match:", error);
        res.status(500).json({ message: "Lỗi server khi tạo match" });
    }
};

// API: Lấy danh sách Match
exports.getAllMatches = async (req, res) => {
    try {
        const matches = await Match.findAll();
        res.json(matches);
    } catch (error) {
        console.error("Lỗi lấy danh sách match:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
};

// API: Lấy chi tiết Match
exports.getMatchDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const match = await Match.findById(id);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const participants = await MatchParticipant.findByMatchId(id);

        res.json({
            ...match,
            participants: participants
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server" });
    }
};

// API: Tham gia hoặc Đổi Slot
exports.joinSlot = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.uid;
        const { team } = req.body;

        const match = await Match.findBasicInfo(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        // Cho phép join khi đang PENDING hoặc PICKING (nếu join trễ)
        if (match.status !== 'PENDING' && match.status !== 'PICKING') {
            return res.status(400).json({ message: "Trận đấu đang diễn ra hoặc đã kết thúc, không thể thay đổi vị trí!" });
        }

        if (!['TEAM1', 'TEAM2', 'SPECTATOR', 'WAITING'].includes(team)) {
            return res.status(400).json({ message: "Team không hợp lệ" });
        }

        if (team === 'TEAM1' || team === 'TEAM2') {
            if (match.status === 'PICKING') {
                return res.status(403).json({ message: "Đang trong giai đoạn Pick người, bạn không thể tự vào team!" });
            }
            const maxTeamSize = match.game_mode === 'wingman' ? 2 : 5;
            const count = await MatchParticipant.countByTeam(matchId, team);
            if (count >= maxTeamSize) {
                return res.status(400).json({ message: `Team này đã đủ ${maxTeamSize} người!` });
            }
        }

        await MatchParticipant.upsert(matchId, userId, team);

        const newList = await MatchParticipant.findByMatchId(matchId);
        getIo().to(`match_${matchId}`).emit('participants_update', newList);

        res.json({ message: "Join thành công", participants: newList });

    } catch (error) {
        console.error("Join Error:", error);
        res.status(500).json({ message: "Lỗi khi tham gia trận đấu" });
    }
};

// API: Rời trận đấu
exports.leaveMatch = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.uid;

        const match = await Match.findBasicInfo(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        if (match.status !== 'PENDING') {
            return res.status(400).json({ message: "Không thể rời phòng khi trận đấu đang diễn ra!" });
        }

        await MatchParticipant.remove(matchId, userId);

        const newList = await MatchParticipant.findByMatchId(matchId);
        getIo().to(`match_${matchId}`).emit('participants_update', newList);

        res.json({ message: "Đã rời trận đấu" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
};

// API: Lấy danh sách Server
exports.getServers = async (req, res) => {
    try {
        const servers = await Server.findActive();
        res.json(servers);
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy danh sách server" });
    }
};

// API: Admin chọn Captains
exports.setCaptains = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.uid;
        const { captain1Id, captain2Id } = req.body;

        const match = await Match.findBasicInfo(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        if (String(match.user_id) !== String(userId)) {
            return res.status(403).json({ message: "Chỉ chủ phòng mới được chọn Captain!" });
        }

        await Match.updateCaptains(matchId, captain1Id, captain2Id);

        // Move captains to their teams
        await MatchParticipant.upsert(matchId, captain1Id, 'TEAM1');
        await MatchParticipant.upsert(matchId, captain2Id, 'TEAM2');

        const newList = await MatchParticipant.findByMatchId(matchId);

        getIo().to(`match_${matchId}`).emit('participants_update', newList);
        getIo().to(`match_${matchId}`).emit('veto_update', {
            status: 'PICKING',
            captain1_id: captain1Id,
            captain2_id: captain2Id
        });

        res.json({ message: "Đã chọn Captain, bắt đầu Pick người!" });

    } catch (error) {
        console.error("Set Captains Error:", error);
        res.status(500).json({ message: "Lỗi Server" });
    }
};

// API: Captain Pick Player
exports.pickPlayer = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.uid;
        const { targetUserId } = req.body;

        const match = await Match.findBasicInfo(matchId);
        if (!match || match.status !== 'PICKING') return res.status(400).json({ message: "Không trong giai đoạn Pick" });

        let myTeam = null;
        if (String(match.captain1_id) === String(userId)) myTeam = 'TEAM1';
        else if (String(match.captain2_id) === String(userId)) myTeam = 'TEAM2';
        else return res.status(403).json({ message: "Bạn không phải Captain" });

        const countT1 = await MatchParticipant.countByTeam(matchId, 'TEAM1');
        const countT2 = await MatchParticipant.countByTeam(matchId, 'TEAM2');

        let turn = (countT1 === countT2) ? 'TEAM1' : ((countT1 > countT2) ? 'TEAM2' : 'TEAM1');

        if (myTeam !== turn) {
            return res.status(400).json({ message: `Chưa đến lượt team bạn (${myTeam}). Lượt của ${turn}` });
        }

        if (countT1 >= 5 && myTeam === 'TEAM1') return res.status(400).json({ message: "Team 1 đã đủ người" });
        if (countT2 >= 5 && myTeam === 'TEAM2') return res.status(400).json({ message: "Team 2 đã đủ người" });

        await MatchParticipant.upsert(matchId, targetUserId, myTeam);

        const newList = await MatchParticipant.findByMatchId(matchId);
        getIo().to(`match_${matchId}`).emit('participants_update', newList);

        const newCountT1 = myTeam === 'TEAM1' ? countT1 + 1 : countT1;
        const newCountT2 = myTeam === 'TEAM2' ? countT2 + 1 : countT2;

        if (newCountT1 >= 5 && newCountT2 >= 5) {
            await Match.updateStatus(matchId, 'VETO');
            getIo().to(`match_${matchId}`).emit('veto_update', { status: 'VETO', vetoLog: [] });
        }

        res.json({ message: "Pick thành công" });

    } catch (error) {
        console.error("Pick Player Error:", error);
        res.status(500).json({ message: "Lỗi Server" });
    }
};

// API: Cập nhật cài đặt
exports.updateSettings = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.uid;
        const {
            is_veto_enabled, is_captain_mode, game_mode, map_result, pre_selected_maps,
            display_name, team1_name, team2_name, series_type, server_id
        } = req.body;

        const match = await Match.findBasicInfo(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        if (String(match.user_id) !== String(userId)) {
            return res.status(403).json({ message: "Chỉ chủ phòng mới được cài đặt!" });
        }

        if (match.status !== 'PENDING' && match.status !== 'PICKING') {
            return res.status(400).json({ message: "Chỉ có thể cài đặt khi trận đấu chưa bắt đầu" });
        }

        const currentSeriesType = series_type || match.series_type;
        let mapToUpdate = undefined;
        let preSelectedMapsToUpdate = undefined;

        if (is_veto_enabled === false) {
            let maps = pre_selected_maps;
            if (!maps && map_result) maps = [map_result];
            if (!maps) maps = [];

            const requiredMaps = currentSeriesType === 'BO1' ? 1 : (currentSeriesType === 'BO3' ? 3 : 5);
            if (maps.length !== requiredMaps) return res.status(400).json({ message: `Vui lòng chọn đúng ${requiredMaps} map` });

            preSelectedMapsToUpdate = maps;
            mapToUpdate = maps[0];
        }

        if (server_id) {
            const server = await Server.findById(server_id);
            if (!server) return res.status(404).json({ message: "Server không tồn tại" });
        }

        await Match.updateSettings(matchId, {
            is_veto_enabled: is_veto_enabled ? 1 : 0,
            is_captain_mode: is_captain_mode ? 1 : 0,
            game_mode: game_mode,
            map_result: mapToUpdate,
            pre_selected_maps: preSelectedMapsToUpdate,
            display_name, team1_name, team2_name, series_type, server_id
        });

        const updatedMatch = await Match.findById(matchId);
        getIo().to(`match_${matchId}`).emit('match_details_update', updatedMatch);

        res.json({ message: "Cập nhật cài đặt thành công" });

    } catch (error) {
        console.error("Update Settings Error:", error);
        res.status(500).json({ message: "Lỗi Server" });
    }
};

// API: Lấy Chat
exports.getMatchChat = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user ? req.user.uid : null; // Handle Guest

        let myTeam = null;
        if (userId) {
            const participant = await MatchParticipant.findOne(matchId, userId);
            myTeam = participant ? participant.team : null;
        }

        let sql = `
            SELECT c.*, u.username, u.avatar_url, p.team as sender_team
            FROM match_chat c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN match_participants p ON p.match_id = c.match_id AND p.user_id = c.user_id
            WHERE c.match_id = ? 
            AND (c.scope = 'GLOBAL' OR c.scope = ?)
            ORDER BY c.created_at ASC
        `;

        const [messages] = await pool.execute(sql, [matchId, myTeam || '']);
        res.json(messages);

    } catch (error) {
        console.error("Get Chat Error:", error);
        res.status(500).json({ message: "Lỗi lấy tin nhắn" });
    }
};

// Veto Logic Helper
// gameMode: 'competitive' (7 maps) or 'wingman' (5 maps)
const calculateState = (vetoLog, seriesType, gameMode = 'competitive') => {
    const mapActions = vetoLog.filter(l => l.action === 'BAN' || l.action === 'PICK');
    const lastAction = vetoLog[vetoLog.length - 1];

    if (lastAction && lastAction.action === 'PICK') {
        const nextTeam = lastAction.team === 'TEAM1' ? 'TEAM2' : 'TEAM1';
        return { turn: nextTeam, type: 'SIDE_PICK', mapRef: lastAction.map };
    }

    const turnIndex = mapActions.length;

    // WINGMAN (5 maps) - chỉ hỗ trợ BO1, BO3
    if (gameMode === 'wingman') {
        if (seriesType === 'BO1') {
            // 5 maps: BAN -> BAN -> BAN -> BAN -> map cuối còn lại
            if (turnIndex >= 4) return { turn: 'FINISHED', type: 'NONE' };
            return { turn: turnIndex % 2 === 0 ? 'TEAM1' : 'TEAM2', type: 'BAN' };
        }
        if (seriesType === 'BO3') {
            // 5 maps: BAN -> PICK -> PICK -> BAN -> map cuối là decider
            if (turnIndex >= 4) return { turn: 'FINISHED', type: 'NONE' };
            const team = turnIndex % 2 === 0 ? 'TEAM1' : 'TEAM2';
            if (turnIndex === 0) return { turn: team, type: 'BAN' };  // BAN
            if (turnIndex < 3) return { turn: team, type: 'PICK' };   // PICK, PICK
            return { turn: team, type: 'BAN' };                       // BAN
        }
        // Wingman không có BO5
        return { turn: 'TEAM1', type: 'BAN' };
    }

    // COMPETITIVE (7 maps)
    if (seriesType === 'BO1') {
        if (turnIndex >= 6) return { turn: 'FINISHED', type: 'NONE' };
        return { turn: turnIndex % 2 === 0 ? 'TEAM1' : 'TEAM2', type: 'BAN' };
    }

    if (seriesType === 'BO3') {
        if (turnIndex >= 6) return { turn: 'FINISHED', type: 'NONE' };
        const team = turnIndex % 2 === 0 ? 'TEAM1' : 'TEAM2';
        if (turnIndex < 2) return { turn: team, type: 'BAN' };
        if (turnIndex < 4) return { turn: team, type: 'PICK' };
        return { turn: team, type: 'BAN' };
    }
    if (seriesType === 'BO5') {
        if (turnIndex >= 6) return { turn: 'FINISHED', type: 'NONE' };
        const team = turnIndex % 2 === 0 ? 'TEAM1' : 'TEAM2';
        if (turnIndex < 2) return { turn: team, type: 'BAN' };
        return { turn: team, type: 'PICK' };
    }

    return { turn: 'TEAM1', type: 'BAN' };
};

// API: Lấy danh sách Map Active (theo game_mode nếu có)
exports.getMapPool = async (req, res) => {
    try {
        const { game_mode } = req.query;

        let maps;
        if (game_mode && (game_mode === 'competitive' || game_mode === 'wingman')) {
            maps = await Map.findActiveByGameMode(game_mode);
        } else {
            maps = await Map.findActive();
        }

        res.json(maps);
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy Map Pool" });
    }
};

// API: Config Matchzy
exports.getMatchConfig = async (req, res) => {
    try {
        const matchId = req.params.id;

        const match = await Match.findBasicInfo(matchId);
        if (!match) return res.status(404).json({ error: "Match not found" });

        const participants = await MatchParticipant.findByMatchId(matchId);

        let vetoLog = match.veto_log || [];
        if (typeof vetoLog === 'string') {
            try { vetoLog = JSON.parse(vetoLog); } catch (e) { vetoLog = []; }
        }

        const config = generateMatchzyJSON(match, participants, vetoLog, match.map_result);
        res.json(config);

    } catch (error) {
        console.error("Config Generation Error:", error);
        res.status(500).json({ error: "Failed to generate config" });
    }
};

// API: Veto Map
exports.vetoMap = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.uid;
        const { mapName, side } = req.body;

        const match = await Match.findBasicInfo(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        let vetoLog = match.veto_log || [];
        if (typeof vetoLog === 'string') vetoLog = JSON.parse(vetoLog);

        if (match.status === 'FINISHED') return res.status(400).json({ message: "Ended" });

        const gameMode = match.game_mode || 'competitive';
        const state = calculateState(vetoLog, match.series_type, gameMode);
        if (state.turn === 'FINISHED') return res.status(400).json({ message: "Veto finished" });

        const participant = await MatchParticipant.findOne(matchId, userId);
        if (!participant) return res.status(403).json({ message: "Bạn không tham gia" });

        const userTeam = participant.team;
        if (userTeam !== state.turn) return res.status(403).json({ message: `Chưa đến lượt của bạn (${state.turn})` });

        if (state.type === 'SIDE_PICK') {
            if (!side || !['CT', 'T'].includes(side)) {
                return res.status(400).json({ message: "Vui lòng chọn side (CT hoặc T)" });
            }
            vetoLog.push({ team: userTeam, action: 'SIDE_PICK', map: state.mapRef, side: side, time: new Date().toISOString() });
        }
        else {
            if (!mapName) return res.status(400).json({ message: "Vui lòng chọn Map" });

            // Lấy map pool theo game_mode (competitive/wingman)
            const activePool = (await Map.findActiveByGameMode(gameMode)).map(m => m.map_key);
            if (!activePool.includes(mapName)) return res.status(400).json({ message: "Map invalid" });

            if (vetoLog.some(l => l.map === mapName && (l.action === 'BAN' || l.action === 'PICK'))) {
                return res.status(400).json({ message: "Map đã được chọn" });
            }

            vetoLog.push({ team: userTeam, map: mapName, action: state.type, time: new Date().toISOString() });
        }

        await Match.updateVetoLog(matchId, vetoLog, 'VETO');

        const nextState = calculateState(vetoLog, match.series_type, gameMode);
        let finalMap = null;
        let matchResultStatus = 'VETO';

        if (nextState.turn === 'FINISHED') {
            matchResultStatus = 'LIVE';

            const mapActions = vetoLog.filter(l => l.action === 'BAN' || l.action === 'PICK');
            const usedMaps = mapActions.map(l => l.map);
            // Lấy đúng pool theo game_mode
            const fullPool = (await Map.findActiveByGameMode(gameMode)).map(m => m.map_key);
            finalMap = fullPool.find(m => !usedMaps.includes(m));

            if (finalMap) {
                await Match.updateMapResult(matchId, finalMap, 'LIVE');

                const pickedMaps = vetoLog.filter(l => l.action === 'PICK').map(l => l.map);
                const mapsToPlay = [...pickedMaps, finalMap];

                await pool.execute('DELETE FROM match_maps WHERE match_id = ?', [matchId]);

                const mapValues = mapsToPlay.map((mapName, index) => [
                    matchId, index + 1, mapName, index === 0 ? 'LIVE' : 'PENDING'
                ]);

                if (mapValues.length > 0) {
                    await pool.query('INSERT INTO match_maps (match_id, map_number, map_name, status) VALUES ?', [mapValues]);
                }

                const server = await Server.findById(match.server_id);
                if (server) {
                    const configUrl = `http://127.0.0.1:3000/api/matches/${matchId}/config`;
                    sendRconCommand(server, `matchzy_loadmatch_url "${configUrl}"`).catch(console.error);
                }
            }
        }

        const updateData = { vetoLog, status: matchResultStatus, mapResult: finalMap, nextState: nextState };
        getIo().to(`match_${matchId}`).emit('veto_update', updateData);

        res.json({ message: "Success", data: updateData });


    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi Server" });
    }
};

// API: Admin bắt đầu trận đấu
exports.startMatch = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.uid;

        const match = await Match.findBasicInfo(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        if (String(match.user_id) !== String(userId)) {
            return res.status(403).json({ message: "Chỉ chủ phòng mới được bắt đầu!" });
        }

        if (match.is_veto_enabled === 0) {
            let mapsToPlay = match.pre_selected_maps;
            if (!mapsToPlay || mapsToPlay.length === 0) {
                if (match.map_result) mapsToPlay = [match.map_result];
            }

            if (!mapsToPlay || mapsToPlay.length === 0) return res.status(400).json({ message: "Chưa chọn Map" });

            await Match.updateStatus(matchId, 'LIVE');
            await pool.execute('DELETE FROM match_maps WHERE match_id = ?', [matchId]);

            const mapValues = mapsToPlay.map((mapName, index) => [
                matchId, index + 1, mapName, index === 0 ? 'LIVE' : 'PENDING'
            ]);
            await pool.query('INSERT INTO match_maps (match_id, map_number, map_name, status) VALUES ?', [mapValues]);

            const server = await Server.findById(match.server_id);
            if (server) {
                const configUrl = `http://127.0.0.1:3000/api/matches/${matchId}/config`;
                sendRconCommand(server, `matchzy_loadmatch_url "${configUrl}"`).catch(console.error);
            }

            getIo().to(`match_${matchId}`).emit('veto_update', { status: 'LIVE', mapResult: mapsToPlay[0] });
            return res.json({ message: "Bắt đầu ngay (No Veto)" });

        } else {
            await Match.updateStatus(matchId, 'VETO');
            getIo().to(`match_${matchId}`).emit('veto_update', { status: 'VETO', vetoLog: [] });
            return res.json({ message: "Đã bắt đầu Veto!" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server" });
    }
};

// API: Hủy trận đấu (Admin)
exports.cancelMatch = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.uid;

        const match = await Match.findBasicInfo(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        if (String(match.user_id) !== String(userId)) {
            return res.status(403).json({ message: "Chỉ chủ phòng mới được hủy trận!" });
        }

        const server = await Server.findById(match.server_id);
        if (server) {
            try { await sendRconCommand(server, "css_forceend"); } catch (e) { }
        }

        await Match.updateStatus(matchId, 'CANCELLED');
        getIo().to(`match_${matchId}`).emit('veto_update', { status: 'CANCELLED' });

        res.json({ message: "Đã hủy trận đấu thành công" });

    } catch (error) {
        console.error("Cancel Match Error:", error);
        res.status(500).json({ message: "Lỗi server khi hủy trận" });
    }
};

// API: GỬI RCON
exports.sendMatchRcon = async (req, res) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.uid;
        const { command } = req.body;

        if (!command) return res.status(400).json({ message: "Vui lòng nhập lệnh" });

        const match = await Match.findBasicInfo(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        if (String(match.user_id) !== String(userId)) {
            return res.status(403).json({ message: "Chỉ chủ phòng mới được dùng RCON!" });
        }

        const server = await Server.findById(match.server_id);
        if (!server) return res.status(404).json({ message: "Server not found" });

        const rconResponse = await sendRconCommand(server, command);
        res.json({ message: "Gửi thành công", response: rconResponse });

    } catch (error) {
        console.error("RCON API Error:", error);
        res.status(500).json({ message: "Lỗi kết nối RCON: " + error.message });
    }
};

// API: Lấy thống kê
exports.getMatchStats = async (req, res) => {
    try {
        const { id } = req.params;
        const match = await Match.findById(id);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const [maps] = await pool.execute(`SELECT * FROM match_maps WHERE match_id = ? ORDER BY map_number ASC`, [id]);

        const mapsWithStats = await Promise.all(maps.map(async (map) => {
            let playerStats = [];
            let loadedFromJSON = false;

            if (map.last_event_data) {
                try {
                    const event = (typeof map.last_event_data === 'string') ? JSON.parse(map.last_event_data) : map.last_event_data;

                    if (event.event === 'map_end' || event.event === 'map_result' || event.event === 'round_end') {
                        if (event.team1 && event.team1.score !== undefined) map.score_team1 = event.team1.score;
                        if (event.team2 && event.team2.score !== undefined) map.score_team2 = event.team2.score;
                    }

                    // ... process players stats (rút gọn cho ngắn) ...
                    // Để code chạy được, ta giữ logic cũ nhưng rút gọn lại
                    if (event.team1 && event.team2 && event.team1.players && event.team2.players) {
                        const t1 = processMatchzyStats(event.team1.players, event.team1.name, event.team1.side);
                        const t2 = processMatchzyStats(event.team2.players, event.team2.name, event.team2.side);
                        playerStats = [...t1, ...t2];
                        loadedFromJSON = true;
                    }
                } catch (e) { }
            }
            return { ...map, player_stats: playerStats };
        }));

        res.json({ match_info: match, maps: mapsWithStats });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi lấy thống kê" });
    }
};
