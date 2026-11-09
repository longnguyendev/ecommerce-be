-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'RECEIPT_REVERT';

-- AlterTable
ALTER TABLE "PurchaseReceiptItem" ADD COLUMN     "costBefore" INTEGER;
