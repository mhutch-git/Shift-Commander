import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.session.role ?? "")) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}
