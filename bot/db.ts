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
    bill_message_id INTEGER,
    host_id INTEGER NOT NULL,
    title TEXT,
    location TEXT,
    datetime TEXT,
    court_fee REAL DEFAULT 0,
    tube_price REAL DEFAULT 95,
    shuttles_used INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    settled_at DATETIME,
    payment_deadline DATETIME,
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

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    paid_at DATETIME,
    reminder_sent BOOLEAN DEFAULT 0,
    reminder_sent_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
  id?: number;
  group_id: number;
  message_id?: number;
  bill_message_id?: number;
  host_id: number;
  title?: string;
  location?: string;
  datetime?: string;
  court_fee?: number;
  tube_price?: number;
  shuttles_used?: number;
  status?: string;
  settled_at?: string;
  payment_deadline?: string;
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

export const updateSession = (sessionId: number, updates: Partial<SessionData> & {
  status?: string;
  court_fee?: number;
  tube_price?: number;
  shuttles_used?: number;
  bill_message_id?: number;
  settled_at?: string;
  payment_deadline?: string;
}) => {
  const fields = Object.keys(updates).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
  const values = Object.keys(updates).filter(k => k !== 'id').map(k => (updates as any)[k]);

  if (fields) {
    const stmt = db.prepare(`UPDATE sessions SET ${fields} WHERE id = ?`);
    stmt.run(...values, sessionId);
  }
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

// Payment management
export const createPaymentRecords = (sessionId: number, amount: number) => {
  const participants = getParticipants(sessionId);
  const session = getSession(sessionId);

  const stmt = db.prepare(`
        INSERT OR IGNORE INTO payments (session_id, user_id, amount, status)
        VALUES (?, ?, ?, ?)
    `);

  for (const participant of participants) {
    // Host is automatically marked as paid
    const status = participant.user_id === session.host_id ? 'paid' : 'pending';
    stmt.run(sessionId, participant.user_id, amount, status);
  }
};

export const markPaymentPaid = (sessionId: number, userId: number) => {
  const stmt = db.prepare(`
        UPDATE payments 
        SET status = 'paid', paid_at = CURRENT_TIMESTAMP
        WHERE session_id = ? AND user_id = ?
    `);
  stmt.run(sessionId, userId);
};

export const getPaymentStatus = (sessionId: number) => {
  const stmt = db.prepare(`
        SELECT 
            sp.user_id,
            sp.first_name,
            sp.username,
            COALESCE(p.status, 'pending') as payment_status,
            p.paid_at,
            p.amount
        FROM session_participants sp
        LEFT JOIN payments p ON p.session_id = sp.session_id 
            AND p.user_id = sp.user_id
        WHERE sp.session_id = ? AND sp.status = 'in'
        ORDER BY p.paid_at ASC NULLS LAST
    `);
  return stmt.all(sessionId) as Array<{
    user_id: number;
    first_name: string;
    username?: string;
    payment_status: string;
    paid_at?: string;
    amount: number;
  }>;
};

export const getUnpaidParticipants = (sessionId: number) => {
  const stmt = db.prepare(`
        SELECT 
            sp.user_id,
            sp.first_name,
            sp.username,
            p.amount
        FROM session_participants sp
        JOIN payments p ON p.session_id = sp.session_id 
            AND p.user_id = sp.user_id
        WHERE sp.session_id = ? 
            AND sp.status = 'in'
            AND p.status = 'pending'
    `);
  return stmt.all(sessionId) as Array<{
    user_id: number;
    first_name: string;
    username?: string;
    amount: number;
  }>;
};

export const getOverduePayments = () => {
  const stmt = db.prepare(`
        SELECT 
            s.id as session_id,
            s.bill_message_id,
            s.group_id,
            p.user_id,
            p.amount,
            sp.first_name,
            sp.username
        FROM sessions s
        JOIN payments p ON p.session_id = s.id
        JOIN session_participants sp ON sp.session_id = s.id 
            AND sp.user_id = p.user_id
        WHERE s.payment_deadline < datetime('now')
            AND p.status = 'pending'
            AND p.reminder_sent = 0
            AND s.status = 'settled'
    `);
  return stmt.all();
};

export const markReminderSent = (sessionId: number, userId: number) => {
  const stmt = db.prepare(`
        UPDATE payments 
        SET reminder_sent = 1, reminder_sent_at = CURRENT_TIMESTAMP
        WHERE session_id = ? AND user_id = ?
    `);
  stmt.run(sessionId, userId);
};

export default db;
