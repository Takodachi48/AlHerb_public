import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePreferences } from '../../context/PreferencesContext';
import SearchModal from '../../components/modals/SearchModal';
import CustomButton from '../../components/custom/CustomButton';
import { CLOUDINARY_URLS } from '../../config/cloudinary';
import siteAssetService from '../../services/siteAssetService';
import { Navbar, Sidenav, SectionOverlay, FeaturesBlock } from '../../components/landing';
import { Input } from '../../components/common';
import { SYSTEM_NAME, SYSTEM_SHORT_NAME } from '../../../../shared/constants/app.js';
import { AnimatePresence, motion } from 'framer-motion';
import useBatchIntersectionObserver from '../../hooks/useBatchIntersectionObserver';
import { useLoaderActions } from '../../hooks/useLoader';
import blogApi from '../../services/blogService';

// Import Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, HashNavigation } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/mousewheel';
import 'swiper/css/hash-navigation';

// Import Swiper Context
import { SwiperProvider } from '../../context/SwiperContext';
import { Leaf, GitCompare, Map, Camera, Users, Target } from 'lucide-react';

/*
  Overlay clearance constants (px) — keep in sync with SectionOverlay.jsx
  ─────────────────────────────────────────────────────────────────────────
  TOP_CLEAR   : top band sits at top:18, pill height 46  → 18+46 = 64
  BOT_CLEAR   : sub-rule at bottom:62, plus circle cluster height ~30 + 18
                padding = bottom:18 + cluster ~30 + gap 12 ≈ 100px total
  We add a comfortable 8px breathing room to each.
*/
const OVERLAY_TOP = 72;   // px clearance from top of viewport
const OVERLAY_BOTTOM = 108;  // px clearance from bottom of viewport

const BLOG_TABS = ['recent', 'general', 'news'];
const LANDING_ASSET_CACHE_KEY = 'landing-assets-cache-v1';
const LANDING_ASSET_CACHE_TTL_MS = 5 * 60 * 1000;
const LANDING_STATS_CACHE_KEY = 'landing-stats-cache-v1';
const LANDING_STATS_CACHE_TTL_MS = 2 * 60 * 1000;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_PROXY_TARGET = import.meta.env.VITE_API_PROXY_TARGET || '';
const IS_DEV = import.meta.env.DEV;

const resolveApiBaseUrl = () => {
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    return API_BASE_URL.replace(/\/$/, '');
  }
  const normalized = API_BASE_URL.startsWith('/') ? API_BASE_URL : `/${API_BASE_URL}`;
  if (IS_DEV) {
    return normalized;
  }
  if (API_PROXY_TARGET && (API_PROXY_TARGET.startsWith('http://') || API_PROXY_TARGET.startsWith('https://'))) {
    return `${API_PROXY_TARGET.replace(/\/$/, '')}${normalized}`;
  }
  if (typeof window === 'undefined') return normalized;
  return `${window.location.origin}${normalized}`;
};

const readSessionCache = (key, ttlMs) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const age = Date.now() - Number(parsed?.ts || 0);
    if (!parsed?.value || Number.isNaN(age) || age > ttlMs) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
};

const writeSessionCache = (key, value) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
  } catch {
    // Ignore cache write failures.
  }
};

