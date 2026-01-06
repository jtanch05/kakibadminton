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

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    message_id INTEGER,
    host_id INTEGER NOT NULL,
    title TEXT,
    location TEXT,
    datetime TEXT,
    court_fee REAL DEFAULT 0,
    tube_price REAL DEFAULT 95,
    shuttles_used INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS session_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    first_name TEXT,
    username TEXT,
    status TEXT DEFAULT 'in',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    UNIQUE(session_id, user_id)
  );
`);

// User management
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

// Session management
interface SessionData {
  group_id: number;
  host_id: number;
  title?: string;
  location?: string;
  datetime?: string;
  message_id?: number;
}

export const createSession = (data: SessionData) => {
  const stmt = db.prepare(`
        INSERT INTO sessions (group_id, host_id, title, location, datetime, message_id)
        VALUES (@group_id, @host_id, @title, @location, @datetime, @message_id)
    `);
  const result = stmt.run({
    group_id: data.group_id,
    host_id: data.host_id,
    title: data.title || 'Badminton Session',
    location: data.location || null,
    datetime: data.datetime || null,
    message_id: data.message_id || null
  });
  return result.lastInsertRowid as number;
};

export const getSession = (sessionId: number) => {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(sessionId) as any;
};

export const updateSession = (sessionId: number, data: Partial<SessionData> & { status?: string; court_fee?: number; tube_price?: number; shuttles_used?: number }) => {
  const fields = Object.keys(data).map(key => `${key} = @${key}`).join(', ');
  const stmt = db.prepare(`UPDATE sessions SET ${fields} WHERE id = ?`);
  stmt.run({ ...data, id: sessionId });
};

// Participant management
export const addParticipant = (sessionId: number, userId: number, firstName: string, username?: string) => {
  const stmt = db.prepare(`
        INSERT INTO session_participants (session_id, user_id, first_name, username, status)
        VALUES (?, ?, ?, ?, 'in')
        ON CONFLICT(session_id, user_id) DO UPDATE SET
            status = 'in',
            first_name = excluded.first_name,
            username = excluded.username,
            joined_at = CURRENT_TIMESTAMP
    `);
  stmt.run(sessionId, userId, firstName, username || null);
};

export const removeParticipant = (sessionId: number, userId: number) => {
  const stmt = db.prepare(`
        UPDATE session_participants 
        SET status = 'out' 
        WHERE session_id = ? AND user_id = ?
    `);
  stmt.run(sessionId, userId);
};

export const getParticipants = (sessionId: number) => {
  const stmt = db.prepare(`
        SELECT user_id, first_name, username, joined_at
        FROM session_participants
        WHERE session_id = ? AND status = 'in'
        ORDER BY joined_at ASC
    `);
  return stmt.all(sessionId) as Array<{ user_id: number; first_name: string; username?: string; joined_at: string }>;
};

export const getParticipantCount = (sessionId: number) => {
  const stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM session_participants
        WHERE session_id = ? AND status = 'in'
    `);
  const result = stmt.get(sessionId) as { count: number };
  return result.count;
};

export const isParticipant = (sessionId: number, userId: number) => {
  const stmt = db.prepare(`
        SELECT status FROM session_participants
        WHERE session_id = ? AND user_id = ?
    `);
  const result = stmt.get(sessionId, userId) as { status: string } | undefined;
  return result?.status === 'in';
};

export default db;
