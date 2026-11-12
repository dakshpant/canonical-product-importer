-- CreateTable
CREATE TABLE "ProductUpdateProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "importRecordId" TEXT NOT NULL,
    "proposedData" JSONB NOT NULL,
    "reviewedFields" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductUpdateProposal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductUpdateProposal_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductUpdateProposal_importRecordId_key" ON "ProductUpdateProposal"("importRecordId");

-- CreateIndex
CREATE INDEX "ProductUpdateProposal_productId_idx" ON "ProductUpdateProposal"("productId");

-- CreateIndex
CREATE INDEX "ProductUpdateProposal_status_idx" ON "ProductUpdateProposal"("status");
