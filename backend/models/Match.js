const pool = require('../config/database');

class Match {
    /**
     * Tạo một match mới (Full Features)
     */
    static async create({ display_name, user_id, server_id, team1_name, team2_name, series_type, is_veto_enabled, is_captain_mode, map_result, pre_selected_maps, game_mode, tournament_id, bracket_round, bracket_match_index }) {
        const sql = `
            INSERT INTO matches (
                display_name, user_id, server_id, team1_name, team2_name, series_type, 
                is_veto_enabled, is_captain_mode, map_result, pre_selected_maps, game_mode,
                tournament_id, bracket_round, bracket_match_index
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.execute(sql, [
            display_name, user_id, server_id, team1_name, team2_name, series_type,
            is_veto_enabled || 1, is_captain_mode || 0, map_result,
            JSON.stringify(pre_selected_maps || []), game_mode || 'competitive',
            tournament_id || null, bracket_round || null, bracket_match_index || null
        ]);
        return result.insertId;
    }

    /**
     * Lấy tất cả các match (cho dashboard)
     */
    static async findAll() {
        const sql = `
            SELECT 
                m.*, 
                s.display_name as server_name, 
                s.ip, 
                s.port,
                COALESCE(SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(mm.last_event_data, '$.winner.team')) = 'team1' THEN 1 ELSE 0 END), 0) AS team1_series_score,
                COALESCE(SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(mm.last_event_data, '$.winner.team')) = 'team2' THEN 1 ELSE 0 END), 0) AS team2_series_score
            FROM matches m
            JOIN servers s ON m.server_id = s.id
            LEFT JOIN match_maps mm ON m.id = mm.match_id AND mm.status = 'FINISHED'
            GROUP BY m.id 
            ORDER BY m.created_at DESC
        `;
        const [rows] = await pool.execute(sql);
        return rows;
    }

    /**
     * Lấy thông tin chi tiết một match bằng ID
     */
    static async findById(id) {
        const sql = `
            SELECT m.*, s.ip, s.port, u.username as admin_name
            FROM matches m
            JOIN servers s ON m.server_id = s.id
            JOIN users u ON m.user_id = u.id
            WHERE m.id = ?
        `;
        const [rows] = await pool.execute(sql, [id]);
        const match = rows[0];
        if (match) {
            // Parse JSON fields safely
            if (typeof match.veto_log === 'string') {
                try { match.veto_log = JSON.parse(match.veto_log); } catch (e) { match.veto_log = []; }
            }
            if (!Array.isArray(match.veto_log)) match.veto_log = [];

            if (typeof match.pre_selected_maps === 'string') {
                try { match.pre_selected_maps = JSON.parse(match.pre_selected_maps); } catch (e) { match.pre_selected_maps = []; }
            }
        }
        return match;
    }

    /**
     * Lấy thông tin cơ bản của match (dùng cho các check nhanh)
     */
    static async findBasicInfo(id) {
        const sql = 'SELECT * FROM matches WHERE id = ?';
        const [rows] = await pool.execute(sql, [id]);

        const match = rows[0];
        if (match && typeof match.pre_selected_maps === 'string') {
            try { match.pre_selected_maps = JSON.parse(match.pre_selected_maps); } catch (e) { match.pre_selected_maps = []; }
        }
        return match;
    }

    /**
     * Cập nhật trạng thái của match
     */
    static async updateStatus(id, status) {
        const sql = 'UPDATE matches SET status = ? WHERE id = ?';
        const [result] = await pool.execute(sql, [status, id]);
        return result.affectedRows > 0;
    }

    /**
     * Cập nhật log veto và status
     */
    static async updateVetoLog(id, vetoLog, status = 'VETO') {
        const sql = 'UPDATE matches SET veto_log = ?, status = ? WHERE id = ?';
        const [result] = await pool.execute(sql, [JSON.stringify(vetoLog), status, id]);
        return result.affectedRows > 0;
    }

    /**
     * Cập nhật map cuối cùng (decider) và status
     */
    static async updateMapResult(id, mapResult, status = 'LIVE') {
        const sql = 'UPDATE matches SET map_result = ?, status = ? WHERE id = ?';
        const [result] = await pool.execute(sql, [mapResult, status, id]);
        return result.affectedRows > 0;
    }

    /**
     * Set Captains và chuyển sang trạng thái PICKING
     */
    static async updateCaptains(id, captain1Id, captain2Id) {
        const sql = 'UPDATE matches SET captain1_id = ?, captain2_id = ?, status = "PICKING" WHERE id = ?';
        const [result] = await pool.execute(sql, [captain1Id, captain2Id, id]);
        return result.affectedRows > 0;
    }

    /**
     * Cập nhật Settings cho Match
     */
    static async updateSettings(id, { is_veto_enabled, is_captain_mode, game_mode, map_result, pre_selected_maps, display_name, team1_name, team2_name, series_type, server_id }) {
        let sql = 'UPDATE matches SET is_veto_enabled = ?, is_captain_mode = ?';
        const params = [is_veto_enabled, is_captain_mode];

        if (game_mode) {
            sql += ', game_mode = ?';
            params.push(game_mode);
        }

        if (map_result !== undefined) {
            sql += ', map_result = ?';
            params.push(map_result);
        }

        if (pre_selected_maps !== undefined) {
            sql += ', pre_selected_maps = ?';
            params.push(JSON.stringify(pre_selected_maps));
        }

        if (display_name) { sql += ', display_name = ?'; params.push(display_name); }
        if (team1_name) { sql += ', team1_name = ?'; params.push(team1_name); }
        if (team2_name) { sql += ', team2_name = ?'; params.push(team2_name); }
        if (series_type) { sql += ', series_type = ?'; params.push(series_type); }
        if (server_id) { sql += ', server_id = ?'; params.push(server_id); }

        sql += ' WHERE id = ?';
        params.push(id);

        const [result] = await pool.execute(sql, params);
        return result.affectedRows > 0;
    }

}

module.exports = Match;