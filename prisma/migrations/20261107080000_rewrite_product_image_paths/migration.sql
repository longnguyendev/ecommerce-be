-- Ảnh sản phẩm chuyển từ /images/products/* (public của FE) sang /uploads/products/* (BE).
UPDATE "ProductImage"
SET "url" = REPLACE("url", '/images/products/', '/uploads/products/')
WHERE "url" LIKE '/images/products/%';

UPDATE "Product"
SET "thumbnail" = REPLACE("thumbnail", '/images/products/', '/uploads/products/')
WHERE "thumbnail" LIKE '/images/products/%';
