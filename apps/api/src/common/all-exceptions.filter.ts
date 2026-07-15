import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

// Global error filter: instead of a bare "Internal server error", surface the
// real message and error code (e.g. Prisma P2022 = coluna em falta). Makes
// diagnostics immediate on screen.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    // Known HTTP exceptions pass through as-is.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body: any = exception.getResponse();
      return res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
    }

    // Everything else = 500. Include message + code for diagnosis.
    const code = exception?.code || exception?.errorCode || undefined; // ex: Prisma P2022
    const message = exception?.message || 'Erro interno';
    const hint =
      code && String(code).startsWith('P')
        ? ' (base de dados desatualizada — corre `bash scripts/deploy.sh --no-cache` para o db push)'
        : '';
    this.logger.error(`${req?.method} ${req?.url} -> ${code || ''} ${message}`);
    return res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      code: code || null,
      message: `${message}${code ? ` [${code}]` : ''}${hint}`,
    });
  }
}
