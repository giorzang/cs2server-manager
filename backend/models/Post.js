const pool = require('../config/database');

class Post {
    static async create({ title, content, author_id }) {
        const sql = `INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)`;
        const [result] = await pool.execute(sql, [title, content, author_id]);
        return result.insertId;
    }

    static async findAll() {
        const sql = `
            SELECT p.*, u.username, u.avatar_url 
            FROM posts p
            JOIN users u ON p.author_id = u.id
            ORDER BY p.created_at DESC
        `;
        const [rows] = await pool.execute(sql);
        return rows;
    }

    static async delete(id) {
        const sql = `DELETE FROM posts WHERE id = ?`;
        const [result] = await pool.execute(sql, [id]);
        return result.affectedRows > 0;
    }

    static async update(id, title, content) {
        const sql = `UPDATE posts SET title = ?, content = ? WHERE id = ?`;
        const [result] = await pool.execute(sql, [title, content, id]);
        return result.affectedRows > 0;
    }
}

module.exports = Post;
