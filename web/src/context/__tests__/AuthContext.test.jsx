import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider, useAuthContext } from '../AuthContext';

const mocks = vi.hoisted(() => ({
  firebaseService: {
    isAuthenticated: vi.fn(),
    getStoredUser: vi.fn(),
    updateProfile: vi.fn(),
    signOut: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
  },
}));

vi.mock('../../services/firebaseService', () => ({
  default: mocks.firebaseService,
}));

const TestConsumer = () => {
  const { user, updateProfile } = useAuthContext();

  return (
    <div>
      <div data-testid="display-name">{user?.displayName || ''}</div>
      <button
        onClick={() => updateProfile({
          displayName: 'Updated Name',
          location: { region: 'NCR', province: 'Metro Manila', city: 'Taguig City' },
        })}
      >
        Update
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    mocks.firebaseService.isAuthenticated.mockReturnValue(true);
    mocks.firebaseService.getStoredUser.mockReturnValue({
      _id: 'user-1',
      displayName: 'Initial User',
    });
    mocks.firebaseService.updateProfile.mockResolvedValue({
      success: true,
      data: {
        _id: 'user-1',
        displayName: 'Updated Name',
        location: { region: 'NCR', province: 'Metro Manila', city: 'Taguig City' },
      },
    });
  });

  it('updates user profile state and persists to localStorage when local session exists', async () => {
    localStorage.setItem('userData', JSON.stringify({ _id: 'user-1', displayName: 'Initial User' }));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-name')).toHaveTextContent('Initial User');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(screen.getByTestId('display-name')).toHaveTextContent('Updated Name');
      const stored = JSON.parse(localStorage.getItem('userData'));
      expect(stored.location).toEqual({
        region: 'NCR',
        province: 'Metro Manila',
        city: 'Taguig City',
      });
    });
  });
});
