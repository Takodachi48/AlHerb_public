import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePreferences } from '../../context/PreferencesContext';
import { useToast } from '../../hooks/useToast';
import Toggle from '../../components/common/Toggle';
import CustomDropdown from '../../components/common/Dropdown';
import ProfilePicture from '../../components/common/ProfilePicture';
import Loading from '../../components/common/Loading';
import AutocompleteInput from '../../components/common/AutocompleteInput';
import TabNavigation from '../../components/common/TabNavigation';
import Button from '../../components/common/Button';
import RestrictedOverlay from '../../components/overlays/RestrictedOverlay';
import Input from '../../components/common/Input';
import { PHILIPPINE_LOCATIONS } from '../../../../shared/constants/philippine-locations';
import { imageService } from '../../services/imageService';
import { authService } from '../../services/authService';
import { getAuth } from 'firebase/auth';

const VALID_TABS = ['account', 'settings'];
const THEME_OPTIONS = [
  {
    value: 'theme1',
    brand: '#6a7a6f',
    accent: '#7f9052'
  },
  {
    value: 'theme2',
    brand: '#6d757e',
    accent: '#bb7b78'
  },
  {
    value: 'theme8',
    brand: '#716a81',
    accent: '#eb7615'
  }
];

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, updateProfile } = useAuth();
  const { preferences, updatePreferenceSection, chatbotEnabled } = usePreferences();
  const { success, error, info } = useToast();
  const isAdmin = true;

  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab');
    return VALID_TABS.includes(tab) ? tab : 'account';
  }, [searchParams]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!VALID_TABS.includes(tab)) {
      setSearchParams({ tab: 'account' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || '');
  const [tempPhotoURL, setTempPhotoURL] = useState(null);
  const [tempBannerURL, setTempBannerURL] = useState(null);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');
  const [accountStatus, setAccountStatus] = useState({ type: '', message: '' });
  const [isGoogleUser, setIsGoogleUser] = useState(() => {
    // Initialize from localStorage to prevent flicker
    const cached = localStorage.getItem('isGoogleUser');
    return cached === 'true';
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [bio, setBio] = useState(user?.profile?.bio || '');

  const [city, setCity] = useState(user?.location?.city || '');
  const [province, setProvince] = useState(user?.location?.province || '');
  const [region, setRegion] = useState(user?.location?.region || '');

  const initialProfileRef = useRef(null);
  const tempUploadsRef = useRef({ photo: null, banner: null });

  const normalizeText = (value) => (typeof value === 'string' ? value : '');
  const normalizeUrl = (value) => (typeof value === 'string' && value.trim().length ? value : null);

  const hasChanges = useMemo(() => {
    const initial = initialProfileRef.current;
    if (!initial) return false;

    return (
      normalizeText(displayName) !== initial.displayName ||
      normalizeText(bio) !== initial.bio ||
      normalizeText(region) !== initial.region ||
      normalizeText(province) !== initial.province ||
      normalizeText(city) !== initial.city ||
      (tempPhotoURL && tempPhotoURL !== initial.photoURL) ||
      (tempBannerURL && tempBannerURL !== initial.bannerURL)
    );
  }, [displayName, bio, region, province, city, tempPhotoURL, tempBannerURL]);

  useEffect(() => {
    if (!user) return;

    const nextDisplayName = normalizeText(user.displayName || user.name);
    const nextBio = user?.profile && 'bio' in user.profile
      ? normalizeText(user.profile.bio)
      : '';
    const nextRegion = normalizeText(user?.location?.region);
    const nextProvince = normalizeText(user?.location?.province);
    const nextCity = normalizeText(user?.location?.city);
    const nextPhotoURL = normalizeUrl(user?.photoURL);
    const nextBannerURL = normalizeUrl(user?.bannerURL);

    setDisplayName(nextDisplayName);
    setBio(nextBio);
    setRegion(nextRegion);
    setProvince(nextProvince);
    setCity(nextCity);

    if (!initialProfileRef.current) {
      initialProfileRef.current = {
        displayName: nextDisplayName,
        bio: nextBio,
        region: nextRegion,
        province: nextProvince,
        city: nextCity,
        photoURL: nextPhotoURL,
        bannerURL: nextBannerURL,
      };
    }

    if (localStorage.getItem('tempBannerURL')) {
      localStorage.removeItem('tempBannerURL');
    }
    setTempBannerURL(null);
  }, [user]);

  useEffect(() => {
    tempUploadsRef.current = {
      photo: tempPhotoURL,
      banner: tempBannerURL,
    };
  }, [tempPhotoURL, tempBannerURL]);

  const cleanupTempUpload = async (type, url) => {
    if (!url) return;
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return;
    if (type === 'photo' && normalizedUrl === normalizeUrl(user?.photoURL)) return;
    if (type === 'banner' && normalizedUrl === normalizeUrl(user?.bannerURL)) return;
    try {
      await imageService.deleteTempImage(normalizedUrl);
    } catch (cleanupError) {
      console.error(`Failed to delete temp ${type}:`, cleanupError);
    }
  };

  useEffect(() => () => {
    const { photo, banner } = tempUploadsRef.current || {};
    if (photo) cleanupTempUpload('photo', photo);
    if (banner) cleanupTempUpload('banner', banner);
    if (banner) localStorage.removeItem('tempBannerURL');
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        const providerIds = firebaseUser.providerData?.map((provider) => provider?.providerId).filter(Boolean) || [];
        const isGoogle = providerIds.includes('google.com');
        setIsGoogleUser(isGoogle);
        localStorage.setItem('isGoogleUser', isGoogle.toString());
      } else {
        setIsGoogleUser(false);
        localStorage.setItem('isGoogleUser', 'false');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRegionChange = (newRegion) => {
    setRegion(newRegion);
    setProvince('');
    setCity('');
  };

  const handleProvinceChange = (newProvince) => {
    setProvince(newProvince);
    setCity('');
  };

  const getFilteredProvinces = () => {
    if (!region) return PHILIPPINE_LOCATIONS.provinces;
    const regionProvinces = PHILIPPINE_LOCATIONS.regionToProvinces[region] || [];
    return [...PHILIPPINE_LOCATIONS.provinces.filter((candidateProvince) => regionProvinces.includes(candidateProvince))];
  };

  const getFilteredCities = () => {
    if (!province) return PHILIPPINE_LOCATIONS.cities;
    const provinceCities = PHILIPPINE_LOCATIONS.provinceToCities[province] || [];
    return [...PHILIPPINE_LOCATIONS.cities.filter((candidateCity) => provinceCities.includes(candidateCity))];
  };

  const handleSaveChanges = async () => {
    if (!user) return;

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setDisplayNameError('Please enter your name.');
      setAccountStatus({ type: '', message: '' });
      return;
    }

    setIsSaving(true);
    setDisplayNameError('');
    setAccountStatus({ type: '', message: '' });
    try {
      const profileData = { displayName: trimmedName };

      if (region) {
        profileData.location = {
          region,
          province,
          city
        };
      }

      if (tempPhotoURL) {
        if (user.photoURL) {
          try {
            await imageService.deleteAvatar();
          } catch (deleteError) {
            console.error('Failed to delete old avatar:', deleteError);
          }
        }
        profileData.photoURL = tempPhotoURL;
      }

      if (tempBannerURL) {
        if (user.bannerURL) {
          try {
            await imageService.deleteBanner();
          } catch (deleteError) {
            console.error('Failed to delete old banner:', deleteError);
          }
        }
        profileData.bannerURL = tempBannerURL;
      }

      profileData.profile = { bio };

      const result = await updateProfile(profileData);
      if (result.success) {
        setAccountStatus({ type: 'success', message: 'Profile updated successfully.' });
        success('Profile updated successfully.');
        // Clear temporary uploads from localStorage after successful save
        if (tempBannerURL) {
          localStorage.removeItem('tempBannerURL');
        }
        setTempPhotoURL(null);
        setTempBannerURL(null);
        initialProfileRef.current = {
          displayName: trimmedName,
          bio: normalizeText(bio),
          region: normalizeText(region),
          province: normalizeText(province),
          city: normalizeText(city),
          photoURL: normalizeUrl(tempPhotoURL || user?.photoURL),
          bannerURL: normalizeUrl(tempBannerURL || user?.bannerURL),
        };
      } else {
        throw new Error(result.error || 'Profile update failed');
      }
    } catch (updateError) {
      setAccountStatus({
        type: 'error',
        message: updateError?.message || 'Failed to update profile.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTempProfilePictureUpload = (newPhotoURL) => {
    if (tempPhotoURL && tempPhotoURL !== newPhotoURL) {
      cleanupTempUpload('photo', tempPhotoURL);
    }
    setTempPhotoURL(newPhotoURL);
    info('Profile picture uploaded. Click "Save Changes" to apply.');
  };

  const handleTempBannerUpload = (newBannerURL) => {
    if (tempBannerURL && tempBannerURL !== newBannerURL) {
      cleanupTempUpload('banner', tempBannerURL);
    }
    setTempBannerURL(newBannerURL);
    if (newBannerURL) {
      localStorage.setItem('tempBannerURL', newBannerURL);
    } else {
      localStorage.removeItem('tempBannerURL');
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordStatus({ type: '', message: '' });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Complete all password fields.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    try {
      setPasswordSaving(true);
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus({ type: 'success', message: 'Password changed successfully.' });
    } catch (error) {
      setPasswordStatus({
        type: 'error',
        message: error?.message || 'Failed to change password.',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const getCurrentProfilePicture = () => tempPhotoURL || user?.photoURL;

  const getCurrentBanner = () => tempBannerURL || user?.bannerURL;

  const setTab = (tab) => {
    setSearchParams({ tab });
  };
  const selectedTheme = preferences.theme === 'auto' ? 'theme1' : (preferences.theme || 'theme1');

  return (
    <div className="px-4 md:px-8 py-2 md:py-4">
      <div className="max-w-5xl mx-auto relative">
        <div className="rounded-2xl border border-border-primary bg-base-primary overflow-hidden h-[630px]">
          <div className="px-6 pt-5 flex justify-between items-center">
            <TabNavigation
              items={[
                { id: 'account', label: 'Account' },
                { id: 'settings', label: 'Settings' }
              ]}
              value={activeTab}
              onChange={setTab}
              variant="panel"
              ariaLabel="Settings tabs"
            />
            {activeTab === 'account' && hasChanges && (
              <Button variant="success" loading={isSaving} onClick={handleSaveChanges}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>

          <div className="p-5 md:p-6 relative" style={{ minHeight: '600px' }}>
            {activeTab === 'account' && (
              <>
                <RestrictedOverlay />

                {user && (
                  <div className="space-y-4">

                    {/* Twitter-style profile card */}
                    <div className="rounded-xl border border-border-primary overflow-hidden bg-base-primary">
                      {/* Banner */}
                      <div className="relative w-full h-28 bg-surface-secondary group cursor-pointer" onClick={() => document.getElementById('banner-upload')?.click()}>
                        {getCurrentBanner() ? (
                          <img src={getCurrentBanner()} alt="Profile banner" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-surface-secondary to-surface-tertiary" />
                        )}
                        {isBannerUploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loading animation="chaotic" /></div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-white">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                          </div>
                        </div>
                      </div>

                      <input id="banner-upload" type="file" accept="image/*" onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                        if (!allowedTypes.includes(file.type)) { error('Please select a valid image file (JPEG, PNG, GIF, or WebP).'); return; }
                        if (file.size > 8 * 1024 * 1024) { error('File size must be less than 8MB.'); return; }
                        setIsBannerUploading(true);
                        try {
                          const result = await imageService.uploadBanner(file);
                          handleTempBannerUpload(result.bannerURL);
                          info('Banner uploaded. Click "Save Changes" to apply.');
                        } catch (uploadError) {
                          error(uploadError?.response?.data?.message || uploadError?.message || 'Failed to upload banner.');
                        } finally { setIsBannerUploading(false); }
                      }} className="hidden" />

                      {/* Avatar + info — avatar overlaps banner */}
                      <div className="px-4 pb-3">
                        {/* Avatar floated up to overlap banner */}
                        <div className="flex items-end justify-between" style={{ marginTop: '-28px' }}>
                          <div className="ring-4 ring-base-primary rounded-full flex-shrink-0">
                            <ProfilePicture size="xl" showUploadOverlay={true} onTempUpload={handleTempProfilePictureUpload} currentPhotoURL={getCurrentProfilePicture()} clickable={true} />
                          </div>
                          {isGoogleUser && (
                            <span className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full bg-surface-secondary border border-border-primary text-label text-color-secondary">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                              Google Account
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <p className="text-h4 leading-tight">{displayName || '—'}</p>
                          <p className="text-small text-color-tertiary">{user?.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* 3-column grid: Profile | Location | Security */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

                      {/* Profile fields */}
                      <div className="space-y-2">
                        <p className="text-label">Profile</p>
                        <div>
                          <label className={`text-small block mb-1 ${displayNameError ? 'text-intent-danger' : ''}`}>{displayNameError || 'Display Name'}</label>
                          <input
                            type="text"
                            className={`w-full px-3 py-1.5 rounded-lg border transition-all bg-surface-primary text-primary placeholder:text-placeholder focus:ring-border-focus focus:border-border-focus text-small ${displayNameError ? 'border-intent-danger' : 'border-border-primary'}`}
                            value={displayName}
                            onChange={(e) => { setDisplayName(e.target.value); setDisplayNameError(''); }}
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="text-small block mb-1">Email Address</label>
                          <div className="w-full px-3 py-1.5 rounded-lg border bg-surface-primary border-border-primary text-small cursor-not-allowed">
                            <span className="text-color-tertiary">{user?.email || 'No email provided'}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-small">Bio</label>
                            <span className="text-label text-color-tertiary">{bio.length}/500</span>
                          </div>
                          <Input multiline value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." maxLength={500} className="w-full" style={{ resize: 'none' }} rows={3} />
                        </div>
                      </div>

                      {/* Location */}
                      <div className="space-y-2">
                        <p className="text-label">Location</p>
                        <div>
                          <label className="text-small block mb-1">Region</label>
                          <AutocompleteInput value={region} onChange={handleRegionChange} options={PHILIPPINE_LOCATIONS.regions} placeholder="Type region name..." admin={isAdmin} className="w-full px-3 py-1.5 rounded-lg border transition-all bg-surface-primary text-primary placeholder:text-placeholder focus:ring-border-focus focus:border-border-focus text-small border-border-primary" />
                        </div>
                        <div>
                          <label className="text-small block mb-1">Province</label>
                          <AutocompleteInput value={province} onChange={handleProvinceChange} options={getFilteredProvinces()} placeholder="Type province name..." admin={isAdmin} disabled={!region} className="w-full px-3 py-1.5 rounded-lg border transition-all bg-surface-primary text-primary placeholder:text-placeholder focus:ring-border-focus focus:border-border-focus text-small border-border-primary" />
                        </div>
                        <div>
                          <label className="text-small block mb-1">City</label>
                          <AutocompleteInput value={city} onChange={setCity} options={getFilteredCities()} placeholder="Type city name..." admin={isAdmin} disabled={!province} className="w-full px-3 py-1.5 rounded-lg border transition-all bg-surface-primary text-primary placeholder:text-placeholder focus:ring-border-focus focus:border-border-focus text-small border-border-primary" />
                        </div>
                      </div>

                      {/* Security */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-label">Security</p>
                          {isGoogleUser && <span className="text-label text-color-tertiary normal-case tracking-normal font-normal">Managed by Google</span>}
                        </div>
                        <div className={`rounded-xl border border-border-primary bg-surface-secondary p-3 space-y-2 ${isGoogleUser ? 'opacity-60 select-none pointer-events-none' : ''}`}>
                          <div className="flex items-center gap-2">
                            <svg className={isGoogleUser ? 'text-color-tertiary' : 'text-color-secondary'} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            <p className="text-body font-medium">Password</p>
                          </div>
                          <p className="text-small text-color-tertiary">
                            {isGoogleUser ? 'Your sign-in is managed by Google. Change your password via Google account settings.' : ''}
                          </p>
                          {passwordStatus.message && !isGoogleUser && (
                            <div className={`rounded-md border px-2 py-1.5 text-small ${passwordStatus.type === 'success' ? 'border-intent-success/40 bg-intent-success/10 text-intent-success' : 'border-intent-danger/40 bg-intent-danger/10 text-intent-danger'}`}>
                              {passwordStatus.message}
                            </div>
                          )}
                          <form onSubmit={handleChangePassword} className="space-y-2">
                            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isGoogleUser} className="w-full px-3 py-1.5 rounded-lg border bg-surface-primary border-border-primary text-primary text-small placeholder:text-placeholder focus:ring-border-focus focus:border-border-focus disabled:cursor-not-allowed" placeholder="Current password" autoComplete="current-password" />
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isGoogleUser} className="w-full px-3 py-1.5 rounded-lg border bg-surface-primary border-border-primary text-primary text-small placeholder:text-placeholder focus:ring-border-focus focus:border-border-focus disabled:cursor-not-allowed" placeholder="New password" autoComplete="new-password" />
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isGoogleUser} className="w-full px-3 py-1.5 rounded-lg border bg-surface-primary border-border-primary text-primary text-small placeholder:text-placeholder focus:ring-border-focus focus:border-border-focus disabled:cursor-not-allowed" placeholder="Confirm new password" autoComplete="new-password" />
                            {!isGoogleUser && (
                              <div className="flex justify-center">
                                <Button variant="success" loading={passwordSaving} onClick={handleChangePassword}>
                                  {passwordSaving ? 'Updating...' : 'Update Password'}
                                </Button>
                              </div>
                            )}
                          </form>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </>
            )}

            {activeTab === 'settings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

                {/* Left: Appearance */}
                <div className="space-y-2">
                  <p className="text-label">Appearance</p>

                  {isAdmin && (
                    <div className="p-3 rounded-xl border transition-all bg-surface-secondary border-border-primary hover:bg-surface-tertiary">
                      <p className="text-body font-medium">Theme</p>
                      <p className="text-small text-color-tertiary mb-2">Choose your preferred color theme</p>
                      <div className="flex flex-wrap gap-2">
                        {THEME_OPTIONS.map((themeOption) => {
                          const isSelected = selectedTheme === themeOption.value;
                          return (
                            <div key={themeOption.value} className="relative">
                              <button
                                type="button"
                                onClick={() => updatePreferenceSection('theme', themeOption.value)}
                                aria-label={`Select ${themeOption.value}`}
                                className="rounded-lg border border-border-strong hover:border-border-brand overflow-hidden w-10 h-10 transition-all cursor-pointer flex-shrink-0"
                              >
                                <div style={{ backgroundColor: themeOption.accent, height: '35%' }} />
                                <div style={{ backgroundColor: themeOption.brand, height: '65%' }} />
                              </button>
                              {isSelected && (
                                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-border-focus" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 rounded-xl border transition-all bg-surface-secondary border-border-primary hover:bg-surface-tertiary gap-3">
                    <div>
                      <p className="text-body font-medium">Dark Mode</p>
                      <p className="text-small text-color-tertiary">Preferred appearance</p>
                    </div>
                    <div className="min-w-[130px]">
                      <CustomDropdown
                        value={preferences.darkMode || 'light'}
                        onChange={(value) => updatePreferenceSection('darkMode', value)}
                        options={[
                          { value: 'light', label: 'Light' },
                          { value: 'dark', label: 'Dark' },
                          { value: 'auto', label: 'Auto' }
                        ]}
                        admin={isAdmin}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Privacy */}
                {user && (
                  <div className="space-y-2">
                    <p className="text-label">Privacy</p>

                    <div className="flex items-center justify-between p-3 rounded-xl border transition-all bg-surface-secondary border-border-primary hover:bg-surface-tertiary gap-3">
                      <div>
                        <p className="text-body font-medium">System Notifications</p>
                        <p className="text-small text-color-tertiary">Account and system emails</p>
                      </div>
                      <Toggle checked={preferences.notifications?.system !== false} onChange={(checked) => updatePreferenceSection('notifications', { ...preferences.notifications, system: checked })} admin={isAdmin} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border transition-all bg-surface-secondary border-border-primary hover:bg-surface-tertiary gap-3">
                      <div>
                        <p className="text-body font-medium">Blog Notifications</p>
                        <p className="text-small text-color-tertiary">Approved/published blog updates</p>
                      </div>
                      <Toggle checked={preferences.notifications?.blog !== false} onChange={(checked) => updatePreferenceSection('notifications', { ...preferences.notifications, blog: checked })} admin={isAdmin} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border transition-all bg-surface-secondary border-border-primary hover:bg-surface-tertiary gap-3">
                      <div>
                        <p className="text-body font-medium">Profile Visibility</p>
                        <p className="text-small text-color-tertiary">Control who can see your profile</p>
                      </div>
                      <div className="min-w-[130px]">
                        <CustomDropdown
                          value={preferences.profileVisibility || 'public'}
                          onChange={(value) => updatePreferenceSection('profileVisibility', value)}
                          options={[
                            { value: 'public', label: 'Public' },
                            { value: 'private', label: 'Private' }
                          ]}
                          admin={isAdmin}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom row: Assistant — full width */}
                {user && (
                  <div className="md:col-span-2 border-t border-border-primary pt-4 space-y-2">
                    <p className="text-label">Assistant</p>
                    <div className="flex items-center justify-between p-3 rounded-xl border transition-all bg-surface-secondary border-border-primary hover:bg-surface-tertiary gap-3">
                      <div>
                        <p className="text-body font-medium">Chatbot Widget</p>
                        <p className="text-small text-color-tertiary">Show the AI assistant floating button on every page</p>
                      </div>
                      <Toggle
                        checked={chatbotEnabled}
                        onChange={(checked) => updatePreferenceSection('chatbot', { enabled: checked })}
                        admin={isAdmin}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
