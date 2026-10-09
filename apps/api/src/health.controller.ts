import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@eloconnect/shared';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    let database: HealthResponse['database'] = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'erro';
    }
    return { status: 'ok', database, timestamp: new Date().toISOString() };
  }
}
