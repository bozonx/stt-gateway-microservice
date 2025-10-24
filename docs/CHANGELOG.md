# Changelog

## [Unreleased]

### Added

- **GraphQL API с Apollo Server** (23.10.2025)
  - Добавлен GraphQL API с использованием Apollo Server (Code First подход)
  - Поддержка Apollo Federation для интеграции в API Gateway
  - GraphQL Query `apiInfo` - метаинформация API
  - GraphQL Mutation `transcribeFile` - транскрибация аудио
  - Apollo Sandbox для разработки (доступен в development режиме)
  - Полная документация GraphQL API в `docs/GRAPHQL.md`
  - Unit и E2E тесты для GraphQL резолверов
  - Чёткое разделение: REST API в `src/modules/`, GraphQL в `src/graphql/`
  - Переиспользование бизнес-логики через существующие сервисы
  - Единая аутентификация для REST и GraphQL
  - Готовность к Apollo Federation для API Gateway

### Changed

- **Рефакторинг структуры кода** (19.10.2025)
- **Обновлен README с информацией о GraphQL API** (23.10.2025)

### Added

- **Удален встроенный rate limiting** (текущая версия)
  - Удален `@fastify/rate-limit` и связанная функциональность
  - Удалены переменные окружения `RATE_LIMIT_MAX` и `RATE_LIMIT_WINDOW`
  - Удалены тесты rate limiting
  - Обновлена документация для отражения изменений
  - Рекомендуется реализовать rate limiting на уровне API Gateway
  - Реорганизована структура `src/` в соответствии с лучшими практиками NestJS
  - Добавлены barrel exports (index.ts) для упрощения импортов
  - Извлечены утилитные функции в отдельные модули (`utils/network.utils.ts`, `utils/package-version.utils.ts`)
  - Добавлены централизованные константы (`common/constants/app.constants.ts`)
  - Оптимизированы импорты с использованием path aliases
  - Удален дублирующийся `health.controller.ts` из корня src
  - Все тесты проходят успешно (52 passed, 1 skipped)
  - Нет ошибок линтера
  - Подробности в `dev_docs/REFACTORING_2025_10_19.md`

## 0.13.2 (2025-10-18)

### Changed

- **Реорганизована Docker конфигурация**
  - Перенесены `Dockerfile` и `docker-compose.yml` в директорию `docker/`
  - `docker-compose.yml` теперь использует готовый образ `bozonx/micro-stt:latest` из Docker Hub
  - Изменён внешний порт с примеров `3000:80` на рекомендуемый `8080:80`
  - Добавлен healthcheck в `docker-compose.yml`:
    - Проверка endpoint `/api/v1/health` каждые 30 секунд
    - Период старта 40 секунд
    - 3 попытки перед пометкой как unhealthy
  - `Dockerfile` оптимизирован для использования предварительно собранного `dist/` каталога
  - Указана конкретная версия pnpm: `10.13.1`

### Documentation

- **Полностью обновлена документация по Docker**
  - Обновлён раздел "Docker Deployment" в `README.md`:
    - Добавлены инструкции по использованию готового образа
    - Добавлены команды для управления сервисом
    - Описан процесс сборки кастомного образа
    - Обновлены примеры с корректными портами и путями
  - Обновлён раздел "Docker" в `docs/ENV_SETUP.md`:
    - Два варианта конфигурации: прямое указание и через .env файл
    - Подробные инструкции по запуску и управлению
    - Примеры для сборки собственного образа
  - Создан новый документ `docs/DOCKER.md` - полное руководство по Docker:
    - Структура Docker конфигурации
    - Использование готового образа и сборка собственного
    - Конфигурация через docker-compose и docker run
    - Health checks и логирование
    - Обновление сервиса
    - Troubleshooting
    - Production рекомендации (безопасность, мониторинг, масштабирование)
  - Добавлена ссылка на `docs/DOCKER.md` в раздел "Documentation" в `README.md`

### Migration Notes

Для обновления существующих развёртываний:

1. Если вы использовали `docker-compose.yml` из корня проекта:

   ```bash
   # Остановите старый контейнер
   docker compose down

   # Перейдите в новую директорию
   cd docker

   # Обновите настройки в docker-compose.yml
   # Запустите заново
   docker compose up -d
   ```

