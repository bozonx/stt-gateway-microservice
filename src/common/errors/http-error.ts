/**
 * Platform-agnostic HTTP error class
 * Replaces NestJS HttpException, BadRequestException, etc.
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request') {
    super(400, message)
    this.name = 'BadRequestError'
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, message)
    this.name = 'UnauthorizedError'
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = 'Service Unavailable') {
    super(503, message)
    this.name = 'ServiceUnavailableError'
  }
}

export class GatewayTimeoutError extends HttpError {
  constructor(message = 'Gateway Timeout') {
    super(504, message)
    this.name = 'GatewayTimeoutError'
  }
}

export class ClientClosedRequestError extends HttpError {
  constructor(message = 'CLIENT_CLOSED_REQUEST') {
    super(499, message)
    this.name = 'ClientClosedRequestError'
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error') {
    super(500, message)
    this.name = 'InternalServerError'
  }
}
