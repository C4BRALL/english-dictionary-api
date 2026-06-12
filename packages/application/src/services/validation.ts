import { ValidationError } from '../errors/application.error.js';
import type { PageRequest } from '../models/pagination.js';

export function validateName(value: string): string {
  const name = value.trim();

  if (name.length < 2 || name.length > 100) {
    throw new ValidationError('Name must contain between 2 and 100 characters');
  }

  return name;
}

export function validatePassword(value: string): void {
  if (value.length < 8 || value.length > 128) {
    throw new ValidationError('Password must contain between 8 and 128 characters');
  }
}

export function validatePage(request: PageRequest): PageRequest {
  if (
    !Number.isInteger(request.page) ||
    !Number.isInteger(request.limit) ||
    request.page < 1 ||
    request.limit < 1 ||
    request.limit > 100
  ) {
    throw new ValidationError('Page must be positive and limit must be between 1 and 100');
  }

  return request;
}
