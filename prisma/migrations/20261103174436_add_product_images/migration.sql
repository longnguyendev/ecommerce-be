/*
  Warnings:

  - You are about to drop the column `image` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "image";

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain checks / invariants (not expressible in the Prisma schema)
ALTER TABLE "ProductImage"
    ADD CONSTRAINT "ProductImage_sort_order_check" CHECK ("sortOrder" >= 0);

-- At most one primary image per product (Product.thumbnail mirrors it)
CREATE UNIQUE INDEX "ProductImage_one_primary_per_product" ON "ProductImage"("productId") WHERE "isPrimary" = true;
