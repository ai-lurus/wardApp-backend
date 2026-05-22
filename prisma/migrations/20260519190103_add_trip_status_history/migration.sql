-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "cancellation_reason" TEXT;

-- CreateTable
CREATE TABLE "trip_status_history" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "status" "TripStatus" NOT NULL,
    "actor_id" UUID NOT NULL,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_status_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "trip_status_history" ADD CONSTRAINT "trip_status_history_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