2. Если вы собирали собственный образ:

   ```bash
   # Соберите приложение
   pnpm build

   # Соберите образ из директории docker/
   cd docker
   docker build -t micro-stt:custom -f Dockerfile ..
   ```

## 0.13.1 (2025-10-18)

### Fixed

- **Исправлена ошибка CSP при загрузке Swagger UI**: изменён способ условного добавления директивы `upgradeInsecureRequests`
  - Директива теперь добавляется через spread оператор только для production окружения
  - Исправлена ошибка: "Content-Security-Policy received an invalid directive value for upgrade-insecure-requests"
  - Использован правильный подход: `...(condition && { directive: value })` вместо тернарного оператора с `undefined`

### Improved

- **Усиленная конфигурация Helmet (следуя лучшим практикам NestJS + Fastify)**
  - Исправлена синтаксическая ошибка в CSP директиве `scriptSrc`: `'https: 'unsafe-inline''` → `'https:', 'unsafe-inline'`
  - Добавлены критичные CSP директивы для комплексной защиты:
    - `baseUri: 'self'` - защита от подмены базового URI
    - `fontSrc: 'self', https:, data:` - контроль загрузки шрифтов
    - `formAction: 'self'` - ограничение URL для отправки форм
    - `frameAncestors: 'self'` - современная защита от clickjacking (заменяет X-Frame-Options)
    - `objectSrc: 'none'` - блокировка опасных плагинов (Flash, Java)
    - `scriptSrcAttr: 'none'` - блокировка inline event handlers
    - `upgradeInsecureRequests` - автоматический апгрейд HTTP → HTTPS (только в production)
  - Добавлена явная конфигурация HSTS (Strict-Transport-Security):
    - `maxAge: 31536000` (1 год)
    - `includeSubDomains: true`
    - `preload: true` (только в production)
  - Улучшены комментарии в коде с объяснением каждой группы настроек
  - Добавлено условие для production окружения в критичных настройках безопасности

### Documentation

- Расширен раздел **HTTP Security Headers (Helmet)** в README.md
  - Детальное описание всех CSP директив
  - Документация HSTS настроек
  - Полный список дополнительных заголовков безопасности с описаниями
- Создан детальный документ анализа: `dev_docs/HELMET_ANALYSIS.md`
- Обновлен CHANGELOG.md с информацией об улучшениях и исправлениях

## 0.13.0 (2025-10-18)

### Added

- **Helmet для HTTP заголовков безопасности**: интегрирован `@fastify/helmet` для защиты от веб-уязвимостей
  - Установлен пакет `@fastify/helmet@13.0.2`
  - Настроена Content-Security-Policy (CSP) с поддержкой Swagger UI
    - `defaultSrc: 'self'` - ограничение загрузки ресурсов
    - `styleSrc: 'self', 'unsafe-inline'` - стили для Swagger UI
    - `imgSrc: 'self', data:, validator.swagger.io` - изображения для Swagger UI
    - `scriptSrc: 'self', https: 'unsafe-inline'` - скрипты для Swagger UI
  - Автоматические заголовки безопасности:
    - `X-Content-Type-Options: nosniff` - защита от MIME-sniffing
    - `X-Frame-Options` - защита от clickjacking
    - `X-DNS-Prefetch-Control` - контроль DNS prefetching
    - `Strict-Transport-Security` (HSTS) - принудительное использование HTTPS
    - `Referrer-Policy` - контроль Referer заголовка
  - Helmet зарегистрирован в `main.ts` через `app.getHttpAdapter().getInstance().register()`
  - Добавлен комментарий с обходом типизационной ошибки из-за несовместимости версий Fastify

### Improved

- Значительное улучшение безопасности микросервиса за счёт HTTP заголовков
- Защита Swagger UI документации от XSS и clickjacking атак
- Соответствие современным best practices безопасности веб-приложений
- Все тесты (unit и e2e) прошли успешно с новой конфигурацией Helmet

### Documentation

- Обновлён README.md с информацией о Helmet в разделе Security Features
- Обновлён CHANGELOG.md с детальным описанием внедрения Helmet

## 0.12.3 (2025-10-18)

### Documentation

