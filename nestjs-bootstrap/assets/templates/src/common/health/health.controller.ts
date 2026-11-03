import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; uptime: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
