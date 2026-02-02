const pool = require('../config/database');

class Comment {
    static async create({ content, post_id, author_id }) {
        const sql = `INSERT INTO comments (content, post_id, author_id) VALUES (?, ?, ?)`;
        const [result] = await pool.execute(sql, [content, post_id, author_id]);
        return result.insertId;
    }

    static async findByPostId(post_id) {
        const sql = `
            SELECT c.*, u.username, u.avatar_url 
            FROM comments c
            JOIN users u ON c.author_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        `;
        const [rows] = await pool.execute(sql, [post_id]);
        return rows;
    }

    static async findById(id) {
        const sql = `SELECT * FROM comments WHERE id = ?`;
        const [rows] = await pool.execute(sql, [id]);
        return rows[0];
    }

    static async delete(id) {
        const sql = `DELETE FROM comments WHERE id = ?`;
        const [result] = await pool.execute(sql, [id]);
        return result.affectedRows > 0;
    }
}

module.exports = Comment;
