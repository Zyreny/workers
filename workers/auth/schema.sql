CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user',
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    iterations INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE verifications (
    code TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    salt TEXT,
    type TEXT NOT NULL,
    expires_at INTEGER NOT NULL
)