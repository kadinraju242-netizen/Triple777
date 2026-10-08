-- ============================================================
-- Triple 7 Holdings — Trade Desk database (MySQL / MariaDB)
-- ------------------------------------------------------------
-- You do not need to run this by hand: `node serve.js` creates the
-- database and these tables the first time it starts, then fills
-- them with the test data from seed.json.
--
-- It is kept as a normal .sql file so you can read it, or import
-- it yourself in phpMyAdmin / MySQL Workbench if you prefer.
--
--   profiles          one row per account (buyer, seller or admin)
--   sessions          who is signed in right now
--   lots              everything a seller lists (pending -> live)
--   seller_documents  the supporting document filed with each lot
--   enquiries         messages buyers send about a lot
--   lot_alerts        "tell me when new lots list" sign-ups
--
-- Deleting an account deletes its lots, documents, enquiries and
-- sessions with it (ON DELETE CASCADE).
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id             CHAR(36)     NOT NULL PRIMARY KEY,
  email          VARCHAR(190) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,           -- scrypt, never the password itself
  role           ENUM('buyer','seller','admin') NULL,
  first_name     VARCHAR(100) NULL,
  last_name      VARCHAR(100) NULL,
  phone          VARCHAR(40)  NULL,
  country        VARCHAR(80)  NULL,
  company        VARCHAR(150) NULL,
  status         ENUM('active','suspended') NOT NULL DEFAULT 'active',
  verified       TINYINT(1)   NOT NULL DEFAULT 0, -- 1 once the emailed link is clicked
  verify_token   CHAR(48)     NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY profiles_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  token       CHAR(64)    NOT NULL PRIMARY KEY,
  user_id     CHAR(36)    NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT sessions_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lots (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  lot_number   INT          NOT NULL AUTO_INCREMENT UNIQUE,  -- the number part of the lot id
  lot_id       VARCHAR(16)  NULL UNIQUE,                     -- D-3001, G-3002 ...
  seller_id    CHAR(36)     NOT NULL,
  commodity    ENUM('diamond','gold','platinum','silver','ruby','sapphire','emerald','tanzanite') NOT NULL,
  name         VARCHAR(120) NOT NULL,
  type         VARCHAR(40)  NULL,                            -- polished, rough, bar, coin ...
  description  TEXT         NULL,
  price_zar    DECIMAL(14,2) NOT NULL,
  weight       DECIMAL(12,3) NULL,
  weight_unit  ENUM('ct','g') NULL,
  quantity     INT          NOT NULL DEFAULT 1,
  origin       VARCHAR(80)  NULL,
  specs        JSON         NULL,                            -- cut, colour, clarity, purity ... (see js/catalog.js)
  status       ENUM('pending','live','rejected','sold','withdrawn') NOT NULL DEFAULT 'pending',
  review_note  TEXT         NULL,
  reviewed_by  CHAR(36)     NULL,
  reviewed_at  DATETIME(3)  NULL,
  image        VARCHAR(255) NULL,
  image_card   VARCHAR(255) NULL,
  image_alt    VARCHAR(255) NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY lots_status (status),
  KEY lots_commodity (commodity),
  CONSTRAINT lots_seller   FOREIGN KEY (seller_id)   REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT lots_reviewer FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=3001;

CREATE TABLE IF NOT EXISTS seller_documents (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  seller_id    CHAR(36)     NOT NULL,
  lot_id       CHAR(36)     NULL,
  doc_type     VARCHAR(80)  NOT NULL DEFAULT 'Seller verification',
  file_name    VARCHAR(255) NULL,                            -- empty for now: uploads come later
  file_path    VARCHAR(255) NULL,
  note         TEXT         NULL,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  review_note  TEXT         NULL,
  reviewed_by  CHAR(36)     NULL,
  reviewed_at  DATETIME(3)  NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY documents_status (status),
  CONSTRAINT documents_seller   FOREIGN KEY (seller_id)   REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT documents_lot      FOREIGN KEY (lot_id)      REFERENCES lots(id)     ON DELETE CASCADE,
  CONSTRAINT documents_reviewer FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enquiries (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  enquiry_number  INT          NOT NULL AUTO_INCREMENT UNIQUE,
  ref             VARCHAR(16)  NULL UNIQUE,                  -- ENQ-5001
  lot_id          CHAR(36)     NOT NULL,
  buyer_id        CHAR(36)     NOT NULL,
  seller_id       CHAR(36)     NOT NULL,
  buyer_name      VARCHAR(210) NULL,                         -- copied from the buyer's profile when sent
  buyer_email     VARCHAR(190) NULL,
  buyer_phone     VARCHAR(40)  NULL,
  message         TEXT         NOT NULL,
  status          ENUM('new','answered','closed') NOT NULL DEFAULT 'new',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT enquiries_lot    FOREIGN KEY (lot_id)    REFERENCES lots(id)     ON DELETE CASCADE,
  CONSTRAINT enquiries_buyer  FOREIGN KEY (buyer_id)  REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT enquiries_seller FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=5001;

CREATE TABLE IF NOT EXISTS lot_alerts (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  email       VARCHAR(190) NOT NULL UNIQUE,
  interests   VARCHAR(255) NOT NULL DEFAULT 'diamond,gold',  -- comma-separated
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
