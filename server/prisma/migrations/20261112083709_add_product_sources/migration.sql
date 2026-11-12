-- CreateTable
CREATE TABLE "ProductSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT,
    "importRecordId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "extractedValue" JSONB,
    "evidenceText" TEXT,
    "sourceType" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductSource_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductSource_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProductSource_productId_idx" ON "ProductSource"("productId");

-- CreateIndex
CREATE INDEX "ProductSource_importRecordId_idx" ON "ProductSource"("importRecordId");

-- CreateIndex
CREATE INDEX "ProductSource_fieldName_idx" ON "ProductSource"("fieldName");
