import { RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import * as authService from './auth.service';

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.register(email, password);
  res.status(201).json(result);
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json(result);
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const tokens = await authService.refresh(refreshToken);
  res.json(tokens);
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  res.status(204).send();
});
