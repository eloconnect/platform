CREATE TABLE "PisoSalarialConvencao" (
    "id" TEXT NOT NULL,
    "conventionId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "floorAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PisoSalarialConvencao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PisoSalarialConvencao_conventionId_jobTitle_idx"
ON "PisoSalarialConvencao"("conventionId", "jobTitle");

ALTER TABLE "PisoSalarialConvencao"
ADD CONSTRAINT "PisoSalarialConvencao_conventionId_fkey"
FOREIGN KEY ("conventionId") REFERENCES "Convencao"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
