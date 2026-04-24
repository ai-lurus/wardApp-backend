-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('programado', 'en_curso', 'completado', 'cancelado');

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'programado',
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "departure_time" TIMESTAMP(3),
    "arrival_time" TIMESTAMP(3),
    "estimated_cost" DOUBLE PRECISION,
    "actual_cost" DOUBLE PRECISION,
    "notes" TEXT,
    "entry_cost" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_cost_details" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "tollbooth_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fuel_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fuel_type" TEXT,
    "extras_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated_tollbooth_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated_fuel_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated_extras_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "trip_cost_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_cost_details_trip_id_key" ON "trip_cost_details"("trip_id");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_cost_details" ADD CONSTRAINT "trip_cost_details_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
