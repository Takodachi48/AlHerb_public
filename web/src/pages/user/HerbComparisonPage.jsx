import React, { useMemo, useState, useRef, useCallback } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Dropdown from '../../components/common/Dropdown';
import Input from '../../components/common/Input';
import { herbService } from '../../services/herbService';

const AGE_GROUP_OPTIONS = [
  { label: 'Adult',   value: 'adult' },
  { label: 'Child',   value: 'child' },
  { label: 'Elderly', value: 'elderly' },
];

/* ─── Shared label component ─── */
const FieldLabel = ({ children, error }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5,
    fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
    letterSpacing: '0.18em', textTransform: 'uppercase',
    color: error ? 'var(--icon-danger)' : 'var(--text-secondary)',
  }}>
    <span style={{ width: 10, height: 1.5, background: error ? 'var(--border-danger)' : 'var(--border-brand)', flexShrink: 0, display: 'inline-block' }} />
    {children}
  </div>
);

/* ─── Status pill (replaces broken Tailwind opacity classes) ─── */
const STATUS_STYLES = {
  strong:        { background: 'var(--color-intent-success-weak)', color: 'var(--text-success)',   borderColor: 'var(--border-success)' },
  partial:       { background: 'var(--color-intent-warning-weak)', color: 'var(--text-warning)',   borderColor: 'var(--border-warning)' },
  none:          { background: 'var(--color-intent-danger-weak)',  color: 'var(--icon-danger)',    borderColor: 'var(--border-danger)' },
  not_evaluated: { background: 'var(--surface-secondary)',         color: 'var(--text-tertiary)',  borderColor: 'var(--border-primary)' },
};

const StatusPill = ({ status, label }) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES.not_evaluated;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4,
      border: `1px solid ${style.borderColor}`,
      background: style.background, color: style.color,
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.1em', textTransform: 'uppercase',
    }}>
      {label || status}
    </span>
  );
};

const buildPlaceholderImage = (name = 'No Image') => `data:image/svg+xml;base64,${btoa(`
  <svg width="420" height="260" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#1a1f1a"/>
    <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#4a5f4a" font-family="system-ui,sans-serif" font-size="14">${name}</text>
  </svg>
`)}`;