/* ─── Fade-in on scroll ───────────────────────────────────────────── */
/* ─── Animated section wrapper ────────────────────────────────────── */
const FadeSection = ({ children, delay = 0, observeByKey, observeKey, animation = 'slide' }) => {
  return (
    <div
      ref={observeByKey(observeKey)}
      className="io-reveal"
      data-io-animation={animation}
      style={{
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

/* ─── Brand divider line ──────────────────────────────────────────── */
const Divider = ({ vertical = false }) =>
  vertical ? (
    <div style={{ width: 1, alignSelf: 'stretch', background: 'linear-gradient(180deg, transparent, var(--border-brand) 25%, var(--border-brand) 75%, transparent)' }} />
  ) : (
    <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--border-brand) 20%, var(--border-brand) 80%, transparent)' }} />
  );

const LandingPage = () => {
  const { preferences } = usePreferences();
  const { start, finish } = useLoaderActions();
  const observeReveal = useBatchIntersectionObserver({ threshold: 0.12, rootMargin: '100px 0px' });

  const sections = [
    { id: 'welcome', name: 'Welcome' },
    { id: 'recent', name: 'Recent' },
    { id: 'about', name: 'About' },
    { id: 'more', name: 'More' },
    { id: 'contact', name: 'Contact' },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeTab, setActiveTab] = useState('recent');
  const [tabDirection, setTabDirection] = useState(1);
  const [blogsByTab, setBlogsByTab] = useState({});
  const [loadingTabs, setLoadingTabs] = useState({});
  const [swiperInstance, setSwiperInstance] = useState(null);
  const [navbarVisible, setNavbarVisible] = useState(() => {
    const saved = localStorage.getItem('navbarVisible');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [currentSection, setCurrentSection] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [landingSections, setLandingSections] = useState({});
  const [carouselImages, setCarouselImages] = useState([
    { url: CLOUDINARY_URLS.HERO_1 },
    { url: CLOUDINARY_URLS.HERO_2 },
    { url: CLOUDINARY_URLS.HERO_3 },
    { url: CLOUDINARY_URLS.HERO_4 },
    { url: CLOUDINARY_URLS.HERO_5 },
  ]);
  const [welcomeAnimatedAssets, setWelcomeAnimatedAssets] = useState({ light: [], dark: [] });
  const [welcomeMediaMode, setWelcomeMediaMode] = useState('static');
  const [currentWelcomeSlide, setCurrentWelcomeSlide] = useState(0);
  const [herbCount, setHerbCount] = useState('100+');
  const [locationCount, setLocationCount] = useState('7,000+');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState(null);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    contactType: 'email',
    contactValue: '',
    message: ''
  });
  const [inquiryErrors, setInquiryErrors] = useState({
    name: '',
    contactValue: '',
    message: '',
    captcha: '',
  });
  const [inquiryStatus, setInquiryStatus] = useState({
    type: '',
    message: '',
  });
  const [welcomeBgLoaded, setWelcomeBgLoaded] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileConfigLoaded, setTurnstileConfigLoaded] = useState(false);
  const [landingAssetsLoaded, setLandingAssetsLoaded] = useState(false);
  const [welcomeMediaReady, setWelcomeMediaReady] = useState(false);
  const landingLoadTaskIdRef = useRef(`landing-initial:${Date.now()}`);
  const landingLoadCompletedRef = useRef(false);

  const turnstileRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);

  useEffect(() => {
    if (!turnstileConfigLoaded || !turnstileEnabled) {
      setCaptchaToken('');
      return undefined;
    }

    let checkTurnstile;

    const ensureTurnstileScript = () => {
      if (window.turnstile) {
        return;
      }

      const scriptId = 'cf-turnstile-api-script';
      const existingScript = document.getElementById(scriptId)
        || document.querySelector('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');

      if (existingScript) {
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    };

    const renderTurnstile = () => {
      if (!window.turnstile || !turnstileRef.current || turnstileWidgetIdRef.current !== null) {
        return;
      }

      // Guard against duplicate renders in React StrictMode dev re-mount cycle.
      if (turnstileRef.current.childElementCount > 0) {
        return;
      }

      turnstileWidgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
        callback: (token) => {
          setCaptchaToken(token);
          setInquiryErrors((prev) => ({ ...prev, captcha: '' }));
        },
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      });
    };

    ensureTurnstileScript();

    if (window.turnstile) {
      renderTurnstile();
    } else {
      checkTurnstile = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkTurnstile);
          renderTurnstile();
        }
      }, 100);
    }

    return () => {
      if (checkTurnstile) {
        clearInterval(checkTurnstile);
      }

      if (turnstileWidgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [turnstileEnabled, turnstileConfigLoaded]);

  useEffect(() => { document.title = SYSTEM_SHORT_NAME; }, []);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('navbarVisible', JSON.stringify(navbarVisible));
  }, [navbarVisible]);

  useEffect(() => {
    const loadLandingAssets = async () => {
      const applyLandingAssetPayload = (data) => {
        if (data?.sections && typeof data.sections === 'object') {
          setLandingSections(data.sections);
          const mode = data?.sections?.welcome?.mediaMode === 'animated' ? 'animated' : 'static';
          setWelcomeMediaMode(mode);
          const animatedPayload = data?.sections?.welcome?.animated;
          const normalizedAnimated = Array.isArray(animatedPayload)
            ? {
              light: animatedPayload.map((item) => ({ url: item.url })),
              dark: [],
            }
            : {
              light: (animatedPayload?.light || []).map((item) => ({ url: item.url })),
              dark: (animatedPayload?.dark || []).map((item) => ({ url: item.url })),
            };
          setWelcomeAnimatedAssets(normalizedAnimated);
        } else if (data?.welcomeBackgroundUrl) {
          setLandingSections({ welcome: { light: { url: data.welcomeBackgroundUrl }, dark: { url: '' } } });
          setWelcomeMediaMode('static');
          setWelcomeAnimatedAssets({ light: [], dark: [] });
        }

        if (Array.isArray(data?.carousel) && data.carousel.length > 0) {
          setCarouselImages(data.carousel.map((item) => ({ url: item.url })));
        }

        setTurnstileEnabled(typeof data?.turnstileEnabled === 'boolean' ? data.turnstileEnabled : false);
      };

      const cached = readSessionCache(LANDING_ASSET_CACHE_KEY, LANDING_ASSET_CACHE_TTL_MS);
      let hydratedFromCache = false;
      if (cached) {
        applyLandingAssetPayload(cached);
        setTurnstileConfigLoaded(true);
        setLandingAssetsLoaded(true);
        hydratedFromCache = true;
      }

      try {
        const data = await siteAssetService.getLandingAssets();
        applyLandingAssetPayload(data);
        writeSessionCache(LANDING_ASSET_CACHE_KEY, data);
      } catch (error) {
        console.error('Failed to load landing site assets:', error);
      } finally {
        setTurnstileConfigLoaded(true);
        if (!hydratedFromCache) {
          setLandingAssetsLoaded(true);
        }
      }
    };

    loadLandingAssets();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (blogsByTab[activeTab] || loadingTabs[activeTab]) return; // use cache if available
    const fetchBlogs = async () => {
      setLoadingTabs(prev => ({ ...prev, [activeTab]: true }));
      try {
        const params = { limit: 5 };
        if (activeTab !== 'recent') {
          params.category = activeTab;
        }
        const response = await blogApi.getPublishedBlogs(params);
        if (response?.data?.blogs) {
          setBlogsByTab(prev => ({ ...prev, [activeTab]: response.data.blogs }));
        } else {
          setBlogsByTab(prev => ({ ...prev, [activeTab]: [] }));
        }
      } catch (err) {
        console.error('Failed to fetch blogs', err);
        setBlogsByTab(prev => ({ ...prev, [activeTab]: [] }));
      } finally {
        setLoadingTabs(prev => ({ ...prev, [activeTab]: false }));
      }
    };
    fetchBlogs();
  }, [activeTab, blogsByTab, loadingTabs]);

  useEffect(() => {
    const cachedStats = readSessionCache(LANDING_STATS_CACHE_KEY, LANDING_STATS_CACHE_TTL_MS);
    if (cachedStats) {
      if (cachedStats.herbCount) setHerbCount(cachedStats.herbCount);
      if (cachedStats.locationCount) setLocationCount(cachedStats.locationCount);
    }

    const nextStats = {
      herbCount: cachedStats?.herbCount || herbCount,
      locationCount: cachedStats?.locationCount || locationCount,
    };

    const apiBaseUrl = resolveApiBaseUrl();

    fetch(`${apiBaseUrl}/herbs/stats`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.herbs !== undefined) {
          const nextHerbCount = data.data.herbs.toString();
          setHerbCount(nextHerbCount);
          nextStats.herbCount = nextHerbCount;
          writeSessionCache(LANDING_STATS_CACHE_KEY, nextStats);
        }
      })
      .catch(() => { });

    fetch(`${apiBaseUrl}/locations/stats`)
      .then(res => res.json())
      .then(data => {
        if (data.locations !== undefined) {
          const nextLocationCount = data.locations.toString();
          setLocationCount(nextLocationCount);
          nextStats.locationCount = nextLocationCount;
          writeSessionCache(LANDING_STATS_CACHE_KEY, nextStats);
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (!carouselImages.length) return undefined;

    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselImages.length]);

  useEffect(() => {
    if (currentSlide < carouselImages.length) return;
    setCurrentSlide(0);
  }, [currentSlide, carouselImages.length]);

  useEffect(() => {
    const dark = preferences.darkMode === 'dark' ||
      (preferences.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const mode = dark ? 'dark' : 'light';
    const animatedForMode = welcomeAnimatedAssets[mode]?.length
      ? welcomeAnimatedAssets[mode]
      : welcomeAnimatedAssets.light;
    if (welcomeMediaMode !== 'animated' || animatedForMode.length <= 1) return undefined;

    const interval = setInterval(() => {
      setCurrentWelcomeSlide((prev) => (prev + 1) % animatedForMode.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [welcomeMediaMode, welcomeAnimatedAssets, preferences.darkMode]);

  useEffect(() => {
    const dark = preferences.darkMode === 'dark' ||
      (preferences.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const mode = dark ? 'dark' : 'light';
    const animatedForMode = welcomeAnimatedAssets[mode]?.length
      ? welcomeAnimatedAssets[mode]
      : welcomeAnimatedAssets.light;
    if (currentWelcomeSlide < animatedForMode.length) return;
    setCurrentWelcomeSlide(0);
  }, [currentWelcomeSlide, welcomeAnimatedAssets, preferences.darkMode]);

  const handleInquirySubmit = async (e) => {
    e.preventDefault();

    const { name, contactType, contactValue, message } = inquiryForm;
    const nextErrors = {
      name: '',
      contactValue: '',
      message: '',
      captcha: '',
    };
    setInquiryStatus({ type: '', message: '' });

    // Validation
    if (!name.trim()) {
      nextErrors.name = 'Please enter your name.';
    }

    if (!contactValue.trim()) {
      nextErrors.contactValue = 'Please enter your contact information.';
    }

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isValidPhone = (phone) => /^\+?[\d\s\-\(\)]{7,20}$/.test(phone);

    if (contactType === 'email' && contactValue.trim() && !isValidEmail(contactValue)) {
      nextErrors.contactValue = 'Please enter a valid email address.';
    }

    if (contactType === 'phone' && contactValue.trim() && !isValidPhone(contactValue)) {
      nextErrors.contactValue = 'Please enter a valid phone number.';
    }

    if (!message.trim()) {
      nextErrors.message = 'Please enter your message.';
    }

    if (turnstileEnabled && !captchaToken) {
      nextErrors.captcha = 'Please complete the captcha.';
    }

    if (nextErrors.name || nextErrors.contactValue || nextErrors.message || nextErrors.captcha) {
      setInquiryErrors(nextErrors);
      return;
    }

    setInquiryErrors({ name: '', contactValue: '', message: '', captcha: '' });

    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          contactType,
          contactValue: contactValue.trim(),
          message: message.trim(),
          captchaToken: turnstileEnabled ? captchaToken : '',
        }),
      });
      if (response.ok) {
        setInquiryStatus({ type: 'success', message: 'Inquiry submitted successfully!' });
        setInquiryForm({ name: '', contactType: 'email', contactValue: '', message: '' });
        setCaptchaToken('');
        if (turnstileWidgetIdRef.current !== null && window.turnstile) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
      } else {
        setInquiryStatus({ type: 'error', message: 'Failed to submit inquiry. Please try again.' });
      }
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      setInquiryStatus({ type: 'error', message: 'An error occurred. Please try again.' });
    }
  };

  const moreCards = [
    { title: 'Documentation', desc: 'Learn how the platform works, from core features to advanced usage.' },
    { title: 'Community & Contributions', desc: 'See how data is collected, verified, and how you can contribute.' },
    { title: 'Research & Sources', desc: 'Access references, studies, and source material used in the system.' },
    { title: 'Updates & Changelog', desc: 'Track new features, improvements, and platform updates.' },
    { title: 'FAQs & Guidelines', desc: 'Common questions, usage guidelines, and best practices.' },
    { title: 'Contact & Support', desc: 'Reach out for feedback, issues, or collaboration opportunities.' },
  ];

  /* ─── Section label (2px bar + small-caps) ────────────────────────── */
  const SectionLabel = ({ children }) => (
    <div className="flex items-center gap-3 mb-6">
      <div style={{ width: 2, height: 18, background: 'var(--border-brand)', flexShrink: 0 }} />
      <span className="font-accent" style={{
        color: 'var(--text-brand)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase'
      }}>
        {children}
      </span>
    </div>
  );

  /* ─── Feature card ────────────────────────────────────────────────── */
  const FeatureCard = ({ icon, title, desc }) => (
    <div
      className="group flex flex-col gap-3 p-6 transition-colors duration-300 hover:bg-surface-secondary"
      style={{ border: '1px solid var(--border-weak)', borderRadius: 2 }}
    >
      <div style={{ color: 'var(--icon-brand)' }}>{icon}</div>
      <p className="font-display" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-400)' }}>
        {title}
      </p>
      <p className="font-core" style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-tertiary)' }}>
        {desc}
      </p>
      {/* Animated brand underline on hover */}
      <div className="mt-auto pt-3">
        <div
          className="h-px transition-all duration-500 ease-out group-hover:w-full"
          style={{ width: '1.5rem', background: 'var(--border-brand)' }}
        />
      </div>
    </div>
  );

  /* ─── Stat block ──────────────────────────────────────────────────── */
  const Stat = ({ value, label }) => (
    <div className="flex flex-col gap-1 items-center text-center">
      <span className="font-accent" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, color: 'var(--accent-400)', lineHeight: 1 }}>
        {value}
      </span>
      <span className="font-accent" style={{ fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
        {label}
      </span>
    </div>
  );

  /* ─── SVG icons ───────────────────────────────────────────────────── */
  const Icon = ({ d, d2 }) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  );

  const features = [
    {
      icon: <Leaf size={28} />,
      title: 'Herb Discovery',
      desc: 'Browse a curated database of Philippine medicinal herbs — scientific names, traditional uses, active compounds, preparation methods, and cultivation guidance.',
    },
    {
      icon: <GitCompare size={28} />,
      title: 'Herb Comparison',
      desc: 'Side-by-side comparison of up to two herbs across active compounds, dosage, preparation, evidence levels, and suitability for different age groups.',
    },
    {
      icon: <Map size={28} />,
      title: 'Interactive Map',
      desc: 'Geographic visualisation of herb locations across the Philippines. Explore native species by region, discover local availability and harvesting seasons.',
    },
    {
      icon: <Camera size={28} />,
      title: 'Plant Identification',
      desc: 'Upload a photo and receive AI-powered identification with confidence scores. Learn about unknown plants safely through image analysis.',
    },
    {
      icon: <Users size={28} />,
      title: 'Blog & Community',
      desc: 'Educational articles on herbal medicine and wellness. Community content covering traditional remedies, modern applications, and searchable by category.',
    },
    {
      icon: <Target size={28} />,
      title: 'Personalised Recommendations',
      desc: 'Symptom-based herb suggestions considering age, gender, and health profile. Evidence-graded results with confidence ratings and effectiveness feedback.',
    },
  ];

  const pillars = [
    { label: 'Cultural Preservation', desc: 'Documenting and safeguarding traditional Philippine herbal knowledge for future generations.' },
    { label: 'Scientific Grounding', desc: 'Every entry is cross-referenced with published research to ensure evidence-based guidance.' },
    { label: 'Accessible Education', desc: 'Plain-language explanations for general users alongside detailed data for practitioners.' },
    { label: 'Safety First', desc: 'Clear dosage guidelines, contraindications, and warnings for every herb in the database.' },
  ];

  const isDarkMode = preferences.darkMode === 'dark'
    || (preferences.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const currentThemeMode = isDarkMode ? 'dark' : 'light';
  const animatedForCurrentMode = welcomeAnimatedAssets[currentThemeMode]?.length
    ? welcomeAnimatedAssets[currentThemeMode]
    : welcomeAnimatedAssets.light;
  const resolvedWelcomeBackgroundUrl =
    landingSections?.welcome?.[currentThemeMode]?.url
    || landingSections?.welcome?.light?.url
    || '/landing_background.png';
  const resolvedRecentBackgroundUrl =
    landingSections?.recent?.[currentThemeMode]?.url
    || landingSections?.recent?.light?.url
    || resolvedWelcomeBackgroundUrl;
  const resolvedAboutBackgroundUrl =
    landingSections?.about?.[currentThemeMode]?.url
    || landingSections?.about?.light?.url
    || resolvedRecentBackgroundUrl;
  const resolvedMoreBackgroundUrl =
    landingSections?.more?.[currentThemeMode]?.url
    || landingSections?.more?.light?.url
    || resolvedAboutBackgroundUrl;
  const resolvedContactBackgroundUrl =
    landingSections?.contact?.[currentThemeMode]?.url
    || landingSections?.contact?.light?.url
    || resolvedMoreBackgroundUrl;

  useEffect(() => {
    const preloadUrl = welcomeMediaMode === 'animated'
      ? (animatedForCurrentMode?.[0]?.url || resolvedWelcomeBackgroundUrl)
      : resolvedWelcomeBackgroundUrl;

    setWelcomeBgLoaded(false);
    setWelcomeMediaReady(false);

    if (!preloadUrl) {
      setWelcomeBgLoaded(true);
      setWelcomeMediaReady(true);
      return undefined;
    }

    let cancelled = false;
    const media = new Image();
    media.decoding = 'async';
    media.fetchPriority = 'high';

    const markReady = () => {
      if (cancelled) return;
      setWelcomeBgLoaded(true);
      setWelcomeMediaReady(true);
    };

    media.onload = markReady;
    media.onerror = markReady;
    media.src = preloadUrl;
    if (media.complete) {
      markReady();
    }

    return () => {
      cancelled = true;
    };
  }, [animatedForCurrentMode, resolvedWelcomeBackgroundUrl, welcomeMediaMode]);

  useEffect(() => {
    const taskId = landingLoadTaskIdRef.current;
    start({ id: taskId, mode: 'fullscreen', message: 'Loading landing page...' });
    return () => {
      if (landingLoadCompletedRef.current) return;
      finish(taskId);
      landingLoadCompletedRef.current = true;
    };
  }, [start, finish]);

  useEffect(() => {
    if (!landingAssetsLoaded || !welcomeMediaReady) return;
    if (landingLoadCompletedRef.current) return;
    const taskId = landingLoadTaskIdRef.current;
    finish(taskId);
    landingLoadCompletedRef.current = true;
  }, [landingAssetsLoaded, welcomeMediaReady, finish]);

  const getSectionBackgroundToneStyle = useCallback(() => ({
    opacity: isDarkMode ? 0.16 : 0.12,
    filter: isDarkMode
      ? 'saturate(0.72) contrast(0.82) brightness(0.58)'
      : 'saturate(0.82) contrast(0.92) brightness(0.82)'
  }), [isDarkMode]);

  return (
    <div className="typography-landing h-screen overflow-hidden bg-base-primary text-secondary">
      <>
        {/* Section Overlay */}
        <SectionOverlay
          sectionName={currentSection?.name}
          sectionNumber={activeIndex + 1}
          totalSections={sections.length}
          preferences={preferences}
          isWelcome={activeIndex === 0}
          onSearchClick={() => setIsSearchModalOpen(true)}
          showSidenav={isSidebarOpen}
          setShowSidenav={setIsSidebarOpen}
        />

        {/* Main Content */}
        <div className="overflow-hidden h-screen">
          <SwiperProvider swiper={swiperInstance}>
            <Sidenav isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            <Swiper
              direction="vertical"
              modules={[Mousewheel, HashNavigation]}
              mousewheel={{
                forceToAxis: true,
                sensitivity: 0.6,
                thresholdDelta: 50,
                thresholdTime: 420,
                releaseOnEdges: false,
              }}
              hashNavigation={true}
              followFinger={false}
              resistance={false}
              resistanceRatio={0}
              speed={600}
              preventInteractionOnTransition={true}
              className="h-full"
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => {
                window.dispatchEvent(new CustomEvent('slideChange', {
                  detail: { slide: sections[swiper.activeIndex]?.id || 'welcome' }
                }));
                setNavbarVisible(swiper.activeIndex === 0);
                setCurrentSection(swiper.activeIndex === 0 ? null : sections[swiper.activeIndex]);
                setActiveIndex(swiper.activeIndex);
              }}
            >

              {/* ── WELCOME ───────────────────────────────────────── */}
              <SwiperSlide data-hash="welcome" className="h-screen overflow-hidden">
                <section id="welcome" className="relative h-full overflow-hidden bg-base-primary">
                  <div className="relative h-full flex items-center justify-center">
                    <img
                      src={resolvedWelcomeBackgroundUrl}
                      alt="Landing background"
                      className="absolute inset-0 w-full h-full object-cover"
                      onLoad={() => {
                        setWelcomeBgLoaded(true);
                        setWelcomeMediaReady(true);
                      }}
                      onError={() => {
                        setWelcomeBgLoaded(true);
                        setWelcomeMediaReady(true);
                      }}
                      style={{ opacity: welcomeBgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
                    />

                    {welcomeMediaMode === 'animated' && animatedForCurrentMode.length > 0 && (
                      <div className="absolute inset-0">
                        {animatedForCurrentMode.map((asset, index) => (
                          <img
                            key={asset.url || index}
                            src={asset.url}
                            alt={`Landing animated background ${index + 1}`}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${index === currentWelcomeSlide ? 'opacity-100' : 'opacity-0'
                              }`}
                            onLoad={() => {
                              if (index === 0) setWelcomeMediaReady(true);
                            }}
                            onError={() => {
                              if (index === 0) setWelcomeMediaReady(true);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-3xl p-15 max-w-3xl mx-4 text-right md:text-center mt-0">
                        <h1 className="text-5xl md:text-8xl font-bold font-display text-brand mb-6">
                          Welcome to {SYSTEM_NAME}
                        </h1>
                        <p className="text-xl md:text-xl text-secondary mb-10">
                          Here's where it all begins.
                        </p>
                        <Link to="/home">
                          <div className="flex justify-end md:justify-center">
                            <div className="max-w-xs w-full">
                              <CustomButton variant="blink" className="rounded-full font-semibold tracking-wide px-8 py-6 text-md">
                                Get Started
                              </CustomButton>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
                </section>
              </SwiperSlide>

              {/* ── RECENT ────────────────────────────────────────── */}
              <SwiperSlide data-hash="recent" className="h-screen overflow-hidden">
                <section id="recent" className="relative h-full bg-base-primary flex items-center justify-center overflow-hidden">
                  <img
                    src={resolvedRecentBackgroundUrl}
                    alt="Recent section background"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={getSectionBackgroundToneStyle()}
                  />
                  {/*
                  The section is vertically centred via flex items-center.
                  Content height is fixed to the viewport minus the two overlay
                  bands so the top/bottom edges never touch the overlay chrome.
                  Left/right edges stay inside the existing max-w-7xl container.
                */}
                  <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/*
                    CAROUSEL_H: explicit pixel height for both the carousel image and
                    the blog scroll area so they never stretch to fill the viewport.
                    Sized to feel generous but leave clear breathing room above and
                    below the overlay bands on typical screens (900–1080px tall).
                  */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_48px_1fr] items-center">

                      {/* LEFT — Image Carousel */}
                      <div className="flex flex-col">

                        {/* Slide counter */}
                        <div className="flex items-center mb-3">
                          <div className="font-accent"
                            style={{
                              borderLeft: '2px solid var(--border-brand)',
                              borderRight: '2px solid var(--border-brand)',
                              padding: '4px 14px',
                              color: 'var(--text-brand)',
                              fontSize: 13,
                              letterSpacing: '0.2em',
                              fontWeight: 600,
                            }}
                          >
                            {String(currentSlide + 1).padStart(2, '0')}&thinsp;/&thinsp;{String(carouselImages.length).padStart(2, '0')}
                          </div>
                          <div style={{
                            flex: 1,
                            height: 2,
                            background: "linear-gradient(90deg, transparent, var(--border-brand) 20%, var(--border-brand) 80%, transparent)",
                            marginLeft: 8
                          }}></div>
                        </div>

                        {/* Carousel — explicit height, never stretches */}
                        <div
                          className="relative overflow-hidden"
                          style={{
                            height: isMobile ? 'clamp(150px, 25vh, 300px)' : 'clamp(300px, 50vh, 500px)',
                            border: '2px solid var(--border-brand)',
                            borderRadius: 4,
                            background: 'var(--surface-brand)',
                          }}
                        >
                          {carouselImages.map((image, index) => (
                            <div
                              key={index}
                              className={`absolute inset-0 transition-opacity duration-500 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                            >
                              <img
                                src={image.url}
                                alt={`Featured slide ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Dot indicators */}
                        <div className="flex items-center mt-3">
                          <div style={{
                            flex: 1,
                            height: 2,
                            background: "linear-gradient(90deg, transparent, var(--border-brand) 20%, var(--border-brand) 80%, transparent)",
                            marginRight: 8
                          }}></div>
                          <div className="cdots-root">
                            {carouselImages.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`cdots-dot ${index === currentSlide ? 'cdots-dot--active' : ''}`}
                              >
                                <span className="cdots-pip"></span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* CENTER — vertical divider, spans carousel height via absolute positioning trick */}
                      <div className="hidden lg:flex justify-center" style={{ alignSelf: 'stretch' }}>
                        <div
                          style={{
                            width: 2,
                            height: '100%',
                            background: `linear-gradient(180deg, transparent 0%, var(--border-brand) 12%, var(--border-brand) 88%, transparent 100%)`,
                          }}
                        />
                      </div>

                      {/* RIGHT — Blog list */}
                      <div className="flex flex-col">

                        {/* Tabs */}
                        <div className="flex overflow-x-auto gap-0 mb-4 pr-1">
                          {BLOG_TABS.map(tab => {
                            const isActive = activeTab === tab;
                            return (
                              <div key={tab} className="relative flex-shrink-0">
                                <button
                                  onClick={() => {
                                    const currIdx = BLOG_TABS.indexOf(activeTab);
                                    const newIdx = BLOG_TABS.indexOf(tab);
                                    if (currIdx !== newIdx) {
                                      setTabDirection(newIdx > currIdx ? 1 : -1);
                                      setActiveTab(tab);
                                    }
                                  }}
                                  className={`
                                  relative px-6 py-3
                                  text-base font-medium capitalize tracking-wide font-accent
                                  transition-all duration-500 ease-out
                                  ${isActive
                                      ? 'text-accent scale-105 -translate-y-0.5'
                                      : 'text-secondary hover:text-accent scale-100 translate-y-0'
                                    }
                                `}
                                >
                                  {tab}
                                </button>
                                <span
                                  className={`
                                  absolute bottom-0 left-1/2 transform -translate-x-1/2
                                  h-0.5 bg-accent rounded-full
                                  transition-all duration-500 ease-out
                                  ${isActive ? 'w-3/4 opacity-100' : 'w-0 opacity-0'}
                                `}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Blog entries — same explicit height as carousel, scrollable */}
                        <div
                          className="overflow-x-hidden overflow-y-auto pr-1"
                          style={{ height: isMobile ? 'clamp(200px, 35vh, 400px)' : 'clamp(400px, 70vh, 500px)' }}
                        >
                          <div className="grid">
                            <AnimatePresence custom={tabDirection}>
                              {BLOG_TABS.map(tab => {
                                if (tab !== activeTab) return null;
                                const isTabLoading = loadingTabs[tab] && !blogsByTab[tab];
                                const tabBlogs = blogsByTab[tab] || [];
                                return (
                                  <motion.div
                                    key={tab}
                                    custom={tabDirection}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    variants={{
                                      enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%' }),
                                      center: { x: 0 },
                                      exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%' })
                                    }}
                                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                                    className="space-y-3"
                                    style={{ gridArea: '1 / 1 / 2 / 2', width: '100%' }}
                                  >
                                    {isTabLoading ? (
                                      <p className="text-tertiary text-sm italic pt-4">Loading posts...</p>
                                    ) : tabBlogs.length === 0 ? (
                                      <p className="text-tertiary text-sm italic pt-4">No posts in this category yet.</p>
                                    ) : tabBlogs.map((blog, index) => (
                                      <Link
                                        key={blog._id || blog.slug}
                                        to={`/blog/${blog.slug}`}
                                        className="block py-3 hover:bg-surface-secondary transition-colors cursor-pointer rounded-r-sm relative"
                                      >
                                        <div
                                          className="absolute inset-0 rounded-r-sm"
                                          style={{
                                            backgroundColor: index % 2 === 0 ? 'var(--surface-tertiary)' : 'var(--surface-secondary)',
                                            opacity: 0.3
                                          }}
                                        />
                                        <div className="relative z-10 px-4">
                                          <div className="flex justify-between items-start gap-4">
                                            <h4 className="text-base font-semibold text-primary mb-1 leading-snug font-display">{blog.title}</h4>
                                            <span className="text-xs text-secondary whitespace-nowrap mt-1 font-accent">
                                              {new Date(blog.publishedAt || blog.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                          </div>
                                          <p className="text-sm text-tertiary mt-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{blog.excerpt}</p>
                                        </div>
                                      </Link>
                                    ))}
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </section>
              </SwiperSlide>

              {/* ── ABOUT ────────────────────────────────────────── */}
              <SwiperSlide data-hash="about" className="h-screen overflow-hidden">
                <section id="about" className="relative h-full bg-base-primary flex items-center justify-center pt-0 md:pt-0 lg:pt-0 overflow-hidden" style={{ paddingTop: isMobile ? '3rem' : '0' }}>
                  <img
                    src={resolvedAboutBackgroundUrl}
                    alt="About section background"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={getSectionBackgroundToneStyle()}
                  />
                  <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                      {/* Left — main content */}
                      <div className="space-y-8">
                        <FadeSection observeByKey={observeReveal} observeKey="about-copy">
                          <SectionLabel>About the System</SectionLabel>
                          <h2 className="font-display" style={{
                            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                            fontWeight: 700,
                            lineHeight: 1.2,
                            color: 'var(--text-strong)',
                          }}>
                            Herbal Knowledge<br />
                            <span style={{ fontStyle: 'italic', color: 'var(--text-brand)' }}>Philippines</span>
                          </h2>
                          <p className="font-core" style={{
                            fontSize: '1.1rem',
                            lineHeight: 1.7,
                            color: 'var(--text-secondary)',
                          }}>
                            Bridging traditional Philippine herbal wisdom with modern scientific understanding. Our platform empowers users to discover, compare, and safely apply natural remedies.
                          </p>
                        </FadeSection>

                        {/* Stats */}
                        <FadeSection observeByKey={observeReveal} observeKey="about-stats" delay={100}>
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { value: herbCount, label: 'Herbs' },
                              { value: '6', label: 'Features' },
                              { value: locationCount, label: 'Locations' },
                            ].map(stat => (
                              <div key={stat.label} className="text-center">
                                <div style={{
                                  fontFamily: "var(--font-accent)",
                                  fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                                  fontWeight: 700,
                                  color: 'var(--accent-400)',
                                  lineHeight: 1,
                                }}>
                                  {stat.value}
                                </div>
                                <div style={{
                                  fontFamily: "var(--font-accent)",
                                  fontSize: '0.75rem',
                                  letterSpacing: '0.1em',
                                  textTransform: 'uppercase',
                                  color: 'var(--text-tertiary)',
                                }}>
                                  {stat.label}
                                </div>
                              </div>
                            ))}
                          </div>
                        </FadeSection>
                      </div>

                      {/* Right — features and tech */}
                      <div className="space-y-8">
                        {/* Key features */}
                        <FadeSection observeByKey={observeReveal} observeKey="about-features" delay={150}>
                          <FeaturesBlock features={features} />
                        </FadeSection>
                      </div>
                    </div>
                  </div>
                </section>
              </SwiperSlide>

              {/* ── CONTACT ───────────────────────────────────────── */}
              <SwiperSlide data-hash="more" className="h-screen overflow-hidden">
                <section id="more" className="relative h-full bg-base-primary flex items-center justify-center overflow-hidden">
                  <img
                    src={resolvedMoreBackgroundUrl}
                    alt="More section background"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={getSectionBackgroundToneStyle()}
                  />
                  <div
                    className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
                    style={{ height: `calc(100vh - ${OVERLAY_TOP}px - ${OVERLAY_BOTTOM}px)` }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 h-full content-center">
                      {moreCards.map(card => (
                        <div
                          key={card.title}
                          className="
                          group flex flex-col
                          bg-surface-secondary hover:bg-surface-primary
                          border border-border-secondary hover:border-border-primary
                          rounded-xl p-6
                          transition-all duration-300 cursor-pointer
                        "
                        >
                          {/* Tiny brand accent line above title — echoes overlay aesthetic */}
                          <div
                            className="mb-3 w-8 h-0.5 rounded-full transition-all duration-500 group-hover:w-16"
                            style={{ background: 'var(--border-brand)' }}
                          />
                          <h3 className="text-lg font-semibold text-primary mb-2 leading-snug font-display">
                            {card.title}
                          </h3>
                          <p className="text-tertiary text-sm leading-relaxed font-core">
                            {card.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </SwiperSlide>

              {/* ── MORE ──────────────────────────────────────────── */}
              <SwiperSlide data-hash="contact" className="h-screen overflow-hidden">
                <section id="contact" className="relative h-full bg-base-primary flex items-center justify-center overflow-hidden">
                  <img
                    src={resolvedContactBackgroundUrl}
                    alt="Contact section background"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={getSectionBackgroundToneStyle()}
                  />
                  <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <FadeSection observeByKey={observeReveal} observeKey="contact-card">
                      <SectionLabel>Contact Us</SectionLabel>
                      <div className="max-w-md mx-auto bg-surface-primary p-6 rounded-lg border border-border-secondary shadow-lg">
                        <h2 className="text-xl font-semibold mb-4 text-primary font-display">Get in Touch</h2>
                        <form onSubmit={handleInquirySubmit} className="space-y-4" noValidate>
                          <div>
                            <Input
                              type="text"
                              placeholder="Name"
                              value={inquiryForm.name}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setInquiryForm({ ...inquiryForm, name: nextValue });
                                setInquiryErrors((prev) => ({ ...prev, name: '' }));
                              }}
                              name="name"
                              state={inquiryErrors.name ? 'error' : undefined}
                              error={inquiryErrors.name || undefined}
                            />
                          </div>
                          <div>
                            <div className="flex mb-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setInquiryForm({ ...inquiryForm, contactType: 'email' });
                                  setInquiryErrors((prev) => ({ ...prev, contactValue: '' }));
                                }}
                                className={`flex-1 px-3 py-1 rounded transition-colors ${inquiryForm.contactType === 'email' ? 'bg-accent text-white' : 'bg-surface-primary text-secondary border border-border-secondary'}`}
                              >
                                Email
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setInquiryForm({ ...inquiryForm, contactType: 'phone' });
                                  setInquiryErrors((prev) => ({ ...prev, contactValue: '' }));
                                }}
                                className={`flex-1 px-3 py-1 rounded transition-colors ${inquiryForm.contactType === 'phone' ? 'bg-accent text-white' : 'bg-surface-primary text-secondary border border-border-secondary'}`}
                              >
                                Phone
                              </button>
                            </div>
                            <Input
                              type={inquiryForm.contactType === 'email' ? 'email' : 'tel'}
                              placeholder={inquiryForm.contactType === 'email' ? 'your@email.com' : '+1234567890'}
                              value={inquiryForm.contactValue}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setInquiryForm({ ...inquiryForm, contactValue: nextValue });
                                setInquiryErrors((prev) => ({ ...prev, contactValue: '' }));
                              }}
                              name="contactValue"
                              state={inquiryErrors.contactValue ? 'error' : undefined}
                              error={inquiryErrors.contactValue || undefined}
                            />
                          </div>
                          <div>
                            <Input
                              multiline
                              placeholder="Message"
                              value={inquiryForm.message}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setInquiryForm({ ...inquiryForm, message: nextValue });
                                setInquiryErrors((prev) => ({ ...prev, message: '' }));
                              }}
                              name="message"
                              state={inquiryErrors.message ? 'error' : undefined}
                              error={inquiryErrors.message || undefined}
                              style={{ height: '96px', resize: 'none' }}
                            />
                          </div>
                          {turnstileConfigLoaded && turnstileEnabled && (
                            <div className="flex flex-col items-center gap-2">
                              <div ref={turnstileRef} />
                              {inquiryErrors.captcha && (
                                <p className="text-sm text-intent-danger text-center">{inquiryErrors.captcha}</p>
                              )}
                            </div>
                          )}
                          {inquiryStatus.message && (
                            <p className={`text-sm text-center ${inquiryStatus.type === 'success' ? 'text-intent-success' : 'text-intent-danger'}`}>
                              {inquiryStatus.message}
                            </p>
                          )}
                          <CustomButton type="submit" variant="blink">Send Inquiry</CustomButton>
                        </form>
                      </div>
                    </FadeSection>
                  </div>
                </section>
              </SwiperSlide>

            </Swiper>
          </SwiperProvider>
        </div>

        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
        />
      </>
    </div>
  );
};

export default LandingPage;