- **Актуализирована вся документация проекта** для соответствия текущему состоянию кода
  - Обновлена версия проекта во всех файлах документации (0.11.0 → 0.12.2)
  - Исправлены default значения переменных окружения в `README.md` и `docs/ENV_SETUP.md`
    - `NODE_ENV`: default изменен на `production` (вместо `development`)
    - `LISTEN_HOST`: default изменен на `0.0.0.0` (вместо `localhost`)
    - `LISTEN_PORT`: default изменен на `80` (вместо `3000`)
  - Обновлена документация по уровням логирования: `debug`, `log`, `warn`, `error` (вместо `info`)
  - Добавлены поля `service` и `environment` в примеры JSON логов для соответствия реальному выводу Pino
  - Обновлены примеры логов в `docs/LOGGING.md` с правильным форматом timestamp и структурой
  - Улучшены примеры unit тестов в `docs/DEVELOPMENT.md` с использованием shared mock helpers
  - Добавлена информация о новых debug скриптах: `test:unit:debug`, `test:e2e:debug`
  - Добавлены актуальные метрики покрытия тестами (~87% statements, ~76% branches, ~92% functions)
  - Обновлена версия в Swagger документации (`src/main.ts`: 0.12.0 → 0.12.2)

## 0.12.2

### Improved

- **Оптимизирована конфигурация тестов** согласно результатам аудита и best practices
  - **Параллельный запуск тестов**: добавлен `maxWorkers: '50%'` для локального запуска и `maxWorkers: 2` для CI
    - Ускорение выполнения тестов на ~33% (с 10.7s до 7.2s)
  - **CI оптимизации**: добавлены `bail: 1` и `verbose: true` для быстрой обратной связи в CI/CD
  - **Улучшенные debug скрипты**: добавлены `test:debug`, `test:unit:debug`, `test:e2e:debug` с флагом `--detectOpenHandles` для поиска утечек ресурсов
  - **Shared test utilities**: создан `test/helpers/mocks.ts` с reusable mock-объектами
    - `createMockLogger()` - mock для PinoLogger
    - `createMockHttpService()` - mock для HttpService
    - `createMockConfigService(overrides)` - type-safe mock для ConfigService
  - Устранено дублирование mock объектов в unit тестах (DRY принцип)
  - Unit тесты обновлены для использования shared моков из `@test/helpers/mocks`
- Проведен детальный аудит конфигурации тестирования
  - Создан отчет `dev_docs/TESTING_AUDIT_REPORT.md` с анализом и рекомендациями
  - Общая оценка конфигурации: 4.5/5 (высокий профессиональный уровень)
  - Покрытие кода: 87.22% (statements), 76.66% (branches), 92.3% (functions)

### Documentation

- **Полная переработка документации** для соответствия лучшим практикам
  - `README.md` полностью переписан на английский для пользователей
    - Улучшена структура: Quick Start, Configuration, API Endpoints, Usage Examples
    - Добавлены детальные таблицы с переменными окружения
    - Расширены примеры использования (с/без авторизации, с timestamps, custom API keys)
    - Добавлен раздел Security Considerations с рекомендациями
    - Улучшена документация Docker deployment с примерами для Kubernetes
    - Добавлен раздел Troubleshooting с частыми проблемами
  - Создан `docs/DEVELOPMENT.md` - полное руководство для разработчиков на английском
    - Development setup и prerequisites
    - Детальная структура проекта с описанием каждой директории
    - Running locally (development/production modes)
    - Comprehensive testing guide (unit, e2e, coverage, debugging)
    - Code style standards и best practices
    - Development workflow и git practices
    - Debugging секция с VSCode configuration
    - Common tasks (update dependencies, generate modules, type checking)
    - Contributing guidelines и code review checklist
    - Troubleshooting development issues
  - Разделение concerns: README для end-users, DEVELOPMENT для разработчиков

## 0.12.2

### Improved

- **Оптимизирована конфигурация тестов** согласно best practices NestJS + Jest
  - Создан отдельный `jest.config.ts` для улучшенной читаемости и поддержки
  - Убрано дублирование конфигурации: `moduleNameMapper`, `transform`, `moduleFileExtensions` вынесены в переменные
  - Настроены **глобальные таймауты**: 5 секунд для unit тестов, 30 секунд для e2e тестов
  - Удален явный таймаут из теста `auth.e2e-spec.ts` (теперь используется глобальный)
  - Добавлены детальные комментарии в setup файлах (`test/setup/unit.setup.ts`, `test/setup/e2e.setup.ts`)
  - Удален устаревший `test/setup.ts` (используются отдельные setup для unit и e2e)
  - Добавлены исключения для coverage: `.module.ts`, `main.ts`
