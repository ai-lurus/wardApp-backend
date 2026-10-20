-- CreateEnum
CREATE TYPE "OperatorStatus" AS ENUM ('disponible', 'en_viaje', 'no_disponible', 'inactivo');

-- CreateEnum
CREATE TYPE "OperatorDocumentType" AS ENUM ('ine', 'contract', 'license');

-- CreateEnum
CREATE TYPE "OperatorLicenseType" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateTable
CREATE TABLE "operators" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "license_number" TEXT NOT NULL,
    "license_type" "OperatorLicenseType" NOT NULL,
    "license_expiry" TIMESTAMP(3) NOT NULL,
    "status" "OperatorStatus" NOT NULL DEFAULT 'disponible',
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_documents" (
    "id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "document_type" "OperatorDocumentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "operator_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operators_company_id_license_number_key" ON "operators"("company_id", "license_number");

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_documents" ADD CONSTRAINT "operator_documents_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
