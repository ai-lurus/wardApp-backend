-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "estimated_duration_min" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tollbooths" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cost_2_axles" DOUBLE PRECISION NOT NULL,
    "cost_3_axles" DOUBLE PRECISION NOT NULL,
    "cost_4_axles" DOUBLE PRECISION NOT NULL,
    "cost_5_axles" DOUBLE PRECISION NOT NULL,
    "cost_6_axles" DOUBLE PRECISION NOT NULL,
    "cost_7_plus_axles" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tollbooths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_tollbooths" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "tollbooth_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_tollbooths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "route_tollbooths_route_id_tollbooth_id_key" ON "route_tollbooths"("route_id", "tollbooth_id");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tollbooths" ADD CONSTRAINT "tollbooths_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_tollbooths" ADD CONSTRAINT "route_tollbooths_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_tollbooths" ADD CONSTRAINT "route_tollbooths_tollbooth_id_fkey" FOREIGN KEY ("tollbooth_id") REFERENCES "tollbooths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
