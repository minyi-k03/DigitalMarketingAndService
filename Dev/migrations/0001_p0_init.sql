-- 0001_p0_init: P0 초기 스키마 (docs/architecture.md §7, SPEC §19)
-- 날짜는 TEXT(YYYY-MM-DD, KST), 시각은 TEXT(UTC ISO 8601), 불리언은 INTEGER 0/1,
-- 배열·객체 필드는 TEXT(JSON)다.
-- 발표용(D-16·D-17) 추가분: kakao_message_tokens, featured_events,
-- catalog_items.published_at·featured_order.

-- ---------- Identity ----------

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  kakao_id TEXT NOT NULL UNIQUE,
  nickname TEXT,
  phone_number_encrypted TEXT,
  notification_enabled INTEGER NOT NULL CHECK (notification_enabled IN (0, 1)),
  notification_consent_at TEXT,
  role TEXT NOT NULL CHECK (role IN ('USER', 'OPERATOR', 'ADMIN')),
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

-- 발표용 '나에게 보내기' 토큰(D-16). access token은 저장하지 않는다.
CREATE TABLE kakao_message_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  refresh_token_encrypted TEXT NOT NULL,
  refresh_token_expires_at TEXT NOT NULL,
  scopes TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ---------- Catalog & Marketplace ----------

