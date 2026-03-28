import React, { useState, useEffect, useRef } from 'react';
import ImageUpload from '../../components/common/ImageUpload';
import Loading from '../../components/common/Loading';
import { plantIdentificationService } from '../../services/plantIdentificationService';

const UI_LOW_CONFIDENCE_THRESHOLD = 75;
const UI_MARGIN_THRESHOLD = 15;

/* ─── Section eyebrow label ─── */
const SectionLabel = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 10, height: 1.5, background: 'var(--border-brand)', flexShrink: 0, display: 'inline-block' }} />
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-secondary)',
    }}>
      {children}
    </span>
  </div>
);

/* ─── Confidence bar — animates from 0 → value on mount ─── */
const ConfidenceBar = ({ value, label }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 60);
    return () => clearTimeout(t);
  }, [value]);

  const color = value >= 80
    ? 'var(--border-success)'
    : value >= 55
    ? 'var(--border-brand)'
    : 'var(--border-warning)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--text-tertiary)',
        flexShrink: 0, width: 44, textAlign: 'right',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 2, background: 'var(--border-primary)', position: 'relative', borderRadius: 1 }}>
        <div style={{
          position: 'absolute', inset: 0, left: 0,
          width: `${width}%`,
          background: color,
          transition: 'width 700ms cubic-bezier(.23,1,.32,1)',
          borderRadius: 1,
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        color: color, flexShrink: 0, width: 36, textAlign: 'right',
      }}>
        {value}%
      </span>
    </div>
  );
};

/* ─── Thin divider ─── */
const Divider = () => (
  <div style={{ height: 1, background: 'var(--border-primary)' }} />
);

/* ─── Helpers ─── */
const buildUncertaintyView = (results) => {
  if (!results) return null;
  const modelUncertainty = results.uncertainty;
  if (modelUncertainty && typeof modelUncertainty === 'object') {
    const rawMaxProb    = modelUncertainty.max_probability    ?? modelUncertainty.maxProbability    ?? 0;
    const rawSecondProb = modelUncertainty.second_probability ?? modelUncertainty.secondProbability ?? 0;
    const rawIsUncertain = modelUncertainty.is_uncertain      ?? modelUncertainty.isUncertain       ?? false;
    const thresholds    = modelUncertainty.thresholds || {};
    const lowConfThreshold = Number(thresholds.low_confidence ?? thresholds.lowConfidence ?? (UI_LOW_CONFIDENCE_THRESHOLD / 100)) * 100;
    const marginThreshold  = Number(thresholds.margin         ?? thresholds.margin_threshold        ?? (UI_MARGIN_THRESHOLD / 100)) * 100;
    const maxProb    = Number(rawMaxProb) * 100;
    const secondProb = Number(rawSecondProb) * 100;
    const margin     = maxProb - secondProb;
    return {
      isUncertain: Boolean(rawIsUncertain),
      maxProb:    Math.max(0, maxProb),
      secondProb: Math.max(0, secondProb),
      margin:     Number.isFinite(margin) ? margin : 0,
      reasons:    Array.isArray(modelUncertainty.reasons) ? modelUncertainty.reasons : [],
      lowConfThreshold: Number.isFinite(lowConfThreshold) ? lowConfThreshold : UI_LOW_CONFIDENCE_THRESHOLD,
      marginThreshold:  Number.isFinite(marginThreshold)  ? marginThreshold  : UI_MARGIN_THRESHOLD,
    };
  }
  const top    = Number(results.confidence || 0);
  const second = Number(results.alternatives?.[0]?.confidence || 0);
  const margin = top - second;
  const reasons = [];
  if (top < UI_LOW_CONFIDENCE_THRESHOLD) reasons.push('low_confidence');
  if (margin < UI_MARGIN_THRESHOLD)      reasons.push('low_margin');
  return {
    isUncertain: reasons.length > 0, maxProb: top, secondProb: second, margin,
    reasons, lowConfThreshold: UI_LOW_CONFIDENCE_THRESHOLD, marginThreshold: UI_MARGIN_THRESHOLD,
  };
};

const formatUncertaintyReason = (reason) => {
  if (reason === 'low_confidence') return 'Top confidence is below threshold';
  if (reason === 'low_margin')     return 'Top two predictions are too close';
  if (reason === 'high_entropy')   return 'Prediction distribution is too dispersed';
  return reason;
};

