import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FINANCIAL_ACCESS_KEY = 'requireFinancialAccess';

export const RequireFinancialAccess = () =>
  SetMetadata(REQUIRE_FINANCIAL_ACCESS_KEY, true);