- Улучшена структура проекта: конфигурация тестов теперь в TypeScript файле с type-safety
- Упрощение поддержки и расширения конфигурации тестов

## 0.12.1

### Improved

- Улучшен формат даты и времени в логах согласно best practices
  - JSON логи: добавлено поле `@timestamp` с ISO 8601 UTC
  - Development логи: `pino-pretty` показывает полную дату/время в UTC
  - Унифицированный формат времени для совместимости с ELK/Loki/Otel
- Обновлена документация `docs/LOGGING.md` с новыми примерами

## 0.12.0

### Changed

- **Миграция на Pino Logger**: заменён встроенный NestJS Logger на производительный Pino
  - Установлены зависимости: `nestjs-pino@4.4.1`, `pino@9.13.1`, `pino-http@10.5.0`, `pino-pretty@13.1.2` (dev)
  - Интегрирован `LoggerModule` из `nestjs-pino` с настройкой через `ConfigService`
  - Структурированное JSON логирование в production для удобного парсинга (ELK, Grafana, CloudWatch)
  - Красивый форматированный вывод в development режиме через `pino-pretty`
  - Автоматическое логирование всех HTTP запросов с request ID и метаданными
  - Custom serializers для безопасного логирования (удаление query params, redacting sensitive headers)
  - Redaction чувствительной информации: `Authorization`, `x-api-key` заголовки
  - Автоматический выбор уровня логов на основе HTTP status code
  - Исключение health check эндпоинтов из логов в production для уменьшения шума
  - Удалён устаревший `LoggingInterceptor` (заменён на встроенные возможности Pino)
  - Все сервисы, контроллеры и провайдеры обновлены для использования `PinoLogger` через DI
  - Переход с `Logger.log()` на `PinoLogger.info()` для соответствия стандартам Pino
  - Добавлен `bufferLogs: true` в bootstrap для захвата ранних логов

### Improved

- Значительное улучшение производительности логирования (Pino — один из самых быстрых логгеров для Node.js)
- Structured logging для production: все логи в JSON формате с timestamp, context, level
- Лучшая интеграция с системами мониторинга и агрегации логов
- Правильная работа с переменной окружения `LOG_LEVEL` (debug/log/warn/error)
- Уменьшение нагрузки на I/O операции благодаря асинхронному логированию Pino
- Developer Experience: читаемые и цветные логи в development с pino-pretty
- Единая таймзона логов: добавлено принудительное использование UTC
  - В JSON логах используется ISO timestamp в UTC (`timestamp: stdTimeFunctions.isoTime`)
  - В pretty-логах установлен `translateTime: 'UTC:HH:MM:ss.l'`
  - Добавлена переменная окружения `TZ=UTC` в `Dockerfile`, `docker-compose.yml`, `env.*.example`
  - Обновлена документация (`README.md`, `docs/ENV_SETUP.md`)

### Documentation

- Добавлена документация по логированию: `docs/LOGGING.md`
  - Описание архитектуры логирования с Pino
  - Примеры структурированных логов в production
  - Настройка уровней логирования
  - Best practices для логирования в микросервисах
  - Интеграция с системами мониторинга
- Обновлён `CHANGELOG.md` с подробным описанием миграции на Pino

## 0.11.0

### Added

- **Environment-specific configuration**: добавлена поддержка разных конфигурационных файлов для разных окружений
  - `.env.development` — автоматически загружается при `NODE_ENV=development`
  - `.env.production` — автоматически загружается при `NODE_ENV=production`
  - `.env` — используется как fallback для значений по умолчанию
  - Создан `env.development.example` с оптимизированными настройками для разработки (LOG_LEVEL=debug, AUTH_ENABLED=false)
  - Создан `env.production.example` с настройками для production (LOG_LEVEL=warn, AUTH_ENABLED=true, LISTEN_HOST=0.0.0.0)
- **Configuration caching**: включено кэширование переменных окружения в `ConfigModule` для улучшения производительности
- **Comprehensive documentation**: добавлен подробный гид по настройке переменных окружения `docs/ENV_SETUP.md`
  - Полное описание всех переменных окружения
  - Рекомендации по настройке для development и production
  - Инструкции по запуску в разных окружениях
  - Troubleshooting и best practices
  - Безопасность и валидация

