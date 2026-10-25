CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  title text NOT NULL,
  source_url text,
  department text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'demo',
  access_groups text[] NOT NULL DEFAULT ARRAY['employees'],
  version integer NOT NULL DEFAULT 1,
  effective_date date,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','retired')),
  content_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The demo embedding dimension is 3. Replace it with the selected model's exact dimension in production.
CREATE TABLE IF NOT EXISTS chunks (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(3),
  page_start integer,
  page_end integer,
  section text,
  token_count integer NOT NULL DEFAULT 0,
  tenant_id text NOT NULL DEFAULT 'demo',
  access_groups text[] NOT NULL DEFAULT ARRAY['employees'],
  document_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, document_version, chunk_index)
);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_tenant_status ON chunks(tenant_id, status);
CREATE INDEX IF NOT EXISTS chunks_access_groups ON chunks USING gin(access_groups);
CREATE INDEX IF NOT EXISTS documents_content_hash ON documents(content_hash);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','processing','succeeded','failed')),
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  user_id text NOT NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Illustrative structured data. Production applications should use approved views and least-privilege roles.
CREATE TABLE IF NOT EXISTS refund_metrics (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'demo',
  month text NOT NULL,
  refunds_count integer NOT NULL,
  orders_count integer NOT NULL,
  refund_value numeric(12,2) NOT NULL
);
INSERT INTO refund_metrics(tenant_id,month,refunds_count,orders_count,refund_value)
VALUES ('demo','2026-09',42,1200,7350.50),('demo','2026-08',37,1140,6120.00)
ON CONFLICT DO NOTHING;
