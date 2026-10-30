import { SetMetadata } from '@nestjs/common';
import { REQUIRE_FINANCIAL_ACCESS_KEY } from './require-access.constants.js';

export { REQUIRE_FINANCIAL_ACCESS_KEY };

export const RequireFinancialAccess = () =>
  SetMetadata(REQUIRE_FINANCIAL_ACCESS_KEY, true);