### Changed

- **ConfigModule**: обновлена конфигурация в `app.module.ts` для поддержки множественных env файлов
  - Добавлен `envFilePath: ['.env.${NODE_ENV}', '.env']` для автоматической загрузки environment-specific файлов
  - Файлы загружаются с приоритетом: `.env.${NODE_ENV}` → `.env` → значения по умолчанию
  - Включено `cache: true` для оптимизации производительности `ConfigService`
- **Documentation**: обновлен `README.md` с подробной информацией о конфигурации окружений
  - Добавлен раздел "Конфигурация окружений" с примерами быстрой настройки
  - Разделён раздел "Запуск" на подразделы для Development и Production
  - Добавлена ссылка на новый `docs/ENV_SETUP.md`
  - Обновлён раздел "Переменные окружения" с информацией о environment-specific файлах
- **.gitignore**: обновлены правила игнорирования для защиты всех `.env.*` файлов (кроме `.example`)

### Improved

- Следование лучшим практикам NestJS для конфигурации согласно официальной документации
- Разделение конфигураций для разработки и production по рекомендациям 12-factor app
- Улучшенная производительность за счёт кэширования переменных окружения
- Упрощение onboarding новых разработчиков за счёт готовых example файлов

## 0.10.1

### Changed

- **Команды тестирования**: реорганизована структура команд для более гибкого управления тестами
  - `pnpm test` теперь запускает и unit, и e2e тесты последовательно
  - Добавлена команда `pnpm test:unit` для запуска только unit тестов
  - Команда `pnpm test:e2e` сохранена для запуска только e2e тестов
  - Обновлена документация в README.md с подробным описанием всех команд тестирования

## 0.10.0

### Added

- Добавлена переменная окружения `AUTH_ENABLED` для управления встроенной авторизацией (по умолчанию `false`)
- Возможность отключения встроенной авторизации при использовании внешней авторизации (API Gateway, reverse proxy)
- `AUTH_TOKENS` теперь не требуется когда `AUTH_ENABLED=false`

### Changed

- **BREAKING:** Встроенная авторизация теперь **отключена по умолчанию** (`AUTH_ENABLED=false`)
- Для включения встроенной авторизации необходимо явно установить `AUTH_ENABLED=true`
- `AuthGuard` пропускает все запросы когда `AUTH_ENABLED=false`
- Логика валидации `AUTH_TOKENS` применяется только когда `AUTH_ENABLED=true`
- Обновлена документация в README.md и AUTH.md с новым значением по умолчанию

### Tests

- Добавлены unit тесты для проверки работы с `AUTH_ENABLED=false`
- Добавлен e2e тест suite `auth-disabled.e2e-spec.ts` для проверки отключённой авторизации
- Добавлены комплексные unit тесты для `AssemblyAiProvider` (`test/unit/assemblyai.provider.spec.ts`):
  - Проверка полного цикла транскрипции (queued → processing → completed)
  - Тестирование обработки различных статусов ответа API
  - Проверка корректного маппинга полей ответа AssemblyAI
  - Тестирование обработки ошибок API
  - Проверка polling логики при пустых ответах
  - Всего добавлено 11 unit тестов для покрытия логики взаимодействия с AssemblyAI API

## 0.9.0

### Added

- Добавлена авторизация с Bearer токенами для защиты эндпоинтов транскрипции
- Новая обязательная переменная окружения `AUTH_TOKENS` для списка разрешённых токенов
- Создан `AuthGuard` для проверки Bearer токенов в заголовке Authorization
- Bearer авторизация применена ко всем эндпоинтам `/api/v1/transcriptions/*`
- Добавлена документация по авторизации в Swagger UI (Bearer Auth)
- Health check эндпоинты и индекс API остаются публичными

### Changed

- Обновлена документация API в README.md с примерами использования Bearer токенов
- Обновлены примеры curl запросов с добавлением заголовка Authorization
- Расширена документация ошибок 401 (Unauthorized) в Swagger

### Tests

- Добавлены unit тесты для `AuthGuard` (`test/unit/auth.guard.spec.ts`)
- Добавлены e2e тесты для проверки авторизации (`test/e2e/auth.e2e-spec.ts`)
- Проверена работа публичных эндпоинтов без авторизации

## 0.1.0

