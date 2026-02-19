import { describe, it, expect } from 'vitest';
import {
  CM360NotConnectedError,
  CM360TokenRevokedError,
  CM360APIError,
  isGoogleAPIError,
  extractGoogleErrorMessage,
} from '../cm360/errors.js';

describe('CM360 Error Classes', () => {
  describe('CM360NotConnectedError', () => {
    it('should have the correct message', () => {
      const error = new CM360NotConnectedError();
      expect(error.message).toBe('CM360 account not connected. Please connect your account in Settings.');
      expect(error.name).toBe('CM360NotConnectedError');
    });

    it('should be an instance of Error', () => {
      const error = new CM360NotConnectedError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CM360NotConnectedError);
    });
  });

  describe('CM360TokenRevokedError', () => {
    it('should have the correct message', () => {
      const error = new CM360TokenRevokedError();
      expect(error.message).toBe('Your CM360 access has been revoked. Please reconnect in Settings.');
      expect(error.name).toBe('CM360TokenRevokedError');
    });

    it('should be an instance of Error', () => {
      const error = new CM360TokenRevokedError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CM360TokenRevokedError);
    });
  });

  describe('CM360APIError', () => {
    it('should store statusCode', () => {
      const error = new CM360APIError('Not found', 404);
      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('CM360APIError');
    });

    it('should store optional apiErrorCode', () => {
      const error = new CM360APIError('Rate limited', 429, 'RATE_LIMIT_EXCEEDED');
      expect(error.apiErrorCode).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should default apiErrorCode to undefined', () => {
      const error = new CM360APIError('Server error', 500);
      expect(error.apiErrorCode).toBeUndefined();
    });

    it('should be an instance of Error', () => {
      const error = new CM360APIError('Bad request', 400);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CM360APIError);
    });
  });

  describe('isGoogleAPIError', () => {
    it('should return true for objects with code and message', () => {
      expect(isGoogleAPIError({ code: 404, message: 'Not found' })).toBe(true);
    });

    it('should return true for objects with code, message, and errors array', () => {
      expect(isGoogleAPIError({
        code: 400,
        message: 'Bad request',
        errors: [{ message: 'Invalid field', reason: 'invalid' }],
      })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isGoogleAPIError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isGoogleAPIError(undefined)).toBe(false);
    });

    it('should return false for strings', () => {
      expect(isGoogleAPIError('error')).toBe(false);
    });

    it('should return false for objects without code', () => {
      expect(isGoogleAPIError({ message: 'No code' })).toBe(false);
    });

    it('should return false for objects with non-number code', () => {
      expect(isGoogleAPIError({ code: '404', message: 'String code' })).toBe(false);
    });

    it('should return false for objects without message', () => {
      expect(isGoogleAPIError({ code: 404 })).toBe(false);
    });
  });

  describe('extractGoogleErrorMessage', () => {
    it('should return the first specific error message when available', () => {
      const err = {
        message: 'Top-level message',
        errors: [
          { message: 'Specific error detail', reason: 'invalid' },
          { message: 'Another error', reason: 'notFound' },
        ],
      };
      expect(extractGoogleErrorMessage(err)).toBe('Specific error detail');
    });

    it('should fall back to top-level message when no errors array', () => {
      const err = { message: 'Top-level message' };
      expect(extractGoogleErrorMessage(err)).toBe('Top-level message');
    });

    it('should fall back to top-level message when errors array is empty', () => {
      const err = { message: 'Top-level message', errors: [] };
      expect(extractGoogleErrorMessage(err)).toBe('Top-level message');
    });
  });
});
