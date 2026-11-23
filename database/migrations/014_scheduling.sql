CREATE TABLE scheduling_resources (
  id uuid PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bookings (
  id uuid PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES scheduling_resources(id),
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_resource_time ON bookings(resource_id, starts_at, ends_at) WHERE status = 'confirmed';
CREATE INDEX bookings_customer ON bookings(customer_id, starts_at DESC);
