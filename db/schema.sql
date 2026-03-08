CREATE TABLE IF NOT EXISTS patient_records (
  patient_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  age SMALLINT NOT NULL CHECK (age >= 0 AND age <= 130),
  gender VARCHAR(32) NOT NULL,
  allergies TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  conditions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  medications TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  recent_symptoms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_visit DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_history (
  id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user_created
  ON chat_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_history_conversation_created
  ON chat_history (conversation_id, created_at ASC);
