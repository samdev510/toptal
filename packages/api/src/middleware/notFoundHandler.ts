import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/** JSON 404 for unmatched routes (Express default is HTML). */
export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'Not found'));
}
