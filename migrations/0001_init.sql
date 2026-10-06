-- Schéma initial du portfolio (Cloudflare D1 / SQLite). Horodatages en millisecondes.

-- Réglages et contenu (clé → JSON)
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Historique du contenu (restauration depuis l'admin)
CREATE TABLE IF NOT EXISTS content_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

-- Visites (une ligne par session de navigation)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  pageviews INTEGER NOT NULL DEFAULT 1,
  country TEXT,
  city TEXT,
  region TEXT,
  timezone TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  referrer TEXT,
  referrer_host TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  lang TEXT,
  screen TEXT,
  landing TEXT,
  sections TEXT NOT NULL DEFAULT '[]',
  current_section TEXT,
  chat_count INTEGER NOT NULL DEFAULT 0,
  contacted INTEGER NOT NULL DEFAULT 0,
  tour INTEGER NOT NULL DEFAULT 0,
  is_new INTEGER NOT NULL DEFAULT 1,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions (last_seen);

-- Actions notables (téléchargement du CV, visite guidée, projet ouvert…)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts);
CREATE INDEX IF NOT EXISTS idx_events_session ON events (session_id);

-- Messages du formulaire de contact
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  lang TEXT,
  file_key TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  session_id TEXT,
  country TEXT,
  ip_hash TEXT,
  email_status TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_ip ON messages (ip_hash, created_at);

-- Conversations avec le guide IA
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  visitor_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  lang TEXT,
  provider TEXT,
  ip_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_chat_ip ON chat_messages (ip_hash, created_at);

-- Fichiers téléversés (le contenu binaire est dans KV)
CREATE TABLE IF NOT EXISTS files (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'media',
  created_at INTEGER NOT NULL
);

-- Tentatives de connexion à l'admin (limitation anti force brute)
CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT NOT NULL,
  ok INTEGER NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_ip ON login_attempts (ip_hash, ts);
