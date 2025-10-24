import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Health check controller using NestJS Terminus
 * Provides standardized health check endpoints
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly serviceStartMs = Date.now();

  constructor(private readonly health: HealthCheckService) {}

  /**
   * Basic health check endpoint
   * Returns service status
   * Note: This is a basic check. External service dependencies
   * should be monitored separately in production
   */
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the overall health status of the service',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'ok',
        info: { service: { status: 'up' } },
        error: {},
        details: { service: { status: 'up' } },
      },
    },
  })
  public async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Basic service health - always up if the service is running
      () => ({ service: { status: 'up' } }),
    ]);
  }

  /**
   * Readiness probe endpoint
   * Checks if the service is ready to accept requests
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Checks if the service is ready to accept requests (for Kubernetes readiness probes)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is ready',
    schema: {
      example: {
        status: 'ok',
        info: { ready: { status: 'up' } },
        error: {},
        details: { ready: { status: 'up' } },
      },
    },
  })
  public async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      // Add any readiness checks here
      // For now, just return a basic check
      () => ({ ready: { status: 'up' } }),
    ]);
  }

  /**
   * Liveness probe endpoint
   * Simple check to verify the service is running
   */
  @Get('live')
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Simple check to verify the service is running and includes uptime (for Kubernetes liveness probes)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
    schema: {
      example: {
        status: 'ok',
        info: { uptime: { status: 'up', uptime: 123456 } },
        error: {},
        details: { uptime: { status: 'up', uptime: 123456 } },
      },
    },
  })
  public async live(): Promise<HealthCheckResult> {
    const uptime = Date.now() - this.serviceStartMs;
    return this.health.check([() => ({ uptime: { status: 'up', uptime } })]);
  }
}
