-- Give every existing product an app-generated sku_id.
-- Same format as src/services/product/identifiers.js: PRD- + 8 upper-case hex.
-- Only fills empty values; an existing sku_id is never changed.
UPDATE "Product"
SET "sku_id" = 'PRD-' || upper(hex(randomblob(4)))
WHERE "sku_id" IS NULL;
