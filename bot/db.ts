import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('kakibadminton.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    first_name TEXT,
    username TEXT,
    payment_qr_file_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export const upsertUser = (user: { id: number; first_name: string; username?: string }) => {
    const stmt = db.prepare(`
    INSERT INTO users (id, first_name, username)
    VALUES (@id, @first_name, @username)
    ON CONFLICT(id) DO UPDATE SET
      first_name = @first_name,
      username = @username
  `);
    stmt.run(user);
};

export const setPaymentQr = (userId: number, fileId: string) => {
    const stmt = db.prepare(`
    UPDATE users SET payment_qr_file_id = ? WHERE id = ?
  `);
    stmt.run(fileId, userId);
};

export const getUser = (userId: number) => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId) as { id: number; first_name: string; username?: string; payment_qr_file_id?: string } | undefined;
};

export default db;
