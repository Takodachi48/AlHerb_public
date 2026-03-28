import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';

/* ─────────────────────────────────────────────────────
   CONSTANTS
 ───────────────────────────────────────────────────── */
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_HEADS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/* ─────────────────────────────────────────────────────
   DATE UTILS
 ───────────────────────────────────────────────────── */
const toISOStr = (date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Parse ISO string as local date (avoids UTC midnight shifting the day)
const parseDate = (value) => {
  if (!value) return null;
  const parts = String(value).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return isNaN(date.getTime()) ? null : date;
};

const sameDay = (a, b) =>
  a instanceof Date && b instanceof Date &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const fmtDisplay = (date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

const fmtShort = (date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS_SHORT[date.getMonth()]}`;
};

/* ─────────────────────────────────────────────────────
   BIRTHDATE UTILS  (unchanged from original)
 ───────────────────────────────────────────────────── */
const clampBirthdate = ({ day, month, year }) => {
  const safeYear = Math.max(1900, Math.min(new Date().getFullYear(), Number(year) || 1990));
  const safeMonth = Math.max(1, Math.min(12, Number(month) || 1));
  const maxDay = new Date(safeYear, safeMonth, 0).getDate();
  const safeDay = Math.max(1, Math.min(maxDay, Number(day) || 1));
  return { day: safeDay, month: safeMonth, year: safeYear };
};

const birthValueToParts = (value) => {
  const date = parseDate(value);
  if (!date) return { day: 14, month: 4, year: 1990 };
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
};

const partsToBirthValue = (parts) => {
  const p = clampBirthdate(parts);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

/* ─────────────────────────────────────────────────────
   CUSTOM CALENDAR
   Shared by Period and Sampling Window variants.
 ───────────────────────────────────────────────────── */
function CustomCalendar({ rangeStart, rangeEnd, onSelect, activePreset, onPreset, quickPresets = [7, 30, 90, 365] }) {
  const anchor = rangeEnd || rangeStart || new Date();
  const [viewYear, setViewYear] = useState(anchor.getFullYear());
  const [viewMonth, setViewMonth] = useState(anchor.getMonth());
  // pending = first click awaiting second click
  const [pending, setPending] = useState(null);
  const [previewStart, setPreviewStart] = useState(null);
  const [previewEnd, setPreviewEnd] = useState(null);

  const prevMonth = () => setViewMonth(m => {
    if (m === 0) { setViewYear(y => y - 1); return 11; }
    return m - 1;
  });
  const nextMonth = () => setViewMonth(m => {
    if (m === 11) { setViewYear(y => y + 1); return 0; }
    return m + 1;
  });

  const handleDayClick = (date) => {
    if (!pending) {
      setPending(date);
      setPreviewStart(date);
      setPreviewEnd(null);
      onSelect({ start: date, end: null });
    } else {
      const [s, e] = date < pending ? [date, pending] : [pending, date];
      setPending(null);
      setPreviewStart(null);
      setPreviewEnd(null);
      onSelect({ start: s, end: e });
    }
  };

  const handleDayHover = (date) => {
    if (pending) {
      const [s, e] = date < pending ? [date, pending] : [pending, date];
      setPreviewStart(s);
      setPreviewEnd(e);
    }
  };

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const cells = [];
    for (let i = 0; i < offset; i++)
      cells.push({ date: new Date(viewYear, viewMonth, -offset + i + 1), other: true });
    for (let d = 1; d <= last.getDate(); d++)
      cells.push({ date: new Date(viewYear, viewMonth, d), other: false });
    while (cells.length < 42)
      cells.push({ date: new Date(viewYear, viewMonth + 1, cells.length - offset - last.getDate() + 1), other: true });
    return cells;
  }, [viewYear, viewMonth]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const effectiveStart = previewStart || rangeStart;
  const effectiveEnd = previewEnd || rangeEnd;
  const diffDays = effectiveStart && effectiveEnd
    ? Math.round((effectiveEnd - effectiveStart) / 86400000)
    : null;

  return (
    <div className="dp__calendar">

      {/* Header */}
      <div className="dp__cal-header">
        <button type="button" className="dp__cal-nav" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft size={12} />
        </button>
        <div className="dp__cal-month-label">
          {MONTHS_LONG[viewMonth]}
          <span className="dp__cal-year">{viewYear}</span>
        </div>
        <button type="button" className="dp__cal-nav" onClick={nextMonth} aria-label="Next month">
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Grid */}
      <div className="dp__cal-grid">
        <div className="dp__cal-days-head">
          {DAY_HEADS.map(d => <div key={d} className="dp__cal-dh">{d}</div>)}
        </div>
        <div className="dp__cal-days">
          {days.map(({ date, other }, i) => {
            const isStart = sameDay(date, effectiveStart);
            const isEnd = sameDay(date, effectiveEnd);
            const isSel = isStart || isEnd;
            const isInRange = effectiveStart && effectiveEnd && date > effectiveStart && date < effectiveEnd;
            const isToday = sameDay(date, today);
            const isPending = pending && sameDay(date, pending);

            const cls = [
              'dp__cal-day',
              other && 'dp__cal-day--other',
              isToday && 'dp__cal-day--today',
              isSel && 'dp__cal-day--selected',
              isStart && 'dp__cal-day--start',
              isEnd && 'dp__cal-day--end',
              isInRange && 'dp__cal-day--in-range',
            ].filter(Boolean).join(' ');

            return (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={() => handleDayClick(date)}
                onMouseEnter={() => handleDayHover(date)}
                aria-label={fmtDisplay(date)}
                aria-pressed={isSel}
              >
                {date.getDate()}
                {isToday && <span className="dp__cal-today-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="dp__cal-footer">
        <div className="dp__cal-range-display">
          {effectiveStart && effectiveEnd ? (
            <>
              <strong>{fmtShort(effectiveStart)}</strong>
              {' → '}
              <strong>{fmtShort(effectiveEnd)} {effectiveEnd.getFullYear()}</strong>
              {` · ${diffDays}d`}
            </>
          ) : effectiveStart ? (
            <><strong>{fmtShort(effectiveStart)}</strong>{' → select end'}</>
          ) : (
            'Select start date'
          )}
        </div>
        <div className="dp__cal-presets">
          {quickPresets.map(d => (
            <button
              key={d}
              type="button"
              className={`dp__cal-preset${activePreset === d ? ' is-active' : ''}`}
              onClick={() => onPreset?.(d)}
            >
              {d < 365 ? `${d}d` : 'YTD'}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ─────────────────────────────────────────────────────
   useClickOutside — closes popover when clicking outside
 ───────────────────────────────────────────────────── */
function useClickOutside(ref, onClose) {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

/* ─────────────────────────────────────────────────────
   SUB-COMPONENTS FOR Clean Hook Order
 ───────────────────────────────────────────────────── */

const RangeQuick = ({ label, quickPresets, activePreset, applyPreset, className }) => (
  <div className={`dp dp--range dp--range-quick ${className}`.trim()}>
    {label && <label className="dp__label">{label}</label>}
    <div className="dp__quick">
      {quickPresets.map((days) => (
        <button
          key={days}
          type="button"
          className={`dp__quick-btn${activePreset === days ? ' is-active' : ''}`}
          onClick={() => applyPreset(days)}
        >
          {days < 365 ? `${days}D` : 'YTD'}
        </button>
      ))}
    </div>
  </div>
);

const RangePeriod = ({ label, startDate, endDate, activePreset, quickPresets, applyPreset, handleCalSelect, emitRange, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  return (
    <div ref={ref} className={`dp dp--range dp--range-period ${className}`.trim()}>
      {label && <label className="dp__label">{label}</label>}
      <button
        type="button"
        className={`dp__range-strip${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="dp__range-field">
          <Calendar size={13} className="dp__range-icon" aria-hidden="true" />
          {start ? <span className="dp__range-val">{fmtDisplay(start)}</span> : <span className="dp__range-placeholder">DD · MM · YYYY</span>}
        </span>
        <span className="dp__sep" aria-hidden="true">→</span>
        <span className="dp__range-field">
          <Calendar size={13} className="dp__range-icon" aria-hidden="true" />
          {end ? <span className="dp__range-val">{fmtDisplay(end)}</span> : <span className="dp__range-placeholder">DD · MM · YYYY</span>}
        </span>
        <span
          className="dp__clear"
          role="button"
          tabIndex={0}
          aria-label="Clear date range"
          onClick={(e) => {
            e.stopPropagation();
            emitRange({ startDate: '', endDate: '', days: null });
            setOpen(false);
          }}
        >
          <X size={14} />
        </span>
      </button>
      {open && (
        <div className="dp__cal-popover">
          <CustomCalendar
            rangeStart={start}
            rangeEnd={end}
            activePreset={activePreset}
            quickPresets={quickPresets}
            onPreset={(days) => { applyPreset(days); setOpen(false); }}
            onSelect={(sel) => {
              handleCalSelect(sel);
              if (sel.start && sel.end) setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

const RangeSampling = ({ label, startDate, endDate, activePreset, quickPresets, applyPreset, handleCalSelect, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  return (
    <div ref={ref} className={`dp dp--range dp--range-sampling ${className}`.trim()}>
      {label && <label className="dp__label">{label}</label>}
      <button
        type="button"
        className={`dp__sampling-pill${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="dp__sampling-seg">
          <span className="dp__sampling-seg-label">From</span>
          <span className={`dp__sampling-seg-val${!start ? ' is-placeholder' : ''}`}>
            {start ? fmtDisplay(start) : 'Select date'}
          </span>
        </span>
        <span className="dp__sampling-divider" aria-hidden="true" />
        <span className="dp__sampling-seg">
          <span className="dp__sampling-seg-label">To</span>
          <span className={`dp__sampling-seg-val${!end ? ' is-placeholder' : ''}`}>
            {end ? fmtDisplay(end) : 'Select date'}
          </span>
        </span>
      </button>
      {open && (
        <div className="dp__cal-popover">
          <CustomCalendar
            rangeStart={start}
            rangeEnd={end}
            activePreset={activePreset}
            quickPresets={quickPresets}
            onPreset={(days) => { applyPreset(days); setOpen(false); }}
            onSelect={(sel) => {
              handleCalSelect(sel);
              if (sel.start && sel.end) setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

const BirthStepper = ({ label, value, onChange, today, className }) => {
  const [localParts, setLocalParts] = useState(() => birthValueToParts(value));

  useEffect(() => {
    setLocalParts(birthValueToParts(value));
  }, [value]);

  const step = (key, dir) => {
    setLocalParts(prev => {
      const next = { ...prev, [key]: prev[key] + dir };
      if (next.month > 12) next.month = 1;
      if (next.month < 1) next.month = 12;
      if (next.year > new Date().getFullYear()) next.year = 1900;
      if (next.year < 1900) next.year = new Date().getFullYear();
      const clamped = clampBirthdate(next);
      onChange?.(partsToBirthValue(clamped));
      return clamped;
    });
  };

  const age = (() => {
    let a = today.getFullYear() - localParts.year;
    const mo = today.getMonth() + 1 - localParts.month;
    if (mo < 0 || (mo === 0 && today.getDate() < localParts.day)) a--;
    return a >= 0 ? a : null;
  })();

  const fields = [
    { key: 'day', colLabel: 'Day', text: String(localParts.day).padStart(2, '0') },
    { key: 'month', colLabel: 'Month', text: MONTHS_SHORT[localParts.month - 1] },
    { key: 'year', colLabel: 'Year', text: String(localParts.year) },
  ];

  return (
    <div className={`dp dp--birth dp--birth-stepper ${className}`.trim()}>
      {label && <label className="dp__label">{label}</label>}
      <div className="dp__stepper">
        {fields.map((f) => (
          <div className="dp__spin" key={f.key}>
            <div className="dp__spin-col-label">{f.colLabel}</div>
            <button type="button" className="dp__spin-btn" onClick={() => step(f.key, 1)} aria-label={`Increase ${f.key}`}><ChevronUp size={12} /></button>
            <div className="dp__spin-val">{f.text}</div>
            <button type="button" className="dp__spin-btn" onClick={() => step(f.key, -1)} aria-label={`Decrease ${f.key}`}><ChevronDown size={12} /></button>
          </div>
        ))}
      </div>
      <div className="dp__birth-result">
        <span className="dp__birth-result-val">{String(localParts.day).padStart(2, '0')} {MONTHS_LONG[localParts.month - 1]} {localParts.year}</span>
        {age !== null && <span className="dp__birth-result-age">Age: <strong>{age}</strong></span>}
      </div>
    </div>
  );
};

const BirthScroll = ({ label, value, onChange, today, className }) => {
  const parts = birthValueToParts(value);
  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  const scrollTo = useCallback((ref, selector) => {
    const el = ref.current?.querySelector(selector);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      scrollTo(dayRef, `[data-val="${parts.day}"][data-set="1"]`);
      scrollTo(monthRef, `[data-val="${parts.month}"][data-set="1"]`);
      scrollTo(yearRef, `[data-val="${parts.year}"][data-set="1"]`);
    }, 80);
    return () => clearTimeout(t);
  }, []);

  const handlePick = (key, val) => {
    const next = clampBirthdate({ ...parts, [key]: val });
    onChange?.(partsToBirthValue(next));
    const refMap = { day: dayRef, month: monthRef, year: yearRef };
    setTimeout(() => scrollTo(refMap[key], `[data-val="${val}"][data-set="1"]`), 30);
  };

  const age = (() => {
    let a = today.getFullYear() - parts.year;
    const mo = today.getMonth() + 1 - parts.month;
    if (mo < 0 || (mo === 0 && today.getDate() < parts.day)) a--;
    return a >= 0 ? a : null;
  })();

  const days = Array.from({ length: 31 * 3 }, (_, i) => { const val = ((i % 31) + 1); const set = Math.floor(i / 31); return { val, label: String(val).padStart(2, '0'), set }; });
  const months = Array.from({ length: 12 * 3 }, (_, i) => { const val = ((i % 12) + 1); const set = Math.floor(i / 12); return { val, label: MONTHS_LONG[val - 1], set }; });
  const years = Array.from({ length: 126 * 3 }, (_, i) => { const val = 1900 + (i % 126); const set = Math.floor(i / 126); return { val, label: String(val), set }; });

  return (
    <div className={`dp dp--birth dp--birth-scroll ${className}`.trim()}>
      {label && <label className="dp__label">{label}</label>}
      <div className="dp__scroll-cols">
        <div className="dp__scroll-col" ref={dayRef}>
          <div className="dp__scroll-col-header">Day</div>
          <div className="dp__scroll-col-track">
            {days.map(({ val, label: lbl, set }) => (
              <button key={`${val}-${set}`} type="button" data-val={val} data-set={set} className={`dp__scroll-item${parts.day === val ? ' is-selected' : ''}`} onClick={() => handlePick('day', val)}>{lbl}</button>
            ))}
          </div>
        </div>
        <div className="dp__scroll-col dp__scroll-col--month" ref={monthRef}>
          <div className="dp__scroll-col-header">Month</div>
          <div className="dp__scroll-col-track">
            {months.map(({ val, label: lbl, set }) => (
              <button key={`${val}-${set}`} type="button" data-val={val} data-set={set} className={`dp__scroll-item${parts.month === val ? ' is-selected' : ''}`} onClick={() => handlePick('month', val)}>{lbl}</button>
            ))}
          </div>
        </div>
        <div className="dp__scroll-col dp__scroll-col--year" ref={yearRef}>
          <div className="dp__scroll-col-header">Year</div>
          <div className="dp__scroll-col-track">
            {years.map(({ val, label: lbl, set }) => (
              <button key={`${val}-${set}`} type="button" data-val={val} data-set={set} className={`dp__scroll-item${parts.year === val ? ' is-selected' : ''}`} onClick={() => handlePick('year', val)}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="dp__birth-result">
        <span className="dp__birth-result-val">{String(parts.day).padStart(2, '0')} {MONTHS_LONG[parts.month - 1]} {parts.year}</span>
        {age !== null && <span className="dp__birth-result-age">Age: <strong>{age}</strong></span>}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   MAIN DatePicker COMPONENT
 ───────────────────────────────────────────────────── */
const DatePicker = ({
  mode = 'birthdate',
  variant,
  value,
  onChange,
  maxDate,
  minDate,
  label,
  quickPresets = [7, 30, 90, 365],
  className = '',
}) => {
  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  if (mode === 'range') {
    const startDate = value?.startDate || '';
    const endDate = value?.endDate || '';
    const activePreset = Number(value?.days || 0) || null;
    const rangeVariant = variant || 'period';

    const emitRange = (next) => {
      onChange?.({
        startDate: next.startDate || '',
        endDate: next.endDate || '',
        days: next.days || null,
      });
    };

    const applyPreset = (days) => {
      const end = new Date(today);
      const start = new Date(today);
      start.setDate(today.getDate() - days);
      emitRange({ startDate: toISOStr(start), endDate: toISOStr(end), days });
    };

    const handleCalSelect = ({ start, end }) => {
      emitRange({
        startDate: start ? toISOStr(start) : '',
        endDate: end ? toISOStr(end) : '',
        days: null,
      });
    };

    if (rangeVariant === 'quick') {
      return <RangeQuick label={label} quickPresets={quickPresets} activePreset={activePreset} applyPreset={applyPreset} className={className} />;
    }
    if (rangeVariant === 'period') {
      return <RangePeriod label={label} startDate={startDate} endDate={endDate} activePreset={activePreset} quickPresets={quickPresets} applyPreset={applyPreset} handleCalSelect={handleCalSelect} emitRange={emitRange} className={className} />;
    }
    if (rangeVariant === 'sampling') {
      return <RangeSampling label={label} startDate={startDate} endDate={endDate} activePreset={activePreset} quickPresets={quickPresets} applyPreset={applyPreset} handleCalSelect={handleCalSelect} className={className} />;
    }
  }

  const birthVariant = variant || 'stepper';
  if (birthVariant === 'stepper') {
    return <BirthStepper label={label} value={value} onChange={onChange} today={today} className={className} />;
  }
  if (birthVariant === 'scroll') {
    return <BirthScroll label={label} value={value} onChange={onChange} today={today} className={className} />;
  }

  // Fallback: input
  const maxValue = maxDate || toISOStr(new Date());
  return (
    <div className={`dp dp--birth dp--birth-input ${className}`.trim()}>
      {label && <label className="dp__label">{label}</label>}
      <input
        type="date"
        className="dp__input"
        value={value || ''}
        max={maxValue}
        min={minDate}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={label || 'Birthdate'}
      />
    </div>
  );
};

export default DatePicker;