/* ══════════════════════════════════════════════════
   HerbSelector — autocomplete combobox
   Bug fixed: selection no longer reopens the dropdown
   because we track a `justSelected` ref and skip the
   next `onChange`-triggered search if it fired from
   a selection event.
══════════════════════════════════════════════════ */
const HerbSelector = ({ label, value, onSelect, excludeSlug, fieldError, selectorId }) => {
  const [query,   setQuery]   = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [searchError, setSearchError] = useState('');
  const [skipNextSearch, setSkipNextSearch] = useState(false);

  const containerRef = useRef(null);

  /* Sync query when external value changes (e.g. swap) */
  React.useEffect(() => {
    setSkipNextSearch(true);
    setQuery(value?.name || '');
    setResults([]);
    setOpen(false);
    // Clear the flag in the next tick
    Promise.resolve().then(() => {
      setSkipNextSearch(false);
    });
  }, [value, selectorId]);

  /* Search effect — skipped on the cycle after a selection */
  React.useEffect(() => {
    if (skipNextSearch) {
      return;
    }
    if (!query || query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setSearchError('');
        const response = await herbService.searchHerbs(query);
        const herbs = Array.isArray(response?.data) ? response.data : [];
        const mapped = herbs
          .filter((h) => h?.isActive !== false && h?.slug !== excludeSlug)
          .slice(0, 8)
          .map((h) => ({ slug: h.slug, name: h.name, scientificName: h.scientificName }));
        if (!cancelled) {
          setResults(mapped);
          setOpen(mapped.length > 0);
        }
      } catch (err) {
        if (!cancelled) { setSearchError(err?.message || 'Search failed'); setResults([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [query, excludeSlug, skipNextSearch]);

  /* Close on click outside */
  React.useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSelect = useCallback((item) => {
    setSkipNextSearch(true);
    setQuery(item.name);
    setResults([]);
    setOpen(false);
    onSelect(item);
    // Clear the flag in the next tick
    Promise.resolve().then(() => {
      setSkipNextSearch(false);
    });
  }, [onSelect]);

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px',
    background: 'var(--surface-secondary)',
    border: `1.5px solid ${fieldError ? 'var(--border-danger)' : 'var(--border-primary)'}`,
    borderLeft: `3px solid ${fieldError ? 'var(--border-danger)' : 'var(--border-weak)'}`,
    borderRadius: 4, outline: 'none',
    fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-primary)',
    transition: 'border-left-color 150ms',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <FieldLabel error={fieldError}>{label}</FieldLabel>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          // If user is clearing/editing, open results again
          if (e.target.value !== value?.name) setOpen(true);
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderLeftColor = fieldError ? 'var(--border-danger)' : 'var(--border-brand)';
          if (results.length > 0) setOpen(true);
        }}
        placeholder="Search active herbs…"
        style={inputStyle}
        onBlur={(e) => {
          e.currentTarget.style.borderLeftColor = fieldError ? 'var(--border-danger)' : 'var(--border-weak)';
        }}
      />

      {fieldError && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--icon-danger)', marginTop: 4 }}>
          {fieldError}
        </p>
      )}
      {loading && (
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
          Searching…
        </span>
      )}
      {searchError && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--icon-danger)', marginTop: 4 }}>{searchError}</p>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="autocomplete-menu" style={{ position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, right: 0 }}>
          {results.map((item) => (
            <div
              key={item.slug}
              className="autocomplete-item"
              /* Use onMouseDown so it fires before onBlur */
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur
                handleSelect(item);
              }}
            >
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{item.name}</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{item.scientificName}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Tag diff list ─── */
const ListDiff = ({ title, shared = [], unique = [], uniqueLabel }) => (
  <div>
    <FieldLabel>{title}</FieldLabel>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
      {shared.map((item) => (
        <span key={`shared-${item}`} className="tag">{item}</span>
      ))}
      {unique.map((item) => (
        <span key={`unique-${item}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 4,
          border: '1px solid var(--border-accent)',
          background: 'var(--surface-accent)',
          color: 'var(--text-accent)',
          fontFamily: 'var(--font-ui)', fontSize: 11,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-accent-primary)', flexShrink: 0 }} />
          {item}
        </span>
      ))}
      {shared.length === 0 && unique.length === 0 && (
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)' }}>No data available.</span>
      )}
    </div>
    {unique.length > 0 && (
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-accent)' }}>
        Unique advantage: {uniqueLabel}
      </p>
    )}
  </div>
);

/* ─── Single herb panel ─── */
const HerbPanel = ({ herb, side, comparison }) => {
  const symptomBadge = comparison?.symptomMatch?.[side] || { status: 'not_evaluated', label: 'Not evaluated' };
  const dosage  = comparison?.dosage?.[side]        || {};
  const evidence = comparison?.evidenceScore?.[side] || {};
  const safety  = comparison?.safetyScore?.[side]   || {};

  return (
    <div className="card" style={{ height: '100%', overflow: 'hidden', padding: 0, borderLeftColor: 'var(--border-brand)' }}>
      {/* Image */}
      <img
        src={herb?.image || buildPlaceholderImage(herb?.name || 'No Image')}
        alt={herb?.name || 'Herb image'}
        style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
      />

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Name */}
        <div>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
            {herb?.name || 'Unknown'}
          </h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontStyle: 'italic', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            {herb?.scientificName || 'No scientific name'}
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {herb?.description || 'No description provided.'}
          </p>
        </div>

        {/* Target symptom */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <FieldLabel>Target Symptom</FieldLabel>
          <StatusPill
            status={symptomBadge.status}
            label={
              symptomBadge.status === 'strong'  ? 'Strong match'  :
              symptomBadge.status === 'partial' ? 'Partial match' :
              symptomBadge.label
            }
          />
        </div>

        {/* Dosage */}
        <div>
          <FieldLabel>Dosage ({comparison?.dosage?.ageGroup || 'adult'})</FieldLabel>
          {dosage?.hasData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
              <span>Min: {dosage.min || 'n/a'} {dosage.unit || ''}</span>
              <span>Max: {dosage.max || 'n/a'} {dosage.unit || ''}</span>
              <span>Freq: {dosage.frequency || 'n/a'}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{dosage.sourceCount || 0} sources</span>
            </div>
          ) : (
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-warning)' }}>Insufficient dosage data</span>
          )}
        </div>

        {/* Preparation */}
        <div>
          <FieldLabel>Preparation Methods</FieldLabel>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)' }}>
            {(herb?.preparation || []).length > 0
              ? herb.preparation.map((p) => p.method).filter(Boolean).join(', ')
              : 'No preparation data'}
          </p>
        </div>

        {/* Phytochemicals */}
        <div>
          <FieldLabel>Phytochemicals</FieldLabel>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)' }}>
            {(herb?.phytochemicals || []).length} compounds documented
          </p>
        </div>

        {/* Evidence */}
        <div>
          <FieldLabel>Evidence</FieldLabel>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)' }}>
            {evidence.badge || 'Limited Sources'} · {evidence.sourceCount || 0} sources
          </p>
        </div>

        {/* Safety */}
        <div>
          <FieldLabel>Safety Context</FieldLabel>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
            {safety.hasSafetyProfile ? 'Safety profile available' : 'No safety profile'}
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
            Contraindications: {safety.contraindicationCount || 0} · Interactions: {safety.interactionCount || 0}
          </p>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   Main page
══════════════════════════════════════════════════ */
const HerbComparisonPage = () => {
  const [herb1, setHerb1] = useState(null);
  const [herb2, setHerb2] = useState(null);
  const [ageGroup, setAgeGroup] = useState('adult');
  const [symptom, setSymptom] = useState('');
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const selected = useMemo(() => ({ herb1, herb2 }), [herb1, herb2]);

  const runComparison = async () => {
    const nextErrors = {};
    if (!selected.herb1?.slug) nextErrors.herb1 = 'Select the first herb';
    if (!selected.herb2?.slug) nextErrors.herb2 = 'Select the second herb';
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError('Please complete the required herb selections.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setFieldErrors({});
      const response = await herbService.compareHerbs({
        herb1: selected.herb1.slug,
        herb2: selected.herb2.slug,
        symptom: symptom.trim(),
        ageGroup,
        includeSafety: true,
      });
      setComparisonData(response?.data || null);
    } catch (err) {
      setError(err?.details || err?.message || 'Failed to compare herbs');
      setComparisonData(null);
    } finally {
      setLoading(false);
    }
  };

  const swapHerbs = () => {
    setHerb1(herb2);
    setHerb2(herb1);
    setComparisonData(null);
  };

  const comparison  = comparisonData?.comparison;
  const betterOption = comparison?.betterOption || 'equal';

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px',
    background: 'var(--surface-secondary)',
    border: '1.5px solid var(--border-primary)',
    borderLeft: '3px solid var(--border-weak)',
    borderRadius: 4, outline: 'none',
    fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-primary)',
    transition: 'border-left-color 150ms',
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Search / filter card ── */}
      <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Herb selectors + swap */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end' }}>
          <HerbSelector
            label="Herb 1"
            value={herb1}
            onSelect={(item) => { setHerb1(item); setFieldErrors((p) => ({ ...p, herb1: '' })); }}
            excludeSlug={herb2?.slug}
            fieldError={fieldErrors.herb1}
            selectorId="herb1"
          />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
            <button
              type="button"
              onClick={swapHerbs}
              disabled={!herb1 && !herb2}
              title="Swap herbs"
              style={{
                width: 34, height: 34, borderRadius: 4, cursor: (!herb1 && !herb2) ? 'not-allowed' : 'pointer',
                border: '1.5px solid var(--border-primary)', background: 'var(--surface-secondary)',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: (!herb1 && !herb2) ? 0.4 : 1, transition: 'opacity 150ms',
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          <HerbSelector
            label="Herb 2"
            value={herb2}
            onSelect={(item) => { setHerb2(item); setFieldErrors((p) => ({ ...p, herb2: '' })); }}
            excludeSlug={herb1?.slug}
            fieldError={fieldErrors.herb2}
            selectorId="herb2"
          />
        </div>

        {/* Symptom + age group + compare */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 10, alignItems: 'end' }}>
          <div>
            <FieldLabel>Compare for symptom (optional)</FieldLabel>
            <input
              type="text"
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              placeholder="e.g. headache"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderLeftColor = 'var(--border-brand)'; }}
              onBlur={(e)  => { e.currentTarget.style.borderLeftColor = 'var(--border-weak)'; }}
            />
          </div>
          <div>
            <FieldLabel>Age group</FieldLabel>
            <Dropdown
              value={ageGroup}
              onChange={setAgeGroup}
              options={AGE_GROUP_OPTIONS}
              size="sm"
            />
          </div>
          <Button
            type="button"
            onClick={runComparison}
            disabled={loading || !herb1 || !herb2}
            style={{ alignSelf: 'flex-end' }}
          >
            {loading ? 'Comparing…' : 'Compare'}
          </Button>
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--icon-danger)', margin: 0 }}>{error}</p>
        )}
      </div>

      {/* ── Results ── */}
      {comparisonData && (
        <>
          {/* Better option banner */}
          <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderLeftColor: 'var(--border-brand)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Better option
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: 4,
              border: '1.5px solid var(--border-accent)',
              background: 'var(--surface-accent)',
              color: 'var(--text-accent)',
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
            }}>
              {betterOption === 'herb1' ? comparisonData.herb1.name
                : betterOption === 'herb2' ? comparisonData.herb2.name
                : 'Nearly Equal'}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {comparison?.disclaimer || 'Informational only — not medical advice.'}
            </span>
          </div>

          {/* Side-by-side herb panels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <HerbPanel herb={comparisonData.herb1} side="herb1" comparison={comparison} />
            <HerbPanel herb={comparisonData.herb2} side="herb2" comparison={comparison} />
          </div>

          {/* Deep comparison card */}
          <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Symptom coverage */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ListDiff
                title={`Symptoms — ${comparisonData.herb1.name}`}
                shared={comparison?.sharedSymptoms || []}
                unique={comparison?.uniqueToHerb1 || []}
                uniqueLabel={`${comparisonData.herb1.name} has unique symptom coverage`}
              />
              <ListDiff
                title={`Symptoms — ${comparisonData.herb2.name}`}
                shared={comparison?.sharedSymptoms || []}
                unique={comparison?.uniqueToHerb2 || []}
                uniqueLabel={`${comparisonData.herb2.name} has unique symptom coverage`}
              />
            </div>

            <div style={{ height: 1, background: 'var(--border-primary)' }} />

            {/* Preparation methods */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ListDiff
                title={`Preparation — ${comparisonData.herb1.name}`}
                shared={comparison?.preparation?.sharedMethods || []}
                unique={comparison?.preparation?.uniqueToHerb1 || []}
                uniqueLabel={`${comparisonData.herb1.name} provides additional prep methods`}
              />
              <ListDiff
                title={`Preparation — ${comparisonData.herb2.name}`}
                shared={comparison?.preparation?.sharedMethods || []}
                unique={comparison?.preparation?.uniqueToHerb2 || []}
                uniqueLabel={`${comparisonData.herb2.name} provides additional prep methods`}
              />
            </div>

            <div style={{ height: 1, background: 'var(--border-primary)' }} />

            {/* Reasoning */}
            <div>
              <FieldLabel>Comparison reasoning</FieldLabel>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(comparison?.reasoning || []).map((line) => (
                  <li key={line} style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--border-brand)', flexShrink: 0 }}>·</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ height: 1, background: 'var(--border-primary)' }} />

            {/* Safety detail */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { name: comparisonData.herb1.name, data: comparisonData.herb1 },
                { name: comparisonData.herb2.name, data: comparisonData.herb2 },
              ].map(({ name, data }) => (
                <div key={name}>
                  <FieldLabel>{name} — safety</FieldLabel>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                    Contraindications: {(data?.contraindications || []).length}<br />
                    Interactions: {(data?.interactions || []).length}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HerbComparisonPage;