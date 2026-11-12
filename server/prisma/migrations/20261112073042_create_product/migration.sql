-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "skuId" TEXT,
    "slug" TEXT NOT NULL,
    "productKind" TEXT,
    "category" TEXT,
    "industry" TEXT,
    "subCategory" TEXT,
    "tagline" TEXT,
    "shortDescription" TEXT,
    "overview" TEXT,
    "website" TEXT,
    "unitOfMeasure" TEXT,
    "minQuantity" REAL,
    "maxQuantity" REAL,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "imageType" TEXT,
    "imageSourcePage" TEXT,
    "tags" JSONB,
    "skills" JSONB,
    "features" JSONB,
    "deployments" JSONB,
    "platforms" JSONB,
    "targetCustomers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_skuId_key" ON "Product"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");
