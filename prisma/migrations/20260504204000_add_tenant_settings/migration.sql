-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "fuel_price_per_liter" DOUBLE PRECISION NOT NULL DEFAULT 22.0,
    "fuel_efficiency_km_l" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "estimated_trips_per_month" INTEGER NOT NULL DEFAULT 20,
    "monthly_insurance_cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_company_id_key" ON "tenant_settings"("company_id");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "tenant_settings" ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy
CREATE POLICY "tenant_settings_isolation" ON "tenant_settings"
  USING (company_id::text = current_setting('app.current_company_id', true));