- Scaffolded from `micro-file-cache`
- Added minimal NestJS app
- Implemented initial test endpoint
- Added unit test for controller
- Added Dockerfile and docker-compose.yml
- Added env example

## 0.2.0

### Added

- Синхронный REST эндпоинт `POST /api/v1/transcriptions/file` для транскрибации аудио по URL через AssemblyAI

## 0.3.0

### Changed

- Удалён тестовый эндпоинт `/test`

### Added

- Эндпоинт `GET /heartbeat` для проверки доступности сервиса

## 0.4.0

### Changed

- Переименована переменная окружения `STT_MAX_FILE_MB` → `STT_MAX_FILE_SIZE_MB`
- Значение по умолчанию для `ALLOW_CUSTOM_API_KEY` изменено на `true`
- Значение по умолчанию для `LISTEN_HOST` изменено на `localhost`
- Значение по умолчанию для `NODE_ENV` изменено на `production`
- Значение по умолчанию для `LOG_LEVEL` изменено на `warn`

## 0.5.0

### Added

- Переменные окружения `API_BASE_PATH` и `API_VERSION` для формирования глобального префикса API
- Глобальный префикс по умолчанию: `api/v1`
- Роут транскрибации переведён на контроллерный префикс: `POST /{API_BASE_PATH}/{API_VERSION}/transcriptions/file`
- Добавлены e2e тесты (Jest + Fastify inject): `test/e2e/health.e2e-spec.ts`
- Разделён тестовый setup на unit и e2e: `test/setup/unit.setup.ts`, `test/setup/e2e.setup.ts`; обновлены конфиги Jest и добавлен скрипт `test:e2e`

## 0.6.0

### Added

- **Централизованное логирование**: добавлен `Logger` во все сервисы (`TranscriptionService`, `AssemblyAiProvider`) с различными уровнями (log, debug, warn, error)
- **HTTP запросы логирование**: реализован `LoggingInterceptor` для автоматического логирования всех входящих HTTP запросов и ответов с измерением времени выполнения
- Логирование в `main.ts` при старте приложения с отображением конфигурации (адрес, порт, окружение, уровень логов)

### Changed

- **Рефакторинг конфигурации**: все модули конфигурации переведены на `registerAs` с namespaced подходом
  - `app.config.ts` с интерфейсом `AppConfig` (port, host, apiBasePath, apiVersion, nodeEnv, logLevel)
  - `stt.config.ts` с интерфейсом `SttConfig` (все STT-специфичные настройки)
- Конфигурация теперь загружается через `ConfigModule.load([appConfig, sttConfig])`
- `TranscriptionService` и `AssemblyAiProvider` используют `ConfigService` вместо прямого доступа к `process.env`
- `LoggingInterceptor` зарегистрирован глобально через `APP_INTERCEPTOR` в `AppModule`

### Improved

- Улучшена тестируемость за счет использования DI для конфигурации
- Добавлены подробные логи на всех этапах обработки транскрибации
- Добавлены unit тесты для `LoggingInterceptor` (100% покрытие)

## 0.7.0

### Added

- **Provider Pattern**: реализован паттерн Factory Provider для STT провайдеров
  - Добавлен токен инжекции `STT_PROVIDER` в `common/constants/tokens.ts`
  - `TranscriptionModule` теперь использует `useFactory` для создания провайдеров
  - Упрощено добавление новых провайдеров в будущем
- **Global Exception Filter**: добавлен централизованный обработчик исключений `AllExceptionsFilter`
  - Унифицированный формат ошибок для всех эндпоинтов
  - Автоматическое логирование ошибок с различными уровнями (warn для 4xx, error для 5xx)
  - Поддержка Fastify-специфичных ответов
- **Professional Health Checks**: интегрирован `@nestjs/terminus` для мониторинга
  - Создан отдельный `HealthModule` с тремя эндпоинтами:
    - `GET /health` - полная проверка здоровья с пингом AssemblyAI API
    - `GET /health/ready` - проверка готовности к обработке запросов (readiness probe)
    - `GET /health/live` - проверка работоспособности сервиса (liveness probe)
  - Поддержка Kubernetes health probes

### Changed

- `TranscriptionService` использует инжекцию провайдера через токен `@Inject(STT_PROVIDER)` вместо прямой зависимости от `AssemblyAiProvider`
- Удалён старый самописный `HealthController` из корня `src/`
- `AppModule` теперь регистрирует `AllExceptionsFilter` глобально через `APP_FILTER`
- `AppModule` использует новый `HealthModule` вместо старого контроллера

