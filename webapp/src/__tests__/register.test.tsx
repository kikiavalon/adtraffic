import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from '../pages/Register.js';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    register: mockRegister,
    isLoading: false,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

describe('Register', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockNavigate.mockReset();
  });

  it('renders name, email, and password inputs', () => {
    renderRegister();
    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@agency.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min 8 characters')).toBeInTheDocument();
  });

  it('renders create account button', () => {
    renderRegister();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('calls register() with form values on submit', async () => {
    mockRegister.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByPlaceholderText('Your name'), 'Test User');
    await user.type(screen.getByPlaceholderText('you@agency.com'), 'test@agency.com');
    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockRegister).toHaveBeenCalledWith('test@agency.com', 'password123', 'Test User');
  });

  it('navigates to / on successful register', async () => {
    mockRegister.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByPlaceholderText('Your name'), 'Test User');
    await user.type(screen.getByPlaceholderText('you@agency.com'), 'test@agency.com');
    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows error message on register failure', async () => {
    mockRegister.mockRejectedValue(new Error('Email already exists'));
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByPlaceholderText('Your name'), 'Test');
    await user.type(screen.getByPlaceholderText('you@agency.com'), 'dup@test.com');
    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already exists');
  });

  it('has a link to /login', () => {
    renderRegister();
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });
});
