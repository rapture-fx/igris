-- Migration 015: Better Auth tables
-- Replaces Clerk JWT auth with Better Auth session-based auth.
-- Better Auth manages its own user/session/account/verification tables.

CREATE TABLE IF NOT EXISTS "user" (
    id                  TEXT        NOT NULL PRIMARY KEY,
    name                TEXT        NOT NULL,
    email               TEXT        NOT NULL UNIQUE,
    "emailVerified"     BOOLEAN     NOT NULL DEFAULT FALSE,
    image               TEXT,
    "createdAt"         TIMESTAMP   NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMP   NOT NULL DEFAULT NOW(),
    -- admin plugin fields
    role                TEXT        DEFAULT 'user',
    banned              BOOLEAN     DEFAULT FALSE,
    "banReason"         TEXT,
    "banExpires"        TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session (
    id                  TEXT        NOT NULL PRIMARY KEY,
    "expiresAt"         TIMESTAMP   NOT NULL,
    token               TEXT        NOT NULL UNIQUE,
    "createdAt"         TIMESTAMP   NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMP   NOT NULL DEFAULT NOW(),
    "ipAddress"         TEXT,
    "userAgent"         TEXT,
    "userId"            TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    -- admin plugin field
    "impersonatedBy"    TEXT
);

CREATE TABLE IF NOT EXISTS account (
    id                          TEXT        NOT NULL PRIMARY KEY,
    "accountId"                 TEXT        NOT NULL,
    "providerId"                TEXT        NOT NULL,
    "userId"                    TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "accessToken"               TEXT,
    "refreshToken"              TEXT,
    "idToken"                   TEXT,
    "accessTokenExpiresAt"      TIMESTAMP,
    "refreshTokenExpiresAt"     TIMESTAMP,
    scope                       TEXT,
    password                    TEXT,
    "createdAt"                 TIMESTAMP   NOT NULL DEFAULT NOW(),
    "updatedAt"                 TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification (
    id              TEXT        NOT NULL PRIMARY KEY,
    identifier      TEXT        NOT NULL,
    value           TEXT        NOT NULL,
    "expiresAt"     TIMESTAMP   NOT NULL,
    "createdAt"     TIMESTAMP   DEFAULT NOW(),
    "updatedAt"     TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_token   ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_user    ON session("userId");
CREATE INDEX IF NOT EXISTS idx_account_user    ON account("userId");
CREATE INDEX IF NOT EXISTS idx_user_email      ON "user"(email);
