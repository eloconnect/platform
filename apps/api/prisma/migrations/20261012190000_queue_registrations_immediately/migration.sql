-- New registrations enter the admin queue immediately after form submission.
-- Move pending applications created by the earlier e-mail-confirmation flow.
UPDATE "Usuario"
SET "registrationStatus" = 'PENDING_APPROVAL'
WHERE "registrationStatus" = 'PENDING_EMAIL'
  AND "registrationRequestedAt" IS NOT NULL;
