import { Request, Response, NextFunction } from 'express'
import { getUserFromToken } from '../config/supabase'

export interface AuthRequest extends Request {
  user?: any
}

// Authenticate user from Bearer token
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.replace('Bearer ', '')
    const user = await getUserFromToken(token)
    
    req.user = user
    next()
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Require admin role
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }

  next()
}

// Require employee role (or admin)
export const requireEmployee = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  if (req.user.role !== 'employee' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Employee access required' })
  }

  next()
}
