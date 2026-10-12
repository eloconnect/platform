-- Preserve existing requests as pending approval while adding an explicit
-- e-mail-confirmation state for new registrations.
ALTER TYPE "StatusCadastro" RENAME VALUE 'PENDING' TO 'PENDING_APPROVAL';
ALTER TYPE "StatusCadastro" ADD VALUE 'PENDING_EMAIL';

CREATE TYPE "FinalidadeCodigoEmail" AS ENUM ('LOGIN', 'REGISTRATION');

CREATE TABLE "DesafioCodigoEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "FinalidadeCodigoEmail" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resends" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesafioCodigoEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesafioCodigoEmail_tokenHash_key"
    ON "DesafioCodigoEmail"("tokenHash");
CREATE INDEX "DesafioCodigoEmail_userId_purpose_consumedAt_idx"
    ON "DesafioCodigoEmail"("userId", "purpose", "consumedAt");
CREATE INDEX "DesafioCodigoEmail_expiresAt_idx"
    ON "DesafioCodigoEmail"("expiresAt");

ALTER TABLE "DesafioCodigoEmail"
    ADD CONSTRAINT "DesafioCodigoEmail_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
