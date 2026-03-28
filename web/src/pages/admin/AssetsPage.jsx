import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card';
import ImageUpload from '../../components/common/ImageUpload';
import SearchBar from '../../components/common/SearchBar';
import { imageService } from '../../services/imageService';
import siteAssetService from '../../services/siteAssetService';

const LANDING_SECTIONS = [
  { key: 'welcome', label: 'Welcome Section' },
  { key: 'recent', label: 'Recent Section' },
  { key: 'about', label: 'About Section' },
  { key: 'more', label: 'More Section' },
  { key: 'contact', label: 'Contact Section' },
];
const WELCOME_MEDIA_MODES = {
  STATIC: 'static',
  ANIMATED: 'animated',
};

const toImageItems = (url) => {
  if (!url) return [];
  return [{ url, caption: '', isPrimary: true }];
};

const toCarouselItems = (carousel = []) => {
  if (!Array.isArray(carousel)) return [];
  return carousel.map((item, index) => ({
    url: item.url,
    caption: `Carousel ${index + 1}`,
    isPrimary: index === 0,
  }));
};

const extractUploadedUrl = (uploadResponse) => {
  if (!uploadResponse) return null;
  if (typeof uploadResponse === 'string') return uploadResponse;

  // Existing services are inconsistent; normalize several shapes.
  return (
    uploadResponse.url
    || uploadResponse?.data?.url
    || uploadResponse?.data?.data?.url
    || null
  );
};

const AssetsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [sectionImages, setSectionImages] = useState({
    welcome: { light: [], dark: [] },
    recent: { light: [], dark: [] },
    about: { light: [], dark: [] },
    more: { light: [], dark: [] },
    contact: { light: [], dark: [] },
  });
  const [carouselImages, setCarouselImages] = useState([]);
  const [welcomeMediaMode, setWelcomeMediaMode] = useState(WELCOME_MEDIA_MODES.STATIC);
  const [welcomeAnimatedImages, setWelcomeAnimatedImages] = useState({ light: [], dark: [] });

  const hasWelcomeLight = useMemo(() => Boolean(sectionImages.welcome.light?.[0]), [sectionImages]);
  const hasWelcomeDark = useMemo(() => Boolean(sectionImages.welcome.dark?.[0]), [sectionImages]);
  const hasWelcomeAnimatedLight = useMemo(() => welcomeAnimatedImages.light.length > 0, [welcomeAnimatedImages]);
  const hasWelcomeAnimatedDark = useMemo(() => welcomeAnimatedImages.dark.length > 0, [welcomeAnimatedImages]);
  const hasCarousel = useMemo(() => carouselImages.length > 0, [carouselImages]);
  const filteredSections = useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    if (!term) return LANDING_SECTIONS;

    return LANDING_SECTIONS.filter((section) =>
      section.label.toLowerCase().includes(term) || section.key.toLowerCase().includes(term)
    );
  }, [searchInput]);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await siteAssetService.getLandingAssetsAdmin();

        const nextSections = {
          welcome: {
            light: toImageItems(data?.sections?.welcome?.light?.url || data?.welcomeBackgroundUrl || ''),
            dark: toImageItems(data?.sections?.welcome?.dark?.url || ''),
          },
          recent: {
            light: toImageItems(data?.sections?.recent?.light?.url || ''),
            dark: toImageItems(data?.sections?.recent?.dark?.url || ''),
          },
          about: {
            light: toImageItems(data?.sections?.about?.light?.url || ''),
            dark: toImageItems(data?.sections?.about?.dark?.url || ''),
          },
          more: {
            light: toImageItems(data?.sections?.more?.light?.url || ''),
            dark: toImageItems(data?.sections?.more?.dark?.url || ''),
          },
          contact: {
            light: toImageItems(data?.sections?.contact?.light?.url || ''),
            dark: toImageItems(data?.sections?.contact?.dark?.url || ''),
          },
        };

        setSectionImages(nextSections);
        setCarouselImages(toCarouselItems(data?.carousel || []));
        const serverMode = data?.sections?.welcome?.mediaMode === WELCOME_MEDIA_MODES.ANIMATED
          ? WELCOME_MEDIA_MODES.ANIMATED
          : WELCOME_MEDIA_MODES.STATIC;
        setWelcomeMediaMode(serverMode);
        const animatedPayload = data?.sections?.welcome?.animated;
        const nextAnimated = Array.isArray(animatedPayload)
          ? { light: toCarouselItems(animatedPayload), dark: [] }
          : {
            light: toCarouselItems(animatedPayload?.light || []),
            dark: toCarouselItems(animatedPayload?.dark || []),
          };
        setWelcomeAnimatedImages(nextAnimated);
      } catch (err) {
        setError(err?.error || err?.message || 'Failed to load assets');
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  const updateSectionImages = (sectionKey, mode, images) => {
    setSectionImages((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        [mode]: images,
      },
    }));
  };

  const uploadImageItem = async (item, target = 'background', label = 'landing-asset') => {
    if (!item) return '';
    if (!item.file) return item.url || '';

    const uploaded = target === 'carousel'
      ? await imageService.uploadSiteCarouselImage(item.file, label)
      : await imageService.uploadSiteBackgroundImage(item.file, label);
    const uploadedUrl = extractUploadedUrl(uploaded);

    if (!uploadedUrl) {
      throw new Error('Image upload succeeded but no URL was returned.');
    }

    return uploadedUrl;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (welcomeMediaMode === WELCOME_MEDIA_MODES.STATIC) {
      if (!hasWelcomeLight) {
        setError('Welcome light-mode image is required for static mode.');
        return;
      }

      if (!hasWelcomeDark) {
        setError('Welcome dark-mode image is required for static mode.');
        return;
      }
    } else if (!hasWelcomeAnimatedLight || !hasWelcomeAnimatedDark) {
      setError('Animated mode requires at least one light and one dark welcome asset.');
      return;
    }

    if (!hasCarousel) {
      setError('At least one carousel image is required.');
      return;
    }

    try {
      setSaving(true);

      const sectionPayload = {};
      for (const section of LANDING_SECTIONS) {
        const lightUrl = await uploadImageItem(
          sectionImages[section.key].light?.[0],
          'background',
          `landing-${section.key}-light`
        );
        const darkUrl = await uploadImageItem(
          sectionImages[section.key].dark?.[0],
          'background',
          `landing-${section.key}-dark`
        );

        sectionPayload[section.key] = {
          lightUrl,
          darkUrl,
        };
      }

      const carouselUrls = [];
      for (let index = 0; index < carouselImages.length; index += 1) {
        const image = carouselImages[index];
        const url = await uploadImageItem(image, 'carousel', `landing-carousel-${index + 1}`);
        if (url) carouselUrls.push(url);
      }

      const welcomeAnimatedLightUrls = [];
      for (let index = 0; index < welcomeAnimatedImages.light.length; index += 1) {
        const image = welcomeAnimatedImages.light[index];
        const url = await uploadImageItem(
          image,
          'background',
          `landing-welcome-animated-light-${index + 1}`
        );
        if (url) welcomeAnimatedLightUrls.push(url);
      }

      const welcomeAnimatedDarkUrls = [];
      for (let index = 0; index < welcomeAnimatedImages.dark.length; index += 1) {
        const image = welcomeAnimatedImages.dark[index];
        const url = await uploadImageItem(
          image,
          'background',
          `landing-welcome-animated-dark-${index + 1}`
        );
        if (url) welcomeAnimatedDarkUrls.push(url);
      }

      const payload = {
        sections: sectionPayload,
        carouselUrls,
        welcomeMedia: {
          mode: welcomeMediaMode,
          animatedLightUrls: welcomeAnimatedLightUrls,
          animatedDarkUrls: welcomeAnimatedDarkUrls,
        },
      };

      const result = await siteAssetService.saveLandingAssets(payload);

      const nextSections = {
        welcome: {
          light: toImageItems(result?.sections?.welcome?.light?.url || ''),
          dark: toImageItems(result?.sections?.welcome?.dark?.url || ''),
        },
        recent: {
          light: toImageItems(result?.sections?.recent?.light?.url || ''),
          dark: toImageItems(result?.sections?.recent?.dark?.url || ''),
        },
        about: {
          light: toImageItems(result?.sections?.about?.light?.url || ''),
          dark: toImageItems(result?.sections?.about?.dark?.url || ''),
        },
        more: {
          light: toImageItems(result?.sections?.more?.light?.url || ''),
          dark: toImageItems(result?.sections?.more?.dark?.url || ''),
        },
        contact: {
          light: toImageItems(result?.sections?.contact?.light?.url || ''),
          dark: toImageItems(result?.sections?.contact?.dark?.url || ''),
        },
      };

      setSectionImages(nextSections);
      setCarouselImages(toCarouselItems(result?.carousel || []));
      setWelcomeMediaMode(
        result?.sections?.welcome?.mediaMode === WELCOME_MEDIA_MODES.ANIMATED
          ? WELCOME_MEDIA_MODES.ANIMATED
          : WELCOME_MEDIA_MODES.STATIC
      );
      const resultAnimatedPayload = result?.sections?.welcome?.animated;
      const nextResultAnimated = Array.isArray(resultAnimatedPayload)
        ? { light: toCarouselItems(resultAnimatedPayload), dark: [] }
        : {
          light: toCarouselItems(resultAnimatedPayload?.light || []),
          dark: toCarouselItems(resultAnimatedPayload?.dark || []),
        };
      setWelcomeAnimatedImages(nextResultAnimated);
      setSuccess('Assets updated successfully.');
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to save assets');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <div className="p-6">
            <h1 className="text-2xl font-semibold text-primary">Assets</h1>
            <p className="text-sm text-tertiary mt-2">
              Upload and manage Cloudinary-backed landing assets and loading visuals.
            </p>
          </div>
        </Card>

        <Card>
          <form onSubmit={handleSave} className="p-6 space-y-8">
            <div className="max-w-md">
              <SearchBar
                value={searchInput}
                onChange={setSearchInput}
                onSubmit={setSearchInput}
                placeholder="Search section name..."
                defaultWidth="w-full"
                focusedWidth="w-full"
                className="w-full"
              />
            </div>

            <div className="space-y-8">
              {filteredSections.map((section) => (
                <div key={section.key} className="space-y-4 border border-border-primary rounded-lg p-4 bg-surface-primary">
                  <div>
                    <h2 className="text-base font-semibold text-primary">{section.label}</h2>
                    <p className="text-xs text-tertiary mt-1">
                      {section.key === 'welcome'
                        ? 'Choose static or animated mode. Animated mode rotates up to 4 assets.'
                        : 'Set separate assets for light and dark themes.'}
                    </p>
                  </div>

                  {section.key === 'welcome' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWelcomeMediaMode(WELCOME_MEDIA_MODES.STATIC)}
                          className={`px-3 py-2 text-sm rounded-md border ${welcomeMediaMode === WELCOME_MEDIA_MODES.STATIC
                            ? 'bg-interactive-brand-primary text-on-brand border-border-brand'
                            : 'bg-surface-secondary text-primary border-border-primary'
                            }`}
                        >
                          Static
                        </button>
                        <button
                          type="button"
                          onClick={() => setWelcomeMediaMode(WELCOME_MEDIA_MODES.ANIMATED)}
                          className={`px-3 py-2 text-sm rounded-md border ${welcomeMediaMode === WELCOME_MEDIA_MODES.ANIMATED
                            ? 'bg-interactive-brand-primary text-on-brand border-border-brand'
                            : 'bg-surface-secondary text-primary border-border-primary'
                            }`}
                        >
                          Animated
                        </button>
                      </div>
                      <p className="text-xs text-tertiary">
                        Selected tab becomes the default Welcome mode on the landing page after you save.
                      </p>
                    </div>
                  )}

                  {section.key !== 'welcome' || welcomeMediaMode === WELCOME_MEDIA_MODES.STATIC ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-primary mb-2">Light Mode</label>
                        <ImageUpload
                          currentImages={sectionImages[section.key].light}
                          onImagesChange={(images) => updateSectionImages(section.key, 'light', images)}
                          maxImages={1}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-primary mb-2">Dark Mode</label>
                        <ImageUpload
                          currentImages={sectionImages[section.key].dark}
                          onImagesChange={(images) => updateSectionImages(section.key, 'dark', images)}
                          maxImages={1}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-primary mb-2">
                          Animated Light Mode Assets (Up to 4)
                        </label>
                        <ImageUpload
                          currentImages={welcomeAnimatedImages.light}
                          onImagesChange={(images) => setWelcomeAnimatedImages((prev) => ({ ...prev, light: images }))}
                          maxImages={4}
                        />
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-primary mb-2">
                          Animated Dark Mode Assets (Up to 4)
                        </label>
                        <ImageUpload
                          currentImages={welcomeAnimatedImages.dark}
                          onImagesChange={(images) => setWelcomeAnimatedImages((prev) => ({ ...prev, dark: images }))}
                          maxImages={4}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
              {filteredSections.length === 0 && (
                <div className="text-sm text-tertiary">
                  No landing sections match your search.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-semibold text-primary">Recent Section Carousel</h2>
              <p className="text-xs text-tertiary">Upload multiple images/GIFs for the carousel slides.</p>
              <ImageUpload
                currentImages={carouselImages}
                onImagesChange={setCarouselImages}
                maxImages={12}
                buttonOnly={true}
              />
            </div>

            {error && <p className="text-sm text-intent-danger">{error}</p>}
            {success && <p className="text-sm text-intent-success">{success}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-interactive-brand-primary text-on-brand hover:bg-interactive-brand-primary-hover disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Assets'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default AssetsPage;
