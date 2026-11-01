-- Boleto que passou da validade de 30 dias sem pagamento (RN03, RN09, RF16).

-- AlterEnum
ALTER TYPE "EventoTransacao" ADD VALUE 'EXPIRADO';

-- AlterEnum
ALTER TYPE "StatusBoleto" ADD VALUE 'EXPIRADO';
