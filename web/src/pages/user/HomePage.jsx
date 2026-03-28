import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Dropdown from '../../components/common/Dropdown';
import DatePicker from '../../components/common/DatePicker';
import HerbCard from '../../components/herbs/HerbCard';
import { useAuth } from '../../hooks/useAuth';
import { herbService } from '../../services/herbService';
import userProfileService from '../../services/userProfileService';
import { Camera, Lightbulb, Map, BookOpen } from 'lucide-react';

/* ─────────────────────────────────────────────
   Tiny helpers
───────────────────────────────────────────── */
const FieldLabel = ({ children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5,
    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: 'var(--text-secondary)',
  }}>
    <span style={{ width: 10, height: 1.5, background: 'var(--border-brand)', flexShrink: 0, display: 'inline-block' }} />
    {children}
  </div>
);

const StatChip = ({ value, label, accent }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: 3,
    padding: '10px 16px',
    background: 'var(--surface-secondary)',
    border: '1.5px solid var(--border-primary)',
    borderLeft: `3px solid ${accent || 'var(--border-brand)'}`,
    borderRadius: 6,
    minWidth: 80,
  }}>
    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1 }}>
      {value ?? '—'}
    </span>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
      {label}
    </span>
  </div>
);

const QuickActionCard = ({ label, description, icon, onClick, accentColor, arrowColor }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="card card--hover"
      style={{
        padding: '18px 20px',
        cursor: 'pointer',
        borderLeftColor: hovered ? (accentColor || 'var(--border-brand)') : 'var(--border-weak)',
        boxShadow: hovered ? `3px 3px 0 var(--surface-tertiary)` : 'none',
        transition: 'border-left-color 150ms, box-shadow 150ms',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 6, flexShrink: 0,
          background: 'var(--surface-secondary)',
          border: '1.5px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accentColor || 'var(--icon-accent)',
          transition: 'border-color 150ms',
          borderColor: hovered ? (accentColor || 'var(--border-brand)') : 'var(--border-primary)',
        }}>
          {icon}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{
            color: 'var(--text-tertiary)',
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translate(2px, -2px)' : 'translate(0,0)',
            transition: 'opacity 150ms, transform 150ms',
            flexShrink: 0, marginTop: 2,
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M7 7h10v10" />
        </svg>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {label}
        </div>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [featuredHerbs, setFeaturedHerbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [needsDemographics, setNeedsDemographics] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [savingDemographics, setSavingDemographics] = useState(false);
  const [dismissedDemographics, setDismissedDemographics] = useState(false);
  const [stats, setStats] = useState({ favorites: 0, viewed: 0, joinedDaysAgo: null });

  const genderOptions = [
    { value: '', label: 'Select gender' },
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
  ];

  useEffect(() => { loadHomeData(); }, [user]);
  useEffect(() => { if (!user) return; loadProfileDemographics(); }, [user]);

  const loadHomeData = async () => {
    try {
      if (user) {
        const featuredData = await herbService.getFavoriteHerbs();
        const favorites = featuredData?.data || featuredData || [];
        const list = Array.isArray(favorites) ? favorites : [];

        const fullHerbDetails = await Promise.all(
          list.map(async (herb) => {
            try {
              const herbId = herb._id || herb.id;
              const fullHerb = await herbService.getHerbById(herbId);
              return fullHerb?.data || fullHerb || herb;
            } catch {
              return herb;
            }
          })
        );

        setFeaturedHerbs(fullHerbDetails);
        setFavoriteIds(new Set(fullHerbDetails.map((item) => item?._id || item?.id).filter(Boolean)));

        // Derive join date stat
        const joinedDaysAgo = user.createdAt
          ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000)
          : null;
        setStats({ favorites: fullHerbDetails.length, viewed: 0, joinedDaysAgo });
      } else {
        setFeaturedHerbs([]);
        setFavoriteIds(new Set());
      }
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileDemographics = async () => {
    try {
      setProfileLoading(true);
      setProfileError('');
      const profile = await userProfileService.getProfile();
      const p = profile && typeof profile === 'object' ? profile : {};
      setNeedsDemographics(!(p.dateOfBirth && p.gender));
      setDateOfBirth(p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '');
      setGender(p.gender || '');
    } catch (err) {
      setProfileError(err?.message || 'Failed to load profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const saveDemographics = async (e) => {
    e.preventDefault();
    if (!dateOfBirth || !gender) { setProfileError('Birth date and gender are required.'); return; }
    try {
      setSavingDemographics(true);
      setProfileError('');
      await userProfileService.updateProfile({ dateOfBirth, gender });
      setNeedsDemographics(false);
    } catch (err) {
      setProfileError(err?.details || err?.message || 'Failed to update profile.');
    } finally {
      setSavingDemographics(false);
    }
  };

  const handleViewHerbDetails = (herb) => navigate(`/herbs/${herb._id}`);

  const handleToggleFavorite = async (herb) => {
    const herbId = herb?._id || herb?.id;
    if (!user || !herbId || favoriteBusy[herbId]) return;
    const wasFavorite = favoriteIds.has(herbId);
    const prevFavorites = new Set(favoriteIds);
    const nextFavorites = new Set(favoriteIds);
    if (wasFavorite) {
      nextFavorites.delete(herbId);
      setFeaturedHerbs((prev) => prev.filter((item) => (item._id || item.id) !== herbId));
    } else {
      nextFavorites.add(herbId);
      setFeaturedHerbs((prev) => (prev.some((item) => (item._id || item.id) === herbId) ? prev : [herb, ...prev]));
    }
    setFavoriteBusy((prev) => ({ ...prev, [herbId]: true }));
    setFavoriteIds(nextFavorites);
    try {
      if (wasFavorite) await herbService.removeFromFavorites(herbId);
      else await herbService.addToFavorites(herbId);
    } catch {
      setFavoriteIds(prevFavorites);
      setFeaturedHerbs((prev) => {
        if (wasFavorite) return prev.some((item) => (item._id || item.id) === herbId) ? prev : [herb, ...prev];
        return prev.filter((item) => (item._id || item.id) !== herbId);
      });
    } finally {
      setFavoriteBusy((prev) => ({ ...prev, [herbId]: false }));
    }
  };

  const quickActions = [
    {
      label: 'Get Recommendations',
      description: 'Personalised herb suggestions based on your symptoms and health profile.',
      path: '/recommendation',
      accent: 'var(--border-brand)',
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      label: 'Identify Plants',
      description: 'Upload a photo to identify a medicinal plant quickly.',
      path: '/image-processing',
      accent: 'var(--border-success)',
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Find Locations',
      description: 'Locate nearby herb markets, shops, and foraging spots on the map.',
      path: '/map',
      accent: 'var(--border-accent)',
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Browse Herb Library',
      description: 'Explore the full catalogue of documented medicinal herbs.',
      path: '/herbs',
      accent: 'var(--border-warning)',
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ];

  /* ── section wrapper style ── */
  const sectionStyle = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };
  const divider = { borderTop: '1.5px solid var(--border-primary)', margin: '0 24px' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--base-tertiary)', paddingBottom: 64 }}>

      {/* ════════════════════════════════════════
          UNAUTHENTICATED HERO
      ════════════════════════════════════════ */}
      {!user && (
        <div style={{ background: 'var(--surface-primary)', borderBottom: '1.5px solid var(--border-primary)', boxShadow: '0 1px 0 0 var(--border-brand)' }}>
          <div style={{ ...sectionStyle, padding: '56px 24px 48px' }}>
            <div style={{ maxWidth: 560 }}>
              {/* Eyebrow */}
              <FieldLabel>Medicinal Herb Platform</FieldLabel>
              <h1 style={{
                fontFamily: 'var(--font-ui)', fontSize: 36, fontWeight: 800,
                color: 'var(--text-strong)', lineHeight: 1.15, marginBottom: 14, marginTop: 10,
              }}>
                Discover the plants<br />that heal.
              </h1>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: 28, maxWidth: 440 }}>
                Identify medicinal herbs from photos, get symptom-based recommendations, find nearby herb markets, and build your personal herb library.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="primary" onClick={() => navigate('/register')}>
                  Get started free
                </Button>
                <Button variant="outline" onClick={() => navigate('/login')}>
                  Sign in
                </Button>
              </div>
            </div>

            {/* Feature bullets */}
            <div style={{ display: 'flex', gap: 10, marginTop: 36, flexWrap: 'wrap' }}>
              {[
                { label: 'AI plant identification', icon: <Camera size={14} /> },
                { label: 'Symptom-based recommendations', icon: <Lightbulb size={14} /> },
                { label: 'Interactive herb map', icon: <Map size={14} /> },
                { label: 'Curated herb library', icon: <BookOpen size={14} /> },
              ].map((f) => (
                <div key={f.label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '5px 12px 5px 8px',
                  background: 'var(--surface-secondary)',
                  border: '1.5px solid var(--border-primary)',
                  borderLeft: '3px solid var(--border-brand)',
                  borderRadius: 6,
                  fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          AUTHENTICATED WELCOME CARD
      ════════════════════════════════════════ */}
      {user && (
        <div style={{ padding: '24px 24px 0', maxWidth: 1200, margin: '0 auto' }}>
          <div className="card" style={{ borderLeftColor: 'var(--border-brand)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>

              {/* Left: greeting */}
              <div style={{ minWidth: 0 }}>
                <FieldLabel>Dashboard</FieldLabel>
                <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.2, marginBottom: 4 }}>
                  Welcome back, {user.displayName || user.name || 'User'}
                </h1>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                  Here's your herb activity at a glance.
                </p>
              </div>

              {/* Right: stat chips */}
              {!loading && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                  <StatChip value={stats.favorites} label="Favourites" accent="var(--border-brand)" />
                  {stats.joinedDaysAgo !== null && (
                    <StatChip value={stats.joinedDaysAgo} label="Days active" accent="var(--border-accent)" />
                  )}
                </div>
              )}
              {loading && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ width: 90, height: 62, borderRadius: 6, background: 'var(--surface-tertiary)', animation: 'pulse 1.5s infinite' }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          DEMOGRAPHICS BANNER (dismissible)
      ════════════════════════════════════════ */}
      {user && !profileLoading && needsDemographics && !dismissedDemographics && (
        <div style={{ padding: '12px 24px 0', maxWidth: 1200, margin: '0 auto' }}>
          <div className="card" style={{ borderLeftColor: 'var(--border-warning)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div>
                <FieldLabel>Profile setup</FieldLabel>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Add your birth date and gender to unlock personalised recommendations.
                </p>
              </div>
              <button
                onClick={() => setDismissedDemographics(true)}
                className="btn-icon"
                style={{ flexShrink: 0, width: 24, height: 24, border: 'none', background: 'transparent' }}
                aria-label="Dismiss"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={saveDemographics} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }} noValidate>
              <div>
                <FieldLabel>Birth date</FieldLabel>
                <DatePicker
                  mode="birthdate"
                  variant="scroll"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  maxDate={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div>
                <FieldLabel>Gender</FieldLabel>
                <Dropdown
                  value={gender}
                  onChange={(v) => setGender(v)}
                  options={genderOptions}
                  size="sm"
                />
              </div>
              <Button type="submit" size="sm" disabled={savingDemographics}>
                {savingDemographics ? 'Saving…' : 'Save'}
              </Button>
            </form>

            {profileError && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--icon-danger)', marginTop: 8 }}>
                {profileError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          QUICK ACTIONS
      ════════════════════════════════════════ */}
      <div style={{ padding: '32px 24px 0', maxWidth: 1200, margin: '0 auto' }}>
        <FieldLabel>Quick Actions</FieldLabel>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, marginTop: 6 }}>
          What would you like to do?
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.path}
              label={action.label}
              description={action.description}
              icon={action.icon}
              onClick={() => navigate(action.path)}
              accentColor={action.accent}
            />
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════
          FAVOURITE HERBS
      ════════════════════════════════════════ */}
      {user && (
        <div style={{ padding: '40px 24px 0', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <FieldLabel>Your collection</FieldLabel>
              <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
                Favourite Herbs
              </h2>
            </div>
            {featuredHerbs.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => navigate('/herbs')}>
                Browse all herbs →
              </Button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 180, borderRadius: 6, background: 'var(--surface-secondary)', border: '1.5px solid var(--border-primary)', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : featuredHerbs.length > 0 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {featuredHerbs.map((herb) => (
                  <HerbCard
                    key={herb._id}
                    herb={herb}
                    onViewDetails={handleViewHerbDetails}
                    onToggleFavorite={user ? handleToggleFavorite : undefined}
                    isFavorite={favoriteIds.has(herb._id)}
                    favoriteBusy={Boolean(favoriteBusy[herb._id])}
                  />
                ))}
              </div>
              {/* Mobile view-all */}
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }} className="md:hidden">
                <Button variant="outline" size="sm" onClick={() => navigate('/herbs')}>
                  View all herbs
                </Button>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="card" style={{ padding: '32px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 6, flexShrink: 0,
                background: 'var(--surface-secondary)',
                border: '1.5px solid var(--border-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                  No favourites yet
                </div>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  Browse the herb library and pin any herb to see it here for quick access.
                </p>
              </div>
              <Button size="sm" onClick={() => navigate('/herbs')} style={{ flexShrink: 0 }}>
                Browse herbs
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          LOGGED-OUT BOTTOM CTA
      ════════════════════════════════════════ */}
      {!user && (
        <div style={{ padding: '48px 24px 0', maxWidth: 1200, margin: '0 auto' }}>
          <div className="card" style={{ borderLeftColor: 'var(--border-brand)', padding: '24px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <FieldLabel>Get started</FieldLabel>
                <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6, marginBottom: 4 }}>
                  Create a free account
                </h3>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                  Save favourites, get recommendations, and track your herbs.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Button variant="primary" onClick={() => navigate('/register')}>Register</Button>
                <Button variant="outline" onClick={() => navigate('/login')}>Sign in</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;