const hasFeedbackData = (feedback) => {
  if (!feedback) return false;
  if (typeof feedback.isCorrect === 'boolean') return true;
  if (typeof feedback.rating === 'number') return true;
  if (typeof feedback.userCorrection === 'string' && feedback.userCorrection.trim().length > 0) return true;
  return false;
};

/* ─── Feedback star rating ─── */
const StarRating = ({ value, onChange, disabled }) => (
  <div style={{ display: 'flex', gap: 4 }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        disabled={disabled}
        onClick={() => onChange(star)}
        style={{
          background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer', padding: 2,
          color: star <= value ? 'var(--border-brand)' : 'var(--border-primary)',
          transition: 'color 150ms',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={star <= value ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </button>
    ))}
  </div>
);

/* ══════════════════════════════════════════════════
   Main page
══════════════════════════════════════════════════ */
const ImageProcessingPage = () => {
  const [images,             setImages]             = useState([]);
  const [isProcessing,       setIsProcessing]       = useState(false);
  const [results,            setResults]            = useState(null);
  const [error,              setError]              = useState(null);
  const [identificationId,   setIdentificationId]   = useState(null);
  const [resultRecordId,     setResultRecordId]     = useState(null);
  const [feedbackChoice,     setFeedbackChoice]     = useState(null);
  const [userCorrection,     setUserCorrection]     = useState('');
  const [feedbackRating,     setFeedbackRating]     = useState(3);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted,  setFeedbackSubmitted]  = useState(false);
  const [feedbackError,      setFeedbackError]      = useState(null);
  const [existingFeedback,   setExistingFeedback]   = useState(null);
  const pollingIntervalRef = useRef(null);

  /* ── Polling ── */
  useEffect(() => {
    if (identificationId && isProcessing) {
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const status = await plantIdentificationService.getIdentificationStatus(identificationId);
          if (status.data?.identification) {
            const { status: s, classification, feedback } = status.data.identification;
            const done = s === 'classified' || s === 'uncertain' || s === 'failed';
            if (done) {
              if (s !== 'failed') {
                setResults(classification);
                setResultRecordId(status.data.identification._id || identificationId);
                if (hasFeedbackData(feedback)) { setExistingFeedback(feedback); setFeedbackSubmitted(true); }
              }
              if (s === 'uncertain') setError('Prediction is uncertain — review top alternatives before relying on this result.');
              if (s === 'failed')    setError('Identification failed. Please try again.');
              setIsProcessing(false);
              setIdentificationId(null);
              clearInterval(pollingIntervalRef.current);
            }
          }
        } catch (err) { console.error('Polling error:', err); }
      }, 2000);
    }
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [identificationId, isProcessing]);

  /* ── Handlers ── */
  const handleIdentifyPlant = async () => {
    if (!images.length) { setError('Please upload an image first'); return; }
    setIsProcessing(true);
    setError(null); setResults(null); setResultRecordId(null);
    setFeedbackChoice(null); setUserCorrection(''); setFeedbackRating(3);
    setFeedbackSubmitted(false); setFeedbackError(null); setExistingFeedback(null);
    try {
      const result = await plantIdentificationService.identifyPlant(images[0].file);
      if (result?.identification) {
        if (result.identification.status === 'classified') {
          setResults(result.identification.classification);
          setResultRecordId(result.identification._id || null);
          if (hasFeedbackData(result.identification.feedback)) {
            setExistingFeedback(result.identification.feedback);
            setFeedbackSubmitted(true);
          }
          setIsProcessing(false);
        } else {
          setIdentificationId(result.identification._id);
        }
      } else {
        setError('Unexpected response format.');
        setIsProcessing(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to identify plant. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setImages([]); setResults(null); setError(null);
    setIdentificationId(null); setResultRecordId(null);
    setFeedbackChoice(null); setUserCorrection(''); setFeedbackRating(3);
    setFeedbackSubmitting(false); setFeedbackSubmitted(false);
    setFeedbackError(null); setExistingFeedback(null); setIsProcessing(false);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
  };

  const handleSubmitFeedback = async () => {
    if (!resultRecordId || feedbackChoice === null) return;
    if (feedbackChoice === false && !userCorrection.trim()) {
      setFeedbackError('Please provide the correct plant name when marking this as incorrect.');
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackError(null);
    try {
      await plantIdentificationService.submitFeedback(
        resultRecordId,
        feedbackChoice ? null : userCorrection.trim(),
        feedbackChoice,
        Number(feedbackRating)
      );
      setExistingFeedback({ isCorrect: feedbackChoice, userCorrection: feedbackChoice ? null : userCorrection.trim(), rating: Number(feedbackRating) });
      setFeedbackSubmitted(true);
    } catch (err) {
      setFeedbackError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const canIdentify      = images.length > 0 && !isProcessing;
  const uncertaintyView  = buildUncertaintyView(results);

  /* ─── Shared panel style ─── */
  const panelStyle = {
    background: 'var(--surface-primary)',
    border: '1.5px solid var(--border-primary)',
    borderLeft: '3px solid var(--border-brand)',
    borderRadius: 6,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  };

  /* ─── Input style ─── */
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px',
    background: 'var(--surface-secondary)',
    border: '1.5px solid var(--border-primary)',
    borderLeft: '3px solid var(--border-weak)',
    borderRadius: 4,
    fontFamily: 'var(--font-ui)', fontSize: 13,
    color: 'var(--text-primary)', outline: 'none',
    transition: 'border-left-color 150ms',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Plant Identification</SectionLabel>
        <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 20, fontWeight: 700, color: 'var(--text-strong)', marginTop: 8, marginBottom: 4 }}>
          Identify a Plant from a Photo
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          Upload a clear image of a plant or herb.
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* ══ LEFT — Upload ══ */}
        <div style={panelStyle}>
          <SectionLabel>Upload Image</SectionLabel>

          {/* Upload zone */}
          <div style={{ border: '1.5px solid var(--border-primary)', borderRadius: 4, overflow: 'hidden', flex: 1, minHeight: 220 }}>
            <ImageUpload
              currentImages={images}
              onImagesChange={setImages}
              maxImages={1}
              className="w-full h-full"
            />
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
              background: 'var(--surface-danger)',
              border: '1.5px solid var(--border-danger)',
              borderLeft: '3px solid var(--border-danger)',
              borderRadius: 4,
            }}>
              <svg width="14" height="14" style={{ color: 'var(--icon-danger)', flexShrink: 0, marginTop: 1 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--icon-danger)', lineHeight: 1.5, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleIdentifyPlant}
              disabled={!canIdentify}
              style={{
                flex: 1, padding: '10px 16px',
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                border: '1.5px solid var(--border-brand)',
                borderRadius: 4,
                background: canIdentify ? 'var(--interactive-brand-primary)' : 'var(--surface-secondary)',
                color: canIdentify ? 'var(--text-on-brand)' : 'var(--text-tertiary)',
                cursor: canIdentify ? 'pointer' : 'not-allowed',
                opacity: canIdentify ? 1 : 0.6,
                transition: 'opacity 150ms',
              }}
            >
              {isProcessing ? 'Identifying…' : 'Identify Plant'}
            </button>
            <button
              onClick={handleReset}
              disabled={isProcessing}
              style={{
                padding: '10px 16px',
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                border: '1.5px solid var(--border-primary)', borderRadius: 4,
                background: 'transparent', color: 'var(--text-secondary)',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.5 : 1,
                transition: 'opacity 150ms',
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* ══ RIGHT — Results ══ */}
        <div style={panelStyle}>
          <SectionLabel>Results</SectionLabel>

          {/* Processing */}
          {isProcessing && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '40px 0' }}>
              <Loading animation="bouncing" size="medium" />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                Analysing image…
              </p>
            </div>
          )}

          {/* Empty state */}
          {!results && !isProcessing && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '40px 0', textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 6,
                background: 'var(--surface-secondary)', border: '1.5px solid var(--border-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--icon-brand)' }}>
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                </svg>
              </div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, maxWidth: 200 }}>
                Upload a clear image of a plant or herb to begin identification
              </p>
            </div>
          )}

          {/* Results content */}
          {results && !isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Primary ID */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1.15, marginBottom: 4 }}>
                    {results.commonName}
                  </p>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                    {results.scientificName}
                  </p>
                </div>

                <ConfidenceBar value={results.confidence} label="Match" />

                {/* Uncertain warning */}
                {uncertaintyView?.isUncertain && (
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--surface-warning)',
                    border: '1.5px solid var(--border-warning)',
                    borderLeft: '3px solid var(--border-warning)',
                    borderRadius: 4,
                  }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-warning)', marginBottom: 6 }}>
                      Uncertain prediction
                    </p>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Top confidence {Math.round(uncertaintyView.maxProb)}%, margin to #2 is {Math.round(uncertaintyView.margin)}%.
                    </p>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      Thresholds: confidence &lt; {Math.round(uncertaintyView.lowConfThreshold)}% or margin &lt; {Math.round(uncertaintyView.marginThreshold)}%.
                    </p>
                    {uncertaintyView.reasons?.length > 0 && (
                      <ul style={{ marginTop: 6, paddingLeft: 0, listStyle: 'none' }}>
                        {uncertaintyView.reasons.map((r) => (
                          <li key={r} style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-secondary)' }}>
                            · {formatUncertaintyReason(r)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {results.processingTime && (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--text-weak)' }}>
                    Processed in {results.processingTime}ms
                  </p>
                )}
              </div>

              {/* Alternatives */}
              {results.alternatives?.length > 0 && (
                <>
                  <Divider />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <SectionLabel>Other Possibilities</SectionLabel>
                    {results.alternatives.map((alt, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div>
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{alt.commonName}</p>
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontStyle: 'italic', color: 'var(--text-tertiary)' }}>{alt.scientificName}</p>
                        </div>
                        <ConfidenceBar value={alt.confidence} label={`#${i + 2}`} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Feedback */}
              {resultRecordId && (
                <>
                  <Divider />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <SectionLabel>Help Improve Results</SectionLabel>

                    {!feedbackSubmitted ? (
                      <>
                        {/* Correct / Incorrect toggle */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[{ label: 'Correct', value: true }, { label: 'Incorrect', value: false }].map((opt) => (
                            <button
                              key={String(opt.value)}
                              type="button"
                              disabled={feedbackSubmitting}
                              onClick={() => { setFeedbackChoice(opt.value); setFeedbackError(null); }}
                              style={{
                                padding: '7px 14px',
                                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                                letterSpacing: '0.12em', textTransform: 'uppercase',
                                border: '1.5px solid',
                                borderColor: feedbackChoice === opt.value ? 'var(--border-brand)' : 'var(--border-primary)',
                                borderRadius: 4,
                                background: feedbackChoice === opt.value ? 'var(--interactive-brand-primary)' : 'transparent',
                                color: feedbackChoice === opt.value ? 'var(--text-on-brand)' : 'var(--text-secondary)',
                                cursor: feedbackSubmitting ? 'not-allowed' : 'pointer',
                                transition: 'all 150ms',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Correction input */}
                        {feedbackChoice === false && (
                          <input
                            type="text"
                            value={userCorrection}
                            onChange={(e) => setUserCorrection(e.target.value)}
                            placeholder="Enter the correct plant name"
                            disabled={feedbackSubmitting}
                            style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.borderLeftColor = 'var(--border-brand)'; }}
                            onBlur={(e)  => { e.currentTarget.style.borderLeftColor = 'var(--border-weak)'; }}
                          />
                        )}

                        {/* Rating + submit */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                            Rating
                          </span>
                          <StarRating value={feedbackRating} onChange={setFeedbackRating} disabled={feedbackSubmitting} />
                          <button
                            type="button"
                            onClick={handleSubmitFeedback}
                            disabled={feedbackSubmitting || feedbackChoice === null}
                            style={{
                              marginLeft: 'auto',
                              padding: '7px 14px',
                              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                              letterSpacing: '0.14em', textTransform: 'uppercase',
                              border: '1.5px solid var(--border-brand)', borderRadius: 4,
                              background: 'var(--interactive-brand-primary)',
                              color: 'var(--text-on-brand)',
                              cursor: (feedbackSubmitting || feedbackChoice === null) ? 'not-allowed' : 'pointer',
                              opacity: (feedbackSubmitting || feedbackChoice === null) ? 0.5 : 1,
                              transition: 'opacity 150ms',
                            }}
                          >
                            {feedbackSubmitting ? 'Submitting…' : 'Submit'}
                          </button>
                        </div>

                        {feedbackError && (
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--icon-danger)' }}>{feedbackError}</p>
                        )}
                      </>
                    ) : (
                      <div style={{
                        padding: '10px 12px',
                        background: 'var(--color-intent-success-weak)',
                        border: '1.5px solid var(--border-success)',
                        borderLeft: '3px solid var(--border-success)',
                        borderRadius: 4,
                      }}>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-success)', marginBottom: 4 }}>
                          Feedback submitted
                        </p>
                        {existingFeedback && (
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                            {typeof existingFeedback.isCorrect === 'boolean'
                              ? `Marked as ${existingFeedback.isCorrect ? 'correct' : 'incorrect'}`
                              : 'Feedback recorded'}
                            {typeof existingFeedback.rating === 'number' ? ` · ${existingFeedback.rating}/5 stars` : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageProcessingPage;