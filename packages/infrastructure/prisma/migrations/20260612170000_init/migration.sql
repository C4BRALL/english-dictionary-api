CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "words" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "word" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "word_id" UUID NOT NULL,
  "added" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "favorites" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "word_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
CREATE UNIQUE INDEX "words_word_key" ON "words"("word");
CREATE INDEX "words_word_prefix_idx" ON "words" ("word" text_pattern_ops);
CREATE INDEX "words_deleted_at_idx" ON "words"("deleted_at");
CREATE INDEX "history_user_id_added_idx" ON "history"("user_id", "added" DESC);
CREATE INDEX "history_word_id_idx" ON "history"("word_id");
CREATE UNIQUE INDEX "favorites_user_id_word_id_key" ON "favorites"("user_id", "word_id");
CREATE INDEX "favorites_user_id_updated_at_idx" ON "favorites"("user_id", "updated_at" DESC);
CREATE INDEX "favorites_word_id_idx" ON "favorites"("word_id");
CREATE INDEX "favorites_deleted_at_idx" ON "favorites"("deleted_at");

ALTER TABLE "history"
  ADD CONSTRAINT "history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "history"
  ADD CONSTRAINT "history_word_id_fkey"
  FOREIGN KEY ("word_id") REFERENCES "words"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "favorites"
  ADD CONSTRAINT "favorites_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "favorites"
  ADD CONSTRAINT "favorites_word_id_fkey"
  FOREIGN KEY ("word_id") REFERENCES "words"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
