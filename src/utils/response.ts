import { Response } from 'express'

export const successResponse = (res: Response, data: any, message?: string) => {
  return res.status(200).json({
    success: true,
    message,
    data
  })
}

export const createdResponse = (res: Response, data: any, message?: string) => {
  return res.status(201).json({
    success: true,
    message,
    data
  })
}

export const errorResponse = (res: Response, message: string, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    error: message
  })
}
