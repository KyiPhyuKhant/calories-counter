// Preserve IDs, rowids, links, nutrition, timestamps and duplicate keys during rebuild.
export const foodCatalogMigration = `
  DROP TRIGGER foods_search_insert;
  DROP TRIGGER foods_search_update;
  DROP TRIGGER foods_search_delete;
  DROP TABLE food_search;
  CREATE TABLE foods_v8 (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0), search_key TEXT NOT NULL, dedupe_key TEXT UNIQUE,
    calories REAL CHECK (calories >= 0),
    serving_amount REAL NOT NULL CHECK (serving_amount BETWEEN 0.001 AND 100000),
    serving_unit TEXT NOT NULL CHECK (serving_unit IN ('g', 'kg', 'oz', 'ml', 'cup', 'piece', 'serving')),
    protein REAL CHECK (protein >= 0), carbohydrates REAL CHECK (carbohydrates >= 0), fat REAL CHECK (fat >= 0),
    notes TEXT CHECK (length(notes) <= 2000),
    source TEXT NOT NULL CHECK (source IN ('bundled', 'external', 'custom')), provider TEXT, external_id TEXT,
    calories_per_100g REAL CHECK (calories_per_100g >= 0), protein_per_100g REAL CHECK (protein_per_100g >= 0),
    carbs_per_100g REAL CHECK (carbs_per_100g >= 0), fat_per_100g REAL CHECK (fat_per_100g >= 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    cuisine TEXT CHECK (cuisine IN ('myanmar', 'japanese', 'western', 'chinese')),
    native_name TEXT, aliases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases) AND json_type(aliases) = 'array'),
    category TEXT CHECK (category IN ('dish', 'ingredient')), nutrition_source TEXT,
    nutrition_status TEXT NOT NULL DEFAULT 'unverified' CHECK (nutrition_status IN ('unverified', 'user_entered', 'source_backed', 'recipe', 'development')),
    image TEXT,
    CHECK ((source = 'external' AND length(trim(provider)) > 0 AND length(trim(external_id)) > 0
      AND provider IS NOT NULL AND external_id IS NOT NULL) OR (source != 'external' AND provider IS NULL AND external_id IS NULL))
  );
  INSERT INTO foods_v8 (rowid, id, name, search_key, dedupe_key, calories, serving_amount, serving_unit,
    protein, carbohydrates, fat, notes, source, provider, external_id, calories_per_100g, protein_per_100g,
    carbs_per_100g, fat_per_100g, created_at, updated_at, cuisine, nutrition_status)
  SELECT rowid, id, name, search_key, dedupe_key, calories, serving_amount, serving_unit,
    protein, carbohydrates, fat, notes, source, provider, external_id, calories_per_100g, protein_per_100g,
    carbs_per_100g, fat_per_100g, created_at, updated_at, cuisine,
    CASE source WHEN 'bundled' THEN 'development' WHEN 'custom' THEN 'user_entered' ELSE 'unverified' END FROM foods;
  DROP TABLE foods;
  ALTER TABLE foods_v8 RENAME TO foods;
  CREATE INDEX foods_name_idx ON foods(name COLLATE NOCASE);
  CREATE INDEX foods_cuisine_name_idx ON foods(cuisine, name COLLATE NOCASE, id);
  CREATE UNIQUE INDEX foods_external_idx ON foods(provider, external_id) WHERE source = 'external';
  CREATE VIRTUAL TABLE food_search USING fts5(name, native_name, aliases, content='foods', content_rowid='rowid',
    tokenize="unicode61 remove_diacritics 2 categories 'L* N* Co M*'");
  CREATE TRIGGER foods_search_insert AFTER INSERT ON foods BEGIN
    INSERT INTO food_search(rowid, name, native_name, aliases) VALUES (new.rowid, new.name, new.native_name, new.aliases);
  END;
  CREATE TRIGGER foods_search_delete AFTER DELETE ON foods BEGIN
    INSERT INTO food_search(food_search, rowid, name, native_name, aliases) VALUES ('delete', old.rowid, old.name, old.native_name, old.aliases);
  END;
  CREATE TRIGGER foods_search_update AFTER UPDATE ON foods BEGIN
    INSERT INTO food_search(food_search, rowid, name, native_name, aliases) VALUES ('delete', old.rowid, old.name, old.native_name, old.aliases);
    INSERT INTO food_search(rowid, name, native_name, aliases) VALUES (new.rowid, new.name, new.native_name, new.aliases);
  END;
  INSERT INTO food_search(food_search) VALUES ('rebuild');
`;
