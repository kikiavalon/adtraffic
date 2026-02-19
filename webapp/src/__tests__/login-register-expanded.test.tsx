import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login.js';
import Register from '../pages/Register.js';

// --- Login tests ---

let mockIsLoading = false;
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    isLoading: mockIsLoading,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

describe('Login — expanded', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockNavigate.mockReset();
    mockIsLoading = false;
  });

  it('shows "Signing in..." when loading', () => {
    mockIsLoading = true;
    renderLogin();
    expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
  });

  it('disables submit button when loading', () => {
    mockIsLoading = true;
    renderLogin();
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  it('email input has type="email"', () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText('you@agency.com');
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('password input has type="password"', () => {
    renderLogin();
    const passwordInput = screen.getByPlaceholderText('Min 8 characters');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('password input has minLength=8', () => {
    renderLogin();
    const passwordInput = screen.getByPlaceholderText('Min 8 characters');
    expect(passwordInput).toHaveAttribute('minLength', '8');
  });

  it('email input has required attribute', () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText('you@agency.com');
    expect(emailInput).toBeRequired();
  });

  it('password input has required attribute', () => {
    renderLogin();
    const passwordInput = screen.getByPlaceholderText('Min 8 characters');
    expect(passwordInput).toBeRequired();
  });

  it('clears error on new submission', async () => {
    // First attempt fails
    mockLogin.mockRejectedValueOnce(new Error('Wrong password'));
    // Second attempt succeeds
    mockLogin.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    renderLogin();

    // First attempt
    await user.type(screen.getByPlaceholderText('you@agency.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong password');

    // Clear and retry
    await user.clear(screen.getByPlaceholderText('Min 8 characters'));
    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'rightpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Error should be cleared (the new submit calls setError(''))
    // If the second login succeeds, the error should be gone
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles non-Error thrown objects gracefully', async () => {
    mockLogin.mockRejectedValue('String error');

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText('you@agency.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'password1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Login failed');
  });
});

describe('Register — expanded', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockNavigate.mockReset();
    mockIsLoading = false;
  });

  it('shows "Creating account..." when loading', () => {
    mockIsLoading = true;
    renderRegister();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument();
  });

  it('disables submit button when loading', () => {
    mockIsLoading = true;
    renderRegister();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });

  it('name input has required attribute', () => {
    renderRegister();
    const nameInput = screen.getByPlaceholderText('Your name');
    expect(nameInput).toBeRequired();
  });

  it('name input has type="text"', () => {
    renderRegister();
    const nameInput = screen.getByPlaceholderText('Your name');
    expect(nameInput).toHaveAttribute('type', 'text');
  });

  it('email input has type="email"', () => {
    renderRegister();
    const emailInput = screen.getByPlaceholderText('you@agency.com');
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('password input has minLength=8', () => {
    renderRegister();
    const passwordInput = screen.getByPlaceholderText('Min 8 characters');
    expect(passwordInput).toHaveAttribute('minLength', '8');
  });

  it('clears error on new submission', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Email exists'));
    mockRegister.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    renderRegister();

    // First attempt
    await user.type(screen.getByPlaceholderText('Your name'), 'Test');
    await user.type(screen.getByPlaceholderText('you@agency.com'), 'dup@test.com');
    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'password1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email exists');

    // Clear email and retry
    await user.clear(screen.getByPlaceholderText('you@agency.com'));
    await user.type(screen.getByPlaceholderText('you@agency.com'), 'new@test.com');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Error should be cleared
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles non-Error thrown objects gracefully', async () => {
    mockRegister.mockRejectedValue('String error');

    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByPlaceholderText('Your name'), 'Test');
    await user.type(screen.getByPlaceholderText('you@agency.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'password1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Registration failed');
  });
});
