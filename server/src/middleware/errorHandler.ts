import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Server error:', err.message);
  console.error(err.stack);

  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `接口不存在: ${req.method} ${req.path}` });
}
