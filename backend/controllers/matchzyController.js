const Match = require('../models/Match');
const socketManager = require('../socket/socketManager');
const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const { processMatchzyStats } = require('../utils/matchzy');

exports.handleMatchzyEvent = async (req, res) => {
    const event = req.body;
    console.log(`📡 MatchZy Event: ${event.event} (Match ID: ${event.matchid})`);

    const io = socketManager.getIo();

    try {
        switch (event.event) {
            case 'round_end':
                const currentMapNumber = parseInt(event.map_number) + 1;
                // Cập nhật score cho bảng Web (match_maps) - Map đang LIVE gần nhất
                // ĐỒNG THỜI LƯU LUÔN EVENT JSON VÀO CỘT last_event_data
                await pool.execute(
                    `UPDATE match_maps 
                     SET last_event_data = ?
                     WHERE match_id = ? AND map_number = ? AND status = 'LIVE' ORDER BY start_time DESC LIMIT 1`,
                    [JSON.stringify(event), event.matchid, currentMapNumber]
                );

                // --- PROCESS PLAYER STATS DIRECTLY FROM EVENT ---
                try {
                    const team1Stats = processMatchzyStats(event.team1.players, event.team1.name, event.team1.side);
                    const team2Stats = processMatchzyStats(event.team2.players, event.team2.name, event.team2.side);
                    const allPlayerStats = [...team1Stats, ...team2Stats];

                    if (allPlayerStats.length > 0) {
                        io.to(`match_${event.matchid}`).emit('live_stats', {
                            matchId: event.matchid,
                            map_name: currentMapNumber,
                            player_stats: allPlayerStats
                        });
                        console.log(`✅ Round End: Emitted ${allPlayerStats.length} player stats from event data.`);
                    }
                } catch (err) {
                    console.error("❌ Failed to process stats from round_end event:", err.message);
                }
                // -----------------------------------------------------

                io.to(`match_${event.matchid}`).emit('round_end', {
                    matchId: event.matchid,
                    map_name: currentMapNumber,
                    team1_score: event.team1.score,
                    team2_score: event.team2.score
                });
                break;

            // --- 5. MAP END ---
            case 'map_result':
                const mapEndNumber = parseInt(event.map_number) + 1;

                // Determine winner name from nested object (event.winner.team is "team1" or "team2")
                const winnerSide = event.winner ? event.winner.team : null;
                const winnerName = winnerSide === 'team1' ? event.team1.name : (winnerSide === 'team2' ? event.team2.name : 'Unknown');

                // --- LOGIC FIX: MatchZy map_result might have empty players. Preserve stats from previous round_end ---
                let eventToSave = { ...event }; // Shallow copy
                const t1Players = eventToSave.team1?.players;
                const t2Players = eventToSave.team2?.players;

                if ((!t1Players || t1Players.length === 0) || (!t2Players || t2Players.length === 0)) {
                    try {
                        // Get current last_event_data (which should be the last round_end)
                        const [rows] = await pool.execute(
                            `SELECT last_event_data FROM match_maps WHERE match_id = ? AND map_number = ?`,
                            [event.matchid, mapEndNumber]
                        );

                        if (rows.length > 0 && rows[0].last_event_data) {
                            const prevEvent = (typeof rows[0].last_event_data === 'string')
                                ? JSON.parse(rows[0].last_event_data)
                                : rows[0].last_event_data;

                            // Inject players if missing in current event but present in previous
                            if ((!t1Players || t1Players.length === 0) && prevEvent.team1?.players?.length > 0) {
                                if (!eventToSave.team1) eventToSave.team1 = {};
                                eventToSave.team1.players = prevEvent.team1.players;
                            }
                            if ((!t2Players || t2Players.length === 0) && prevEvent.team2?.players?.length > 0) {
                                if (!eventToSave.team2) eventToSave.team2 = {};
                                eventToSave.team2.players = prevEvent.team2.players;
                            }
                            console.log(`⚠️ map_result had empty players. Injected stats from previous event.`);
                        }
                    } catch (fetchErr) {
                        console.error("Failed to fetch previous event data to fix map_result:", fetchErr);
                    }
                }
                // ---------------------------------------------------------------------------------------------------

                // Cập nhật Web (match_maps) - Set map hiện tại thành FINISHED
                await pool.execute(
                    `UPDATE match_maps 
                     SET status = 'FINISHED', end_time = NOW(), last_event_data = ?
                     WHERE match_id = ? AND map_number = ?`,
                    [JSON.stringify(eventToSave), event.matchid, mapEndNumber]
                );

                // --- KIỂM TRA XEM SERIES ĐÃ KẾT THÚC CHƯA TRƯỚC KHI BẬT MAP MỚI ---
                // 1. Lấy series_type
                const [matchRows] = await pool.execute('SELECT series_type FROM matches WHERE id = ?', [event.matchid]);
                if (matchRows.length > 0) {
                    const seriesType = matchRows[0].series_type;

                    // 2. Tính lại Series Score hiện tại (Cộng thêm map vừa win)
                    // Lưu ý: event.teamX.series_score thường là score TRƯỚC khi cộng map này (tùy version MatchZy, nhưng an toàn là tự cộng)
                    // Nếu MatchZy đã cộng rồi thì logic này có thể thừa, nhưng để chắc chắn ta dùng logic đếm.
                    // Tuy nhiên, đơn giản nhất: Nếu thắng BO3 cần 2 win. BO5 cần 3 win.

                    let t1Wins = parseInt(event.team1.series_score);
                    let t2Wins = parseInt(event.team2.series_score);

                    // event.teamX.series_score đã là điểm đúng sau khi cộng map này, không cần cộng thêm.

                    let winsNeeded = 1; // BO1
                    if (seriesType === 'BO3') winsNeeded = 2;
                    if (seriesType === 'BO5') winsNeeded = 3;

                    const isSeriesOver = (t1Wins >= winsNeeded || t2Wins >= winsNeeded);

                    if (!isSeriesOver) {
                        // Chỉ bật map tiếp theo nếu chưa ai thắng series
                        const [nextMaps] = await pool.execute(
                            `SELECT map_number FROM match_maps 
                             WHERE match_id = ? AND status = 'PENDING' AND map_number > ? 
                             ORDER BY map_number ASC LIMIT 1`,
                            [event.matchid, mapEndNumber]
                        );

                        if (nextMaps.length > 0) {
                            const nextMapNum = nextMaps[0].map_number;
                            await pool.execute(
                                `UPDATE match_maps SET status = 'LIVE' WHERE match_id = ? AND map_number = ?`,
                                [event.matchid, nextMapNum]
                            );
                            console.log(`🔄 Switching to Next Map: ${nextMapNum} (LIVE)`);
                        }
                    } else {
                        console.log(`🏁 Series finished (Score: ${t1Wins}-${t2Wins}). Not starting next map.`);
                    }
                }
                // ------------------------------------------------

                io.to(`match_${event.matchid}`).emit('map_end', {
                    matchId: event.matchid,
                    map_name: mapEndNumber,
                    winner: winnerName
                });
                console.log(`Map ${mapEndNumber} FINISHED. Winner: ${winnerName}`);
                break;

            // --- 6. MATCH END (SERIES OVER) ---
            case 'series_end':
                // Get winner team (team1 or team2)
                const seriesWinner = event.winner ? event.winner.team : null;

                // Cập nhật trạng thái trận đấu chính sang FINISHED
                // Reset is_paused về 0 luôn cho chắc
                const sqlUpdateMatch = `UPDATE matches SET status = 'FINISHED', winner_team = ? WHERE id = ?`;
                await pool.execute(sqlUpdateMatch, [seriesWinner, event.matchid]);

                io.to(`match_${event.matchid}`).emit('series_end', {
                    matchId: event.matchid,
                    winner: seriesWinner
                });
                console.log(`Series ${event.matchid} ENDED. Winner: ${seriesWinner}`);
                break;

            default:
                break;
        }
        res.status(200).send('Event received');
    } catch (error) {
        console.error('Error handling MatchZy event:', error);
        res.status(500).send('Error processing event');
    }
};
