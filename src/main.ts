import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from '@fastify/helmet';
import { AppModule } from '@/app.module';
import type { AppConfig } from '@config/app.config';
import { readPackageVersion } from '@/utils/package-version.utils';

async function bootstrap() {
  // Create app with bufferLogs enabled to capture early logs
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  // Use Pino logger for the entire application
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  const appConfig = configService.get<AppConfig>('app')!;

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Register Helmet for security headers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(helmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        baseUri: [`'self'`],
        fontSrc: [`'self'`, 'https:', 'data:'],
        formAction: [`'self'`],
        frameAncestors: [`'self'`],
        imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
        objectSrc: [`'none'`],
        scriptSrc: [
          `'self'`,
          'https:',
          appConfig.nodeEnv !== 'production' ? `'unsafe-inline'` : undefined,
        ].filter(Boolean) as string[],
        scriptSrcAttr: [`'none'`],
        styleSrc: [
          `'self'`,
          'https:',
          appConfig.nodeEnv !== 'production' ? `'unsafe-inline'` : undefined,
        ].filter(Boolean) as string[],
        ...(appConfig.nodeEnv === 'production' && { upgradeInsecureRequests: [] }),
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: appConfig.nodeEnv === 'production',
    },
  });

  // Configure global API prefix from configuration
  const globalPrefix = `${appConfig.apiBasePath}/${appConfig.apiVersion}`;
  app.setGlobalPrefix(globalPrefix);

  // Setup Swagger/OpenAPI documentation
  const version = readPackageVersion();
  const config = new DocumentBuilder()
    .setTitle('Micro STT API')
    .setDescription(
      'Speech-to-Text microservice API for transcribing audio files. ' +
        'Supports multiple STT providers and provides asynchronous transcription with polling.',
    )
    .setVersion(version)
    .addTag('Transcriptions', 'Endpoints for transcribing audio files')
    .addTag('Health', 'Health check endpoints for monitoring and orchestration')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your authorization token',
      },
      'bearer',
    )
    .addServer(`http://${appConfig.host}:${appConfig.port}`, 'Local development server')
    .addServer('/', 'Current server')
    .setContact('Ivan K.', '', '')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Micro STT API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(appConfig.port, appConfig.host);

  logger.log(
    `🚀 Micro STT service is running on: http://${appConfig.host}:${appConfig.port}/${globalPrefix}`,
    'Bootstrap',
  );
  logger.log(
    `📚 API Documentation available at: http://${appConfig.host}:${appConfig.port}/api/docs`,
    'Bootstrap',
  );
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap');
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap');

  // Rely on enableShutdownHooks for graceful shutdown
}

void bootstrap();
