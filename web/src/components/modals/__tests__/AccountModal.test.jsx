import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import SettingsPage from '../../../pages/user/SettingsPage';

const mocks = vi.hoisted(() => ({
  auth: {
    user: {
      _id: 'user-1',
      role: 'user',
      email: 'user@example.com',
      displayName: 'Test User',
      location: {
        region: 'NCR',
        province: 'Metro Manila',
        city: 'Taguig City',
      },
    },
    updateProfile: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams('tab=account'), vi.fn()],
  };
});

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.auth.user,
    updateProfile: mocks.auth.updateProfile,
  }),
}));

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({
    success: mocks.toast.success,
    error: mocks.toast.error,
    info: mocks.toast.info,
  }),
}));

vi.mock('../../../context/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: {},
    updatePreferenceSection: vi.fn(),
    chatbotEnabled: true,
  }),
}));

vi.mock('../../common/AutocompleteInput', () => ({
  default: ({ value, onChange, placeholder, disabled }) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}));

vi.mock('../../common/ProfilePicture', () => ({
  default: () => <div data-testid="profile-picture" />,
}));

vi.mock('../../common/Loading', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('../../overlays/RestrictedOverlay', () => ({
  default: () => null,
}));

vi.mock('../../../services/imageService', () => ({
  imageService: {
    deleteAvatar: vi.fn(),
  },
}));

vi.mock('../../../services/authService', () => ({
  authService: {
    changePassword: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
    onAuthStateChanged: (callback) => {
      callback(null);
      return () => {};
    },
  })),
}));

describe('SettingsPage (Account Tab)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.updateProfile.mockResolvedValue({ success: true });
  });

  it('hydrates region/province/city inputs from user location', async () => {
    render(<SettingsPage />);

    expect(screen.getByPlaceholderText('Type region name...')).toHaveValue('NCR');
    expect(screen.getByPlaceholderText('Type province name...')).toHaveValue('Metro Manila');
    expect(screen.getByPlaceholderText('Type city name...')).toHaveValue('Taguig City');
  });

  it('saves full location object with region, province, and city', async () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByPlaceholderText('Type region name...'), {
      target: { value: 'CALABARZON' },
    });
    fireEvent.change(screen.getByPlaceholderText('Type province name...'), {
      target: { value: 'Laguna' },
    });
    fireEvent.change(screen.getByPlaceholderText('Type city name...'), {
      target: { value: 'Calamba City' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mocks.auth.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Test User',
          location: {
            region: 'CALABARZON',
            province: 'Laguna',
            city: 'Calamba City',
          },
        })
      );
      expect(mocks.toast.success).toHaveBeenCalledWith('Profile updated successfully.');
    });
  });
});
