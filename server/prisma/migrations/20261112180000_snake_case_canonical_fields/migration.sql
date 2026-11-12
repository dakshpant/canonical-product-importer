-- Rename columns to the canonical snake_case names.
-- Uses RENAME COLUMN (SQLite >= 3.25) so existing rows are preserved;
-- foreign keys referencing renamed columns are updated by SQLite automatically.

ALTER TABLE "Product" RENAME COLUMN "skuId" TO "sku_id";
ALTER TABLE "Product" RENAME COLUMN "productKind" TO "product_kind";
ALTER TABLE "Product" RENAME COLUMN "subCategory" TO "sub_category";
ALTER TABLE "Product" RENAME COLUMN "shortDescription" TO "short_description";
ALTER TABLE "Product" RENAME COLUMN "unitOfMeasure" TO "unit_of_measure";
ALTER TABLE "Product" RENAME COLUMN "minQuantity" TO "min_quantity";
ALTER TABLE "Product" RENAME COLUMN "maxQuantity" TO "max_quantity";
ALTER TABLE "Product" RENAME COLUMN "imageUrl" TO "image_url";
ALTER TABLE "Product" RENAME COLUMN "imageAlt" TO "image_alt";
ALTER TABLE "Product" RENAME COLUMN "imageType" TO "image_type";
ALTER TABLE "Product" RENAME COLUMN "imageSourcePage" TO "image_source_page";
ALTER TABLE "Product" RENAME COLUMN "targetCustomers" TO "target_customers";
ALTER TABLE "Product" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Product" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "ImportBatch" RENAME COLUMN "totalUrls" TO "total_urls";
ALTER TABLE "ImportBatch" RENAME COLUMN "completedUrls" TO "completed_urls";
ALTER TABLE "ImportBatch" RENAME COLUMN "failedUrls" TO "failed_urls";
ALTER TABLE "ImportBatch" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "ImportBatch" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "ImportRecord" RENAME COLUMN "extractedData" TO "extracted_data";
ALTER TABLE "ImportRecord" RENAME COLUMN "errorMessage" TO "error_message";
ALTER TABLE "ImportRecord" RENAME COLUMN "batchId" TO "batch_id";
ALTER TABLE "ImportRecord" RENAME COLUMN "productId" TO "product_id";
ALTER TABLE "ImportRecord" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "ImportRecord" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "ProductUpdateProposal" RENAME COLUMN "productId" TO "product_id";
ALTER TABLE "ProductUpdateProposal" RENAME COLUMN "importRecordId" TO "import_record_id";
ALTER TABLE "ProductUpdateProposal" RENAME COLUMN "proposedData" TO "proposed_data";
ALTER TABLE "ProductUpdateProposal" RENAME COLUMN "reviewedFields" TO "reviewed_fields";
ALTER TABLE "ProductUpdateProposal" RENAME COLUMN "reviewedAt" TO "reviewed_at";
ALTER TABLE "ProductUpdateProposal" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "ProductUpdateProposal" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "ProductSource" RENAME COLUMN "productId" TO "product_id";
ALTER TABLE "ProductSource" RENAME COLUMN "importRecordId" TO "import_record_id";
ALTER TABLE "ProductSource" RENAME COLUMN "fieldName" TO "field_name";
ALTER TABLE "ProductSource" RENAME COLUMN "extractedValue" TO "extracted_value";
ALTER TABLE "ProductSource" RENAME COLUMN "evidenceText" TO "evidence_text";
ALTER TABLE "ProductSource" RENAME COLUMN "sourceType" TO "source_type";
ALTER TABLE "ProductSource" RENAME COLUMN "sourceUrl" TO "source_url";
ALTER TABLE "ProductSource" RENAME COLUMN "createdAt" TO "created_at";

-- Rename indexes to match Prisma's naming for the new column names.
DROP INDEX "Product_skuId_key";
CREATE UNIQUE INDEX "Product_sku_id_key" ON "Product"("sku_id");
DROP INDEX "ProductSource_productId_idx";
CREATE INDEX "ProductSource_product_id_idx" ON "ProductSource"("product_id");
DROP INDEX "ProductSource_importRecordId_idx";
CREATE INDEX "ProductSource_import_record_id_idx" ON "ProductSource"("import_record_id");
DROP INDEX "ProductSource_fieldName_idx";
CREATE INDEX "ProductSource_field_name_idx" ON "ProductSource"("field_name");
DROP INDEX "ImportRecord_batchId_idx";
CREATE INDEX "ImportRecord_batch_id_idx" ON "ImportRecord"("batch_id");
DROP INDEX "ImportRecord_productId_idx";
CREATE INDEX "ImportRecord_product_id_idx" ON "ImportRecord"("product_id");
DROP INDEX "ProductUpdateProposal_importRecordId_key";
CREATE UNIQUE INDEX "ProductUpdateProposal_import_record_id_key" ON "ProductUpdateProposal"("import_record_id");
DROP INDEX "ProductUpdateProposal_productId_idx";
CREATE INDEX "ProductUpdateProposal_product_id_idx" ON "ProductUpdateProposal"("product_id");
