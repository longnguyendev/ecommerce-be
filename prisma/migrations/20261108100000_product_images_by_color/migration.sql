-- Ảnh gắn theo MÀU (AttributeValue của thuộc tính "Màu sắc") thay vì theo từng biến thể.
-- attributeValueId = NULL: ảnh chung của sản phẩm.

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN "attributeValueId" TEXT;

-- Ảnh của biến thể -> ảnh của màu mà biến thể đó có
UPDATE "ProductImage" pi
SET "attributeValueId" = vav."attributeValueId"
FROM "VariantAttributeValue" vav
JOIN "Attribute" a ON a."id" = vav."attributeId" AND a."name" = 'Màu sắc'
WHERE pi."variantId" IS NOT NULL
  AND vav."variantId" = pi."variantId";

-- Nhiều biến thể cùng màu từng tải cùng một ảnh: giữ 1 bản cho mỗi (sản phẩm, màu, url)
DELETE FROM "ProductImage" a
USING "ProductImage" b
WHERE a."productId" = b."productId"
  AND a."attributeValueId" IS NOT DISTINCT FROM b."attributeValueId"
  AND a."url" = b."url"
  AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

-- DropForeignKey / DropIndex / DropColumn
ALTER TABLE "ProductImage" DROP CONSTRAINT "ProductImage_variantId_fkey";
DROP INDEX "ProductImage_variantId_idx";
ALTER TABLE "ProductImage" DROP COLUMN "variantId";

-- CreateIndex
CREATE INDEX "ProductImage_attributeValueId_idx" ON "ProductImage"("attributeValueId");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "AttributeValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