### Improved

- Улучшена архитектура: провайдеры теперь легко расширяемы и тестируемы
- Стандартизирована обработка ошибок по всему приложению
- Health checks теперь соответствуют best practices NestJS и Kubernetes

## 0.8.0

### Added

- **Swagger/OpenAPI документация**: полная интеграция документации API
  - Установлен пакет `@nestjs/swagger@11.2.1`
  - Настроен `SwaggerModule` в `main.ts` с детальной конфигурацией
  - Добавлены декораторы `@ApiProperty` и `@ApiPropertyOptional` к `TranscribeFileDto`
  - Создан `TranscriptionResponseDto` с полным описанием структуры ответа транскрибации
  - Добавлены декораторы к `TranscriptionController`:
    - `@ApiTags`, `@ApiOperation` для описания эндпоинтов
    - `@ApiResponse`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiGatewayTimeoutResponse`, `@ApiServiceUnavailableResponse` для документирования всех возможных ответов
  - Добавлены декораторы к `HealthController` с примерами ответов
  - Документация доступна по адресу: `http://localhost:3000/api/docs`
  - Настроена кастомизация Swagger UI (скрытие topbar, сортировка тегов, фильтрация, время выполнения запросов)

### Improved

- API теперь полностью задокументирован с примерами запросов и ответов
- Все эндпоинты имеют детальные описания и информацию о возможных ошибках
- Улучшена читаемость кода за счёт явного указания типов возврата в контроллерах
- Добавлены метаданные проекта в Swagger (заголовок, описание, версия, контакты, лицензия)

## 0.8.2

### Added

- **Path Aliases**: добавлена поддержка path aliases для более чистых импортов
  - Настроены aliases: `@/*`, `@common/*`, `@modules/*`, `@config/*`, `@providers/*`, `@test/*`
  - Обновлены все импорты в исходном коде и тестах
  - Настроен `moduleNameMapper` в Jest для корректной работы тестов
  - Улучшена читаемость кода за счет замены относительных путей на алиасы

### Changed

- Добавлен корневой эндпоинт индекса API: `GET /{API_BASE_PATH}/{API_VERSION}` (по умолчанию `GET /api/v1`)
  - Возвращает компактный JSON с метаданными сервиса и полезными ссылками (`self`, `docs`, `health`, `transcriptions`)
  - Без редиректов, стабильный для машинных клиентов

### Removed

- Удален устаревший unit тест `test/unit/app.controller.spec.ts` (функциональность покрыта e2e тестами)

## 0.8.1

### Fixed

- **Graceful Shutdown**: добавлена корректная обработка сигналов SIGTERM и SIGINT
  - Реализован `app.enableShutdownHooks()` для активации lifecycle hooks
  - Добавлена обработка сигналов завершения с логированием и корректным закрытием соединений
  - Предотвращение потери данных при перезапуске (Kubernetes-ready)
- **Jest Configuration**: исправлен deprecated синтаксис в конфигурации тестов
  - Заменен `globals.ts-jest` на новый синтаксис `transform` в `package.json`
  - Обновлена конфигурация в `test/jest-e2e.json` для соответствия ts-jest v29+
  - Устранены предупреждения при запуске тестов

### Added

- **Config Validation**: добавлена валидация конфигурации при старте приложения
  - `AppConfig` класс с декораторами валидации (`@IsInt`, `@IsString`, `@IsIn`, `@Min`, `@Max`)
  - `SttConfig` класс с детальной валидацией всех параметров
  - Валидация порта (1-65535), nodeEnv (development/production/test), logLevel (debug/log/warn/error)
  - Валидация STT параметров: maxFileMb (1-1000), requestTimeoutSec (1-300), pollIntervalMs (100-10000)
  - Fail-fast подход: приложение не запустится с некорректной конфигурацией
  - Информативные сообщения об ошибках валидации при старте
- **Documentation**: создан `dev_docs/AUDIT_FIXES.md` с детальным описанием всех исправлений

### Improved

- Улучшена надежность приложения за счет валидации конфигурации
- Предотвращение runtime ошибок из-за некорректных значений конфигурации
- Корректная обработка завершения работы в production окружении
- Соответствие современным best practices NestJS + TypeScript + Jest