CREATE TABLE partners (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE catalog_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('GUARDED_SERVICE', 'SPONSORED_TRIAL')),
  name TEXT NOT NULL,
  logo_url TEXT,
  signup_url TEXT,
  publication_status TEXT NOT NULL
    CHECK (publication_status IN ('SUBMITTED', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED')),
  owner_partner_id TEXT REFERENCES partners (id),
  service_category TEXT NOT NULL
    CHECK (service_category IN ('BIGTECH', 'AI', 'DELIVERY', 'OTT', 'CLOUD', 'LEARNING', 'ETC')),
  monthly_price INTEGER NOT NULL CHECK (monthly_price >= 0),
  default_trial_days INTEGER NOT NULL CHECK (default_trial_days BETWEEN 1 AND 365),
  is_global_time_zone_buffer_required INTEGER NOT NULL
    CHECK (is_global_time_zone_buffer_required IN (0, 1)),
  dark_pattern_scores TEXT NOT NULL,
  dark_pattern_level TEXT NOT NULL CHECK (dark_pattern_level IN ('HIGH', 'MEDIUM', 'LOW')),
  escape_pattern TEXT NOT NULL
    CHECK (escape_pattern IN ('DIRECT_LINK', 'SPA_MODAL_GUIDE', 'PC_OR_APP_FORCED')),
  forced_channel TEXT CHECK (forced_channel IN ('APP', 'PC_WEB')),
  escape_guide_steps TEXT NOT NULL,
  escape_link TEXT NOT NULL,
  escape_link_fallback_url TEXT,
  access_retention_policy TEXT NOT NULL
    CHECK (access_retention_policy IN ('RETAIN_UNTIL_END', 'IMMEDIATE_TERMINATION')),
  backup_checklist TEXT,
  edu_benefit TEXT,
  support_contact TEXT NOT NULL,
  last_verified_at TEXT NOT NULL,
  published_at TEXT,
  featured_order INTEGER CHECK (featured_order IS NULL OR featured_order >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- SPONSORED_TRIAL은 signupUrl과 ownerPartnerId가 필수 (SPEC §19)
  CHECK (kind <> 'SPONSORED_TRIAL' OR (signup_url IS NOT NULL AND owner_partner_id IS NOT NULL)),
  -- D-15: PC_OR_APP_FORCED일 때만 forcedChannel이 있고, APP이면 fallback URL이 필수
  CHECK ((escape_pattern = 'PC_OR_APP_FORCED') = (forced_channel IS NOT NULL)),
  CHECK (forced_channel IS NOT 'APP' OR escape_link_fallback_url IS NOT NULL)
);
-- 피처드 슬롯 순서는 유일하다 (NULL은 여러 건 허용)
CREATE UNIQUE INDEX idx_catalog_items_featured_order
  ON catalog_items (featured_order) WHERE featured_order IS NOT NULL;
-- 제휴 체험 라운지: 최근 게시 순
CREATE INDEX idx_catalog_items_lounge
  ON catalog_items (kind, publication_status, published_at DESC);

CREATE TABLE catalog_change_logs (
  id TEXT PRIMARY KEY,
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items (id),
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  changes TEXT NOT NULL,
  applied_to_active_records INTEGER NOT NULL CHECK (applied_to_active_records IN (0, 1))
);
CREATE INDEX idx_catalog_change_logs_item ON catalog_change_logs (catalog_item_id, changed_at);

-- 키 접두사로 소유 모듈을 나눈다: catalog.*, notification.*
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES
  ('notification.sendTime', '"10:00"', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('catalog.darkPatternRubric', '{"mediumMin":2,"highMin":4}', NULL,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('catalog.allowedDeepLinkSchemes', '[]', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- ---------- Trial Tracking & Schedule ----------

CREATE TABLE trial_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items (id),
  source TEXT NOT NULL CHECK (source IN ('MANUAL_CATALOG_SELECT', 'SPONSORED_OUTBOUND_PROMPT')),
  start_date TEXT NOT NULL,
  trial_days INTEGER NOT NULL CHECK (trial_days BETWEEN 1 AND 365),
  buffer_applied INTEGER NOT NULL CHECK (buffer_applied IN (0, 1)),
  billing_date TEXT NOT NULL,
  safe_end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'TRACKING', 'CANCEL_ATTEMPTED', 'CANCELED_CONFIRMED', 'KEPT',
    'MISSED_BILLED', 'BILLED_CONFIRMED', 'VOIDED'
  )),
  exit_reason TEXT CHECK (exit_reason IN (
    'PRICE_BURDEN', 'LACK_OF_FEATURES', 'COMPLEX_UX', 'SHORT_TERM_GOAL_MET', 'MOVED_TO_ALTERNATIVE'
  )),
  cancel_attempted_at TEXT,
  confirmed_at TEXT,
  saved_amount INTEGER CHECK (saved_amount IS NULL OR saved_amount >= 0),
  status_changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  -- ExitPoll 불변식 (SPEC §5): TRACKING에는 응답이 없고 CANCEL_ATTEMPTED·CANCELED_CONFIRMED에는 있다
  CHECK (status <> 'TRACKING' OR exit_reason IS NULL),
  CHECK (status NOT IN ('CANCEL_ATTEMPTED', 'CANCELED_CONFIRMED') OR exit_reason IS NOT NULL)
);
-- 같은 사용자·서비스의 진행 중 기록은 1건만 허용
CREATE UNIQUE INDEX idx_trial_records_active
  ON trial_records (user_id, catalog_item_id)
  WHERE status IN ('TRACKING', 'CANCEL_ATTEMPTED');
CREATE INDEX idx_trial_records_status_billing ON trial_records (status, billing_date);
CREATE INDEX idx_trial_records_user_status ON trial_records (user_id, status);

-- 기록당 1건 (PRIMARY KEY). 응답 원본이며 trial_records.exit_reason은 사본이다.
CREATE TABLE exit_poll_responses (
  trial_record_id TEXT PRIMARY KEY REFERENCES trial_records (id) ON DELETE CASCADE,
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items (id),
  service_category TEXT NOT NULL
    CHECK (service_category IN ('BIGTECH', 'AI', 'DELIVERY', 'OTT', 'CLOUD', 'LEARNING', 'ETC')),
  reason TEXT NOT NULL CHECK (reason IN (
    'PRICE_BURDEN', 'LACK_OF_FEATURES', 'COMPLEX_UX', 'SHORT_TERM_GOAL_MET', 'MOVED_TO_ALTERNATIVE'
  )),
  responded_at TEXT NOT NULL
);
CREATE INDEX idx_exit_poll_item ON exit_poll_responses (catalog_item_id, responded_at);

CREATE TABLE notification_schedules (
  id TEXT PRIMARY KEY,
  trial_record_id TEXT NOT NULL REFERENCES trial_records (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ESCAPE_ALERT', 'CANCEL_CONFIRM_CHECK', 'BILLING_CHECK')),
  slot TEXT NOT NULL CHECK (slot IN (
    'D3', 'D1', 'LATE_REGISTRATION', 'D1_CONFIRM', 'SAME_DAY_CONFIRM', 'BILLING_CHECK'
  )),
  variant TEXT NOT NULL,
  safe_end_date TEXT NOT NULL,
  send_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'PENDING', 'SENDING', 'SENT', 'FAILED', 'EXPIRED', 'CANCELED', 'SKIPPED'
  )),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at TEXT,
  -- 종류와 슬롯의 조합 (SPEC §19 NotificationSlot)
  CHECK (
    (kind = 'ESCAPE_ALERT' AND slot IN ('D3', 'D1', 'LATE_REGISTRATION'))
    OR (kind = 'CANCEL_CONFIRM_CHECK' AND slot IN ('D1_CONFIRM', 'SAME_DAY_CONFIRM'))
    OR (kind = 'BILLING_CHECK' AND slot = 'BILLING_CHECK')
  ),
  -- 발송 멱등성 (SPEC §17)
  UNIQUE (trial_record_id, slot, safe_end_date)
);
CREATE INDEX idx_notification_schedules_due ON notification_schedules (status, send_at);

-- ---------- EscapeBridge & Recovery ----------

CREATE TABLE broken_link_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items (id),
  trial_record_id TEXT NOT NULL REFERENCES trial_records (id),
  target TEXT NOT NULL CHECK (target IN ('ESCAPE_LINK', 'ESCAPE_GUIDE')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'FIXED', 'REJECTED')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX idx_broken_link_reports_dedupe
  ON broken_link_reports (user_id, catalog_item_id, target, created_at);
CREATE INDEX idx_broken_link_reports_status ON broken_link_reports (status);

-- ---------- B2B Analytics & Matching ----------

-- 발표용 B2B(D-17): 제휴 체험 노출·클릭 기록
CREATE TABLE featured_events (
  id TEXT PRIMARY KEY,
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items (id),
  placement TEXT NOT NULL CHECK (placement IN ('LOUNGE', 'FEATURED_SLOT', 'ALTERNATIVE_MATCH_BANNER')),
  type TEXT NOT NULL CHECK (type IN ('IMPRESSION', 'CLICK')),
  user_id TEXT NOT NULL REFERENCES users (id),
  occurred_at TEXT NOT NULL
);
CREATE INDEX idx_featured_events_item
  ON featured_events (catalog_item_id, placement, type, occurred_at);
CREATE INDEX idx_featured_events_user ON featured_events (user_id, placement, occurred_at);
