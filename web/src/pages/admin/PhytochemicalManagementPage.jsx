import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Checkbox from '../../components/common/Checkbox';
import Dropdown from '../../components/common/Dropdown';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import Table from '../../components/common/Table';
import phytochemicalAdminService from '../../services/phytochemicalAdminService';

/* ─────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────── */
const CATEGORY_OPTIONS = [
  { value: 'all',                label: 'All Categories' },
  { value: 'alkaloids',          label: 'Alkaloids' },
  { value: 'flavonoids',         label: 'Flavonoids' },
  { value: 'terpenoids',         label: 'Terpenoids' },
  { value: 'phenolic_compounds', label: 'Phenolic Compounds' },
  { value: 'glycosides',         label: 'Glycosides' },
  { value: 'essential_oils',     label: 'Essential Oils' },
  { value: 'tannins',            label: 'Tannins' },
  { value: 'saponins',           label: 'Saponins' },
  { value: 'other',              label: 'Other' },
];

const SORT_OPTIONS = [
  { value: 'name_asc',            label: 'Name (A–Z)' },
  { value: 'assigned_herbs_desc', label: 'Most Herbs' },
  { value: 'updated_desc',        label: 'Recently Updated' },
];

const PART_OPTIONS = [
  { value: 'leaf',        label: 'Leaf' },
  { value: 'root',        label: 'Root' },
  { value: 'flower',      label: 'Flower' },
  { value: 'bark',        label: 'Bark' },
  { value: 'whole_plant', label: 'Whole Plant' },
];

const UNIT_OPTIONS = ['%', 'mg/g', 'mg/kg', 'ppm', 'ug/g'];

const STATUS_OPTIONS = [
  { value: 'active',     label: 'Active' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'archived',   label: 'Archived' },
];

const CONFIDENCE_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
];

// Left-border accent per category — keyed to CSS design tokens
const CATEGORY_ACCENT = {
  alkaloids:          'var(--color-purple,    #9333ea)',
  flavonoids:         'var(--color-yellow,    #ca8a04)',
  terpenoids:         'var(--border-success)',
  phenolic_compounds: 'var(--color-orange,    #ea580c)',
  glycosides:         'var(--border-brand)',
  essential_oils:     'var(--color-teal,      #0d9488)',
  tannins:            'var(--color-amber,     #d97706)',
  saponins:           'var(--color-cyan,      #0891b2)',
  other:              'var(--border-weak)',
};

const STATUS_PILL = {
  active:     { borderColor: 'var(--border-success)', background: 'var(--surface-success, var(--surface-secondary))', color: 'var(--text-success)'  },
  archived:   { borderColor: 'var(--border-weak)',    background: 'var(--surface-secondary)',                         color: 'var(--text-tertiary)' },
  superseded: { borderColor: 'var(--border-warning)', background: 'var(--surface-warning, var(--surface-secondary))', color: 'var(--text-warning)'  },
};

const CONFIDENCE_PILL = {
  low:    { borderColor: 'var(--border-danger)',  background: 'var(--surface-danger,  var(--surface-secondary))', color: 'var(--icon-danger)'  },
  medium: { borderColor: 'var(--border-warning)', background: 'var(--surface-warning, var(--surface-secondary))', color: 'var(--text-warning)' },
  high:   { borderColor: 'var(--border-success)', background: 'var(--surface-success, var(--surface-secondary))', color: 'var(--text-success)' },
};

const emptyAssignmentForm = {
  assignmentId: null, phytochemicalId: '', herbId: '',
  herbParts: ['leaf'], herbPart: 'leaf',
  concentrationValue: '', concentrationUnit: '',
  sourceReference: '', extractionType: '',
  confidenceLevel: 'medium', notes: '', status: 'active', revisionNote: '',
};

const emptyPhytochemicalForm = { name: '', category: 'other', description: '', effectsTags: [] };

const formatDate = (v) => v ? new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

/* ─────────────────────────────────────────────────────────────────
   MiniPill — mono-uppercase badge using design-system card token colours
───────────────────────────────────────────────────────────────── */
const pillBase = {
  display: 'inline-flex', alignItems: 'center',
  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
  textTransform: 'uppercase', fontWeight: 500,
  padding: '2px 7px 2px 6px',
  borderRadius: 6,
  border: '1px solid',
  borderLeft: '3px solid',
};

const MiniPill = ({ label, colors }) => (
  <span style={{
    ...pillBase,
    borderColor:      colors?.borderColor || 'var(--border-primary)',
    borderLeftColor:  colors?.borderColor || 'var(--border-weak)',
    background:       colors?.background  || 'var(--surface-secondary)',
    color:            colors?.color       || 'var(--text-secondary)',
  }}>
    {label}
  </span>
);

const StatusPill   = ({ status })   => <MiniPill label={status}   colors={STATUS_PILL[status]}     />;
const ConfPill     = ({ level })    => <MiniPill label={level}    colors={CONFIDENCE_PILL[level]}  />;
const CategoryPill = ({ category }) => {
  const label = CATEGORY_OPTIONS.find((o) => o.value === category)?.label || category;
  return <MiniPill label={label} colors={{ borderColor: CATEGORY_ACCENT[category] || 'var(--border-weak)', background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }} />;
};

/* ─────────────────────────────────────────────────────────────────
   FieldLabel — matches .label (mono + brand dash ::before via inline)
───────────────────────────────────────────────────────────────── */
const FieldLabel = ({ children, error }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5,
    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: error ? 'var(--icon-danger)' : 'var(--text-secondary)',
  }}>
    <span style={{ width: 10, height: 1.5, background: error ? 'var(--border-danger)' : 'var(--border-brand)', flexShrink: 0, display: 'inline-block' }} />
    {children}
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   TagInput — uses .tag-box / .tag / .tag-remove / .tag-input
───────────────────────────────────────────────────────────────── */
const TagInput = ({ tags, onChange, placeholder }) => {
  const [input, setInput] = useState('');
  const ref = useRef(null);

  const add = (raw) => {
    const v = raw.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
    else if (e.key === 'Backspace' && input === '' && tags.length) onChange(tags.slice(0, -1));
  };

  return (
    <div className="tag-box" onClick={() => ref.current?.focus()}>
      {tags.map((t, i) => (
        <span key={i} className="tag">
          {t}
          <button
            type="button"
            className="tag-remove"
            onClick={(e) => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i)); }}
          >×</button>
        </span>
      ))}
      <input
        ref={ref}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="tag-input"
      />
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   HerbCombobox — .input + .autocomplete-menu / .autocomplete-item
   Selected state uses .card with brand left-border
───────────────────────────────────────────────────────────────── */
const HerbCombobox = ({ query, onQueryChange, options, selectedId, onSelect, hasError, disabled }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const selectedHerb = options.find((h) => h._id === selectedId);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selectedHerb && !open) {
    return (
      <div className="card" style={{ borderLeftColor: 'var(--border-brand)', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>{selectedHerb.name}</div>
          {selectedHerb.scientificName && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontStyle: 'italic', color: 'var(--text-tertiary)' }}>{selectedHerb.scientificName}</div>
          )}
        </div>
        {!disabled && (
          <button type="button" className="btn-icon" style={{ width: 24, height: 24, flexShrink: 0 }} onClick={() => { onSelect(''); onQueryChange(''); }} aria-label="Clear herb">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => { onQueryChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search herb by name…"
        disabled={disabled}
        className={`input${hasError ? ' input--error' : ''}`}
        style={{ height: 36 }}
      />
      {open && options.length > 0 && (
        <div className="autocomplete-menu">
          {options.map((herb) => (
            <div
              key={herb._id}
              className="autocomplete-item"
              onMouseDown={(e) => { e.preventDefault(); onSelect(herb._id); onQueryChange(herb.name); setOpen(false); }}
            >
              <div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{herb.name}</div>
                {herb.scientificName && <div style={{ fontStyle: 'italic', color: 'var(--text-tertiary)', fontSize: 11 }}>{herb.scientificName}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && query.length > 0 && options.length === 0 && (
        <div className="autocomplete-menu" style={{ padding: '9px 12px' }}>
          <span className="helper">No herbs found.</span>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   CollapsibleSection — .card with mono toggle header
───────────────────────────────────────────────────────────────── */
const CollapsibleSection = ({ label, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--text-secondary)',
        }}
      >
        {label}
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--text-tertiary)', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--border-weakest)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Field — label + input slot + optional error / helper text
───────────────────────────────────────────────────────────────── */
const Field = ({ label, error, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <FieldLabel error={!!error}>{label}{error ? ` — ${error}` : ''}</FieldLabel>
    {children}
    {hint && !error && <span className="helper">{hint}</span>}
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   EmptyState
───────────────────────────────────────────────────────────────── */
const EmptyState = ({ icon, title, sub }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 24px', textAlign: 'center' }}>
    <div style={{ color: 'var(--text-tertiary)', opacity: 0.3 }}>{icon}</div>
    <div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
      {sub && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{sub}</div>}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   PhytochemicalManagementPage
═══════════════════════════════════════════════════════════════════ */
const PhytochemicalManagementPage = () => {
  const [listFilters, setListFilters] = useState({ category: 'all', search: '', sort: 'name_asc', status: 'all', page: 1, limit: 30 });
  const [listState,   setListState]   = useState({ items: [], pagination: {}, loading: false });
  const [selectedId,  setSelectedId]  = useState('');
  const [detailState, setDetailState] = useState({
    phytochemical: null, assignments: [], pagination: {}, loading: false,
    filters: { herbSearch: '', herbPart: 'all', unit: 'all', assignmentStatus: 'all', page: 1, limit: 50 },
  });
  const [sidePanel,   setSidePanel]   = useState({ open: false, mode: null });
  const [assignmentForm,      setAssignmentForm]      = useState(emptyAssignmentForm);
  const [phytochemicalForm,   setPhytochemicalForm]   = useState(emptyPhytochemicalForm);
  const [herbQuery,   setHerbQuery]   = useState('');
  const [herbOptions, setHerbOptions] = useState([]);
  const [saveAndAddAnother, setSaveAndAddAnother] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [assignmentFormErrors,    setAssignmentFormErrors]    = useState({});
  const [phytochemicalFormErrors, setPhytochemicalFormErrors] = useState({});

  const selectedPhytochemical = detailState.phytochemical;
  const selectedIsArchived    = selectedPhytochemical?.status === 'archived';
  const hasAssignments        = detailState.assignments.length > 0;

  const selectedHerbAssignedParts = useMemo(() => {
    if (!assignmentForm.herbId) return [];
    return Array.from(new Set(
      detailState.assignments.filter((a) => a.herbId === assignmentForm.herbId).map((a) => a.herbPart).filter(Boolean)
    ));
  }, [detailState.assignments, assignmentForm.herbId]);

  const selectedHerbAssignedPartSet = useMemo(() => new Set(selectedHerbAssignedParts), [selectedHerbAssignedParts]);

  const selectedNewPartCount = useMemo(
    () => (assignmentForm.herbParts || []).filter((p) => !selectedHerbAssignedPartSet.has(p)).length,
    [assignmentForm.herbParts, selectedHerbAssignedPartSet]
  );

  /* ── data loaders ── */
  const loadList = async () => {
    setListState((p) => ({ ...p, loading: true }));
    try {
      const r = await phytochemicalAdminService.list(listFilters);
      setListState({ items: r.items || [], pagination: r.pagination || {}, loading: false });
      if (!selectedId && r.items?.length) setSelectedId(r.items[0]._id);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setListState((p) => ({ ...p, loading: false }));
    }
  };

  const loadDetail = async (id, customFilters = null) => {
    if (!id) return;
    const f = customFilters || detailState.filters;
    setDetailState((p) => ({ ...p, loading: true }));
    try {
      const r = await phytochemicalAdminService.detail(id, f);
      setDetailState((p) => ({ ...p, loading: false, phytochemical: r.phytochemical, assignments: r.assignments || [], pagination: r.pagination || {}, filters: f }));
    } catch (e) {
      setError(e.message || 'Failed to load detail');
      setDetailState((p) => ({ ...p, loading: false }));
    }
  };

  const loadHerbOptions = async (q) => {
    try   { setHerbOptions(await phytochemicalAdminService.searchHerbs(q, 20)); }
    catch { setHerbOptions([]); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadList(); }, [listFilters.category, listFilters.sort, listFilters.status, listFilters.page]);
  useEffect(() => { const t = setTimeout(loadList, 250); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [listFilters.search]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);
  useEffect(() => { const t = setTimeout(() => loadHerbOptions(herbQuery), 250); return () => clearTimeout(t); }, [herbQuery]);

  /* ── panel helpers ── */
  const closePanel = () => setSidePanel({ open: false, mode: null });

  const openNewPhytochemical = () => {
    setError(''); setPhytochemicalFormErrors({});
    setPhytochemicalForm(emptyPhytochemicalForm);
    setSidePanel({ open: true, mode: 'new_phytochemical' });
  };

  const openEditPhytochemical = () => {
    if (!selectedPhytochemical) return;
    setError(''); setPhytochemicalFormErrors({});
    setPhytochemicalForm({ name: selectedPhytochemical.name || '', category: selectedPhytochemical.category || 'other', description: selectedPhytochemical.description || '', effectsTags: selectedPhytochemical.effects || [] });
    setSidePanel({ open: true, mode: 'edit_phytochemical' });
  };

  const openAddAssignment = () => {
    if (!selectedPhytochemical) return;
    setError(''); setAssignmentFormErrors({});
    setAssignmentForm({ ...emptyAssignmentForm, phytochemicalId: selectedPhytochemical._id });
    setHerbQuery(''); setHerbOptions([]);
    setSidePanel({ open: true, mode: 'new_assignment' });
  };

  const openEditAssignment = (a) => {
    setError(''); setAssignmentFormErrors({});
    setAssignmentForm({ assignmentId: a._id, phytochemicalId: a.phytochemicalId, herbId: a.herbId, herbParts: [a.herbPart], herbPart: a.herbPart, concentrationValue: a.concentrationValue, concentrationUnit: a.concentrationUnit, sourceReference: a.sourceReference || '', extractionType: a.extractionType || '', confidenceLevel: a.confidenceLevel || 'medium', notes: a.notes || '', status: a.status || 'active', revisionNote: '' });
    setHerbQuery(a.herb?.name || '');
    setHerbOptions((p) => p.some((h) => h._id === a.herbId) ? p : [{ _id: a.herbId, name: a.herb?.name, scientificName: a.herb?.scientificName }, ...p]);
    setSidePanel({ open: true, mode: 'edit_assignment' });
  };

  /* ── save handlers ── */
  const savePhytochemical = async () => {
    setSaving(true); setError(''); setPhytochemicalFormErrors({});
    try {
      const payload = { name: phytochemicalForm.name.trim(), category: phytochemicalForm.category, description: phytochemicalForm.description.trim(), effects: phytochemicalForm.effectsTags };
      if (!payload.name) { setPhytochemicalFormErrors({ name: 'Required' }); return; }
      if (sidePanel.mode === 'new_phytochemical') { const c = await phytochemicalAdminService.create(payload); setSelectedId(c._id); }
      else if (selectedPhytochemical) await phytochemicalAdminService.update(selectedPhytochemical._id, payload);
      closePanel();
      await loadList();
      if (selectedId || selectedPhytochemical?._id) await loadDetail(selectedId || selectedPhytochemical._id);
    } catch (e) { setError(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const saveAssignment = async () => {
    setSaving(true); setError(''); setAssignmentFormErrors({});
    try {
      const errs = {};
      if (!assignmentForm.herbId) errs.herbId = 'Select a herb';
      if (assignmentForm.concentrationValue === '' || isNaN(Number(assignmentForm.concentrationValue))) errs.concentrationValue = 'Enter a valid number';
      if (!assignmentForm.concentrationUnit) errs.concentrationUnit = 'Select a unit';
      if (sidePanel.mode === 'edit_assignment' && !assignmentForm.herbPart) errs.herbPart = 'Select a part';
      if (sidePanel.mode === 'new_assignment') {
        const parts = (assignmentForm.herbParts || []).filter(Boolean);
        if (!parts.length) errs.herbParts = 'Select at least one part';
        else if (!parts.filter((p) => !selectedHerbAssignedPartSet.has(p)).length) errs.herbParts = 'All selected parts already assigned';
      }
      if (Object.keys(errs).length) { setAssignmentFormErrors(errs); return; }

      const { herbParts, ...base } = assignmentForm;
      if (sidePanel.mode === 'edit_assignment') {
        await phytochemicalAdminService.saveAssignment({ ...base, concentrationValue: Number(base.concentrationValue) });
      } else {
        for (const part of (assignmentForm.herbParts || []).filter((p) => !selectedHerbAssignedPartSet.has(p))) {
          await phytochemicalAdminService.saveAssignment({ ...base, herbPart: part, concentrationValue: Number(base.concentrationValue) });
        }
      }

      if (sidePanel.mode === 'new_assignment' && saveAndAddAnother) {
        setAssignmentFormErrors({});
        setAssignmentForm((p) => ({ ...p, assignmentId: null, herbId: '', herbParts: ['leaf'], herbPart: 'leaf', concentrationValue: '', concentrationUnit: '', sourceReference: '', extractionType: '', confidenceLevel: 'medium', notes: '', status: 'active', revisionNote: '' }));
        setHerbQuery(''); setHerbOptions([]);
      } else { closePanel(); }
      await loadDetail(selectedId);
      await loadList();
    } catch (e) { setError(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const archiveSelected = async () => {
    if (!selectedPhytochemical || selectedIsArchived) return;
    setSaving(true); setError('');
    try {
      await phytochemicalAdminService.archive(selectedPhytochemical._id);
      await loadList(); await loadDetail(selectedPhytochemical._id);
    } catch (e) { setError(e.message || 'Failed to archive'); }
    finally { setSaving(false); }
  };

  const updateAssignmentFilters = (patch) => {
    const next = { ...detailState.filters, ...patch, page: 1 };
    setDetailState((p) => ({ ...p, filters: next }));
    loadDetail(selectedId, next);
  };

  const toggleHerbPart = (val) => {
    setAssignmentForm((p) => {
      const s = new Set(p.herbParts || []);
      s.has(val) ? s.delete(val) : s.add(val);
      return { ...p, herbParts: Array.from(s) };
    });
  };

  /* ── derived options ── */
  const categoryFormOptions = useMemo(() => CATEGORY_OPTIONS.filter((o) => o.value !== 'all'), []);
  const partFilterOptions   = useMemo(() => [{ value: 'all', label: 'All Parts' }, ...PART_OPTIONS], []);
  const unitFilterOptions   = useMemo(() => [{ value: 'all', label: 'All Units' }, ...UNIT_OPTIONS.map((u) => ({ value: u, label: u }))], []);
  const unitSelectOptions   = useMemo(() => [{ value: '', label: 'Select unit…' }, ...UNIT_OPTIONS.map((u) => ({ value: u, label: u }))], []);

  /* ── pagination derived ── */
  const lp = listState.pagination   || {};
  const ap = detailState.pagination || {};
  const listCurrentPage   = Number(lp.page      || listFilters.page          || 1);
  const listTotalPages    = Number(lp.totalPages || 1);
  const listTotal         = Number(lp.total      || listState.items.length   || 0);
  const listLimit         = Number(lp.limit      || listFilters.limit        || 30);
  const aCurrent          = Number(ap.page       || detailState.filters.page || 1);
  const aTotalPages       = Number(ap.totalPages || 1);
  const aTotal            = Number(ap.total      || detailState.assignments.length || 0);
  const aLimit            = Number(ap.limit      || detailState.filters.limit      || 50);

  /* ── table data ── */
  const assignmentHeaders = useMemo(() => ['Herb', 'Part', 'Concentration', 'Source', 'Confidence', 'Status'], []);
  const assignmentRows    = useMemo(() => detailState.assignments.map((a) => [
    <div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{a.herb?.name || a.herbId}</div>
      {a.herb?.scientificName && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontStyle: 'italic', color: 'var(--text-tertiary)' }}>{a.herb.scientificName}</div>}
    </div>,
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{a.herbPart}</span>,
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{a.concentrationValue} {a.concentrationUnit}</span>,
    <span style={{ fontFamily: 'var(--font-ui)',   fontSize: 12, color: 'var(--text-tertiary)' }}>{a.sourceReference || '—'}</span>,
    a.confidenceLevel ? <ConfPill level={a.confidenceLevel} /> : '—',
    <StatusPill status={a.status} />,
  ]), [detailState.assignments]);

  const panelTitle = { new_assignment: 'Add Assignment', edit_assignment: 'Edit Assignment', new_phytochemical: 'New Phytochemical', edit_phytochemical: 'Edit Phytochemical' }[sidePanel.mode] || '';

  /* ════════════════════════════════════════════════════════════════
     Render
  ════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ height: 'calc(100vh - 4rem)', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--base-secondary)' }}>

      {/* ── Toolbar — mirrors .hp-filterbar aesthetic ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--surface-primary)',
        borderBottom: '1.5px solid var(--border-primary)',
        boxShadow: '0 1px 0 0 var(--border-brand), 0 4px 16px -4px rgba(0,0,0,0.10)',
        padding: '10px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 170, flexShrink: 0 }}>
            <Dropdown value={listFilters.category} onChange={(v) => setListFilters((p) => ({ ...p, category: v, page: 1 }))} options={CATEGORY_OPTIONS} size="sm" />
          </div>
          <div style={{ flex: 1 }}>
            <SearchBar value={listFilters.search} onChange={(v) => setListFilters((p) => ({ ...p, search: v, page: 1 }))} onSubmit={(v) => setListFilters((p) => ({ ...p, search: v, page: 1 }))} placeholder="Search phytochemicals…" />
          </div>
          <div style={{ width: 175, flexShrink: 0 }}>
            <Dropdown value={listFilters.sort} onChange={(v) => setListFilters((p) => ({ ...p, sort: v, page: 1 }))} options={SORT_OPTIONS} size="sm" />
          </div>
        </div>
      </div>

      {/* ── Three-pane body ── */}
      <div style={{
        flex: 1, display: 'grid', minHeight: 0,
        gridTemplateColumns: sidePanel.open ? '270px minmax(0,1fr) 370px' : '270px minmax(0,1fr)',
      }}>

        {/* ══ Left: List ══ */}
        <section style={{ borderRight: '1.5px solid var(--border-primary)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--surface-primary)' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {listState.loading && listState.items.length === 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <div className="spinner" />
              </div>
            )}

            {!listState.loading && listState.items.length === 0 && (
              <EmptyState
                icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M9 3h6"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M3 9v6"/><path d="M21 9v6"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/><path d="M9 21h6"/></svg>}
                title="No phytochemicals found"
                sub="Adjust filters or create one below."
              />
            )}

            {listState.items.map((item) => {
              const active   = selectedId === item._id;
              const archived = item.status === 'archived';
              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setSelectedId(item._id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px',
                    borderBottom: '1px solid var(--border-weakest)',
                    borderLeft: `3px solid ${active ? (CATEGORY_ACCENT[item.category] || 'var(--border-brand)') : 'transparent'}`,
                    background: active ? 'var(--surface-secondary)' : 'transparent',
                    opacity: archived ? 0.5 : 1,
                    transition: 'background 150ms, border-left-color 150ms',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface-secondary)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginBottom: 5 }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: active ? 600 : 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {item.name}
                    </span>
                    {archived && <StatusPill status="archived" />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <CategoryPill category={item.category} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                      {item.assignedHerbCount || 0} herb{item.assignedHerbCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* List footer */}
          <div style={{ borderTop: '1.5px solid var(--border-primary)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button onClick={openNewPhytochemical} size="sm" className="w-full">+ New Phytochemical</Button>
            {listTotalPages > 1 && (
              <Pagination currentPage={listCurrentPage} totalPages={listTotalPages} onPageChange={(p) => setListFilters((f) => ({ ...f, page: p }))} total={listTotal} limit={listLimit} />
            )}
          </div>
        </section>

        {/* ══ Centre: Detail ══ */}
        <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--base-secondary)' }}>
          {!selectedPhytochemical ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState
                icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>}
                title="Select a phytochemical"
                sub="Choose one from the list to view details and herb assignments."
              />
            </div>
          ) : (
            <>
              {/* Detail header — .card with category left-border */}
              <div
                className="card"
                style={{ margin: 12, borderLeftColor: CATEGORY_ACCENT[selectedPhytochemical.category] || 'var(--border-brand)', borderRadius: 6 }}
              >
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Name */}
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.2, marginBottom: 7 }}>
                        {selectedPhytochemical.name}
                      </div>
                      {/* Badges row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
                        <CategoryPill category={selectedPhytochemical.category} />
                        <StatusPill   status={selectedPhytochemical.status} />
                        {selectedPhytochemical.effects?.slice(0, 4).map((ef) => (
                          <span key={ef} className="tag" style={{ fontSize: 10, padding: '2px 7px 2px 6px' }}>{ef}</span>
                        ))}
                        {(selectedPhytochemical.effects?.length || 0) > 4 && (
                          <span className="helper">+{selectedPhytochemical.effects.length - 4} more</span>
                        )}
                      </div>
                      {/* Description */}
                      {selectedPhytochemical.description && (
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {selectedPhytochemical.description}
                        </p>
                      )}
                      {/* Timestamps */}
                      <div style={{ display: 'flex', gap: 14 }}>
                        <span className="helper">Created {formatDate(selectedPhytochemical.createdAt)}</span>
                        <span className="helper">Updated {formatDate(selectedPhytochemical.updatedAt)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button onClick={openEditPhytochemical} size="sm" variant="outline">Edit</Button>
                      {selectedPhytochemical.status === 'active' && (
                        <Button onClick={archiveSelected} size="sm" variant="outline" disabled={saving}>Archive</Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignment toolbar — top of table card */}
              <div style={{ margin: '0 12px', background: 'var(--surface-primary)', border: '1.5px solid var(--border-primary)', borderBottom: 'none', borderRadius: '6px 6px 0 0', padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasAssignments ? 8 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FieldLabel>Herb Assignments</FieldLabel>
                    {aTotal > 0 && <span className="helper">({aTotal})</span>}
                  </div>
                  <Button onClick={openAddAssignment} size="sm" disabled={selectedIsArchived}>+ Assign Herb</Button>
                </div>
                {hasAssignments && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', gap: 8 }}>
                    <SearchBar value={detailState.filters.herbSearch} onChange={(v) => updateAssignmentFilters({ herbSearch: v })} onSubmit={(v) => updateAssignmentFilters({ herbSearch: v })} placeholder="Filter herb…" />
                    <Dropdown  value={detailState.filters.herbPart} onChange={(v) => updateAssignmentFilters({ herbPart: v })} options={partFilterOptions} size="sm" />
                    <Dropdown  value={detailState.filters.unit}     onChange={(v) => updateAssignmentFilters({ unit: v })}     options={unitFilterOptions}  size="sm" />
                  </div>
                )}
              </div>

              {/* Table area */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 12px', border: '1.5px solid var(--border-primary)', borderTop: 'none', borderRadius: '0 0 6px 6px', background: 'var(--surface-primary)' }}>
                {!hasAssignments && !detailState.loading ? (
                  <EmptyState
                    icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>}
                    title="No herb assignments yet"
                    sub={selectedIsArchived ? 'This phytochemical is archived.' : 'Click "+ Assign Herb" to link this compound to a herb.'}
                  />
                ) : (
                  <Table headers={assignmentHeaders} data={assignmentRows} onRowClick={(_, i) => openEditAssignment(detailState.assignments[i])} loading={detailState.loading} />
                )}
              </div>

              {aTotalPages > 1 && (
                <div style={{ margin: '0 12px 12px', padding: '8px 12px', background: 'var(--surface-primary)', border: '1.5px solid var(--border-primary)', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                  <Pagination currentPage={aCurrent} totalPages={aTotalPages} onPageChange={(p) => updateAssignmentFilters({ page: p })} total={aTotal} limit={aLimit} />
                </div>
              )}
            </>
          )}
        </section>

        {/* ══ Right: Side Panel ══ */}
        {sidePanel.open && (
          <aside style={{ borderLeft: '1.5px solid var(--border-primary)', background: 'var(--surface-primary)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* Panel header — brand background matching table thead */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-brand-primary)', borderBottom: '1.5px solid var(--border-primary)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500, color: 'var(--text-on-dark)' }}>
                {panelTitle}
              </span>
              <button type="button" className="btn-icon" style={{ width: 26, height: 26, background: 'transparent', border: 'none', color: 'var(--text-on-dark)' }} onClick={closePanel} aria-label="Close panel">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Error banner */}
              {error && (
                <div className="card" style={{ borderLeftColor: 'var(--border-danger)', padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 1, flexShrink: 0, color: 'var(--icon-danger)' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span className="error" style={{ marginTop: 0 }}>{error}</span>
                </div>
              )}

              {/* ── Assignment form ── */}
              {(sidePanel.mode === 'new_assignment' || sidePanel.mode === 'edit_assignment') && (
                <>
                  {/* Required fields card */}
                  <div className="card" style={{ borderLeftColor: 'var(--border-brand)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <FieldLabel>Required</FieldLabel>

                    <Field label="Herb" error={assignmentFormErrors.herbId}>
                      <HerbCombobox
                        query={herbQuery} onQueryChange={setHerbQuery}
                        options={herbOptions} selectedId={assignmentForm.herbId}
                        onSelect={(id) => { setAssignmentForm((p) => ({ ...p, herbId: id, herbParts: [] })); setAssignmentFormErrors((p) => ({ ...p, herbId: '', herbParts: '' })); }}
                        hasError={!!assignmentFormErrors.herbId}
                        disabled={sidePanel.mode === 'edit_assignment'}
                      />
                      {sidePanel.mode === 'new_assignment' && selectedHerbAssignedParts.length > 0 && (
                        <span className="helper">Already assigned: {selectedHerbAssignedParts.join(', ')}</span>
                      )}
                    </Field>

                    <Field label="Plant Part" error={assignmentFormErrors.herbParts || assignmentFormErrors.herbPart}>
                      {sidePanel.mode === 'new_assignment' ? (
                        <div className="card" style={{ borderLeftColor: assignmentFormErrors.herbParts ? 'var(--border-danger)' : 'var(--border-weak)', padding: '8px 10px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                            {PART_OPTIONS.map((item) => {
                              const already  = selectedHerbAssignedPartSet.has(item.value);
                              const checked  = (assignmentForm.herbParts || []).includes(item.value);
                              return (
                                <label key={item.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: already ? 'not-allowed' : 'pointer', opacity: already ? 0.4 : 1 }}>
                                  <Checkbox id={`part-${item.value}`} checked={checked} disabled={already} onChange={() => { toggleHerbPart(item.value); setAssignmentFormErrors((p) => ({ ...p, herbParts: '' })); }} size="sm" />
                                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: checked ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: checked ? 500 : 400 }}>
                                    {item.label}
                                  </span>
                                  {already && <span className="helper">(done)</span>}
                                </label>
                              );
                            })}
                          </div>
                          <div style={{ borderTop: '1px solid var(--border-weakest)', marginTop: 8, paddingTop: 6 }}>
                            <span className="helper">One assignment created per selected part.</span>
                          </div>
                        </div>
                      ) : (
                        <Dropdown value={assignmentForm.herbPart} onChange={(v) => { setAssignmentForm((p) => ({ ...p, herbPart: v })); setAssignmentFormErrors((p) => ({ ...p, herbPart: '' })); }} options={PART_OPTIONS} size="sm" />
                      )}
                    </Field>

                    <Field label="Concentration" error={assignmentFormErrors.concentrationValue || assignmentFormErrors.concentrationUnit}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input
                          type="number" step="any" value={assignmentForm.concentrationValue}
                          onChange={(e) => { setAssignmentForm((p) => ({ ...p, concentrationValue: e.target.value })); setAssignmentFormErrors((p) => ({ ...p, concentrationValue: '' })); }}
                          className={`input${assignmentFormErrors.concentrationValue ? ' input--error' : ''}`}
                          style={{ height: 36 }} placeholder="Value"
                        />
                        <Dropdown value={assignmentForm.concentrationUnit} onChange={(v) => { setAssignmentForm((p) => ({ ...p, concentrationUnit: v })); setAssignmentFormErrors((p) => ({ ...p, concentrationUnit: '' })); }} options={unitSelectOptions} size="sm" />
                      </div>
                    </Field>
                  </div>

                  {/* Optional fields — collapsible card */}
                  <CollapsibleSection label="Optional Details" defaultOpen={sidePanel.mode === 'edit_assignment'}>
                    <Field label="Extraction Type">
                      <input value={assignmentForm.extractionType} onChange={(e) => setAssignmentForm((p) => ({ ...p, extractionType: e.target.value }))} placeholder="e.g. ethanol extraction" className="input" style={{ height: 36 }} />
                    </Field>
                    <Field label="Source Reference">
                      <input value={assignmentForm.sourceReference} onChange={(e) => setAssignmentForm((p) => ({ ...p, sourceReference: e.target.value }))} placeholder="DOI, title, URL…" className="input" style={{ height: 36 }} />
                    </Field>
                    <Field label="Confidence Level">
                      <Dropdown value={assignmentForm.confidenceLevel} onChange={(v) => setAssignmentForm((p) => ({ ...p, confidenceLevel: v }))} options={CONFIDENCE_OPTIONS} size="sm" />
                    </Field>
                    <Field label="Notes">
                      <textarea value={assignmentForm.notes} onChange={(e) => setAssignmentForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any additional context…" className="input" style={{ minHeight: 60, resize: 'none' }} />
                    </Field>
                  </CollapsibleSection>

                  {/* Status + Revision card */}
                  <div className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label="Status">
                      <Dropdown value={assignmentForm.status} onChange={(v) => setAssignmentForm((p) => ({ ...p, status: v }))} options={STATUS_OPTIONS} size="sm" />
                    </Field>
                    {sidePanel.mode === 'edit_assignment' && (
                      <Field label="Revision Note" hint="Optional — reason for this change">
                        <textarea value={assignmentForm.revisionNote} onChange={(e) => setAssignmentForm((p) => ({ ...p, revisionNote: e.target.value }))} rows={2} placeholder="Why was this updated?" className="input" style={{ minHeight: 54, resize: 'none' }} />
                      </Field>
                    )}
                  </div>
                </>
              )}

              {/* ── Phytochemical form ── */}
              {(sidePanel.mode === 'new_phytochemical' || sidePanel.mode === 'edit_phytochemical') && (
                <div className="card" style={{ borderLeftColor: 'var(--border-brand)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field label="Name" error={phytochemicalFormErrors.name}>
                    <input
                      value={phytochemicalForm.name}
                      onChange={(e) => { setPhytochemicalForm((p) => ({ ...p, name: e.target.value })); setPhytochemicalFormErrors((p) => ({ ...p, name: '' })); }}
                      className={`input${phytochemicalFormErrors.name ? ' input--error' : ''}`}
                      style={{ height: 36 }} placeholder="e.g. Quercetin"
                    />
                  </Field>
                  <Field label="Category">
                    <Dropdown value={phytochemicalForm.category} onChange={(v) => setPhytochemicalForm((p) => ({ ...p, category: v }))} options={categoryFormOptions} size="sm" />
                  </Field>
                  <Field label="Description">
                    <textarea rows={3} value={phytochemicalForm.description} onChange={(e) => setPhytochemicalForm((p) => ({ ...p, description: e.target.value }))} placeholder="Brief description…" className="input" style={{ minHeight: 72, resize: 'none' }} />
                  </Field>
                  <Field label="Effects" hint="Press Enter or comma to add a tag">
                    <TagInput tags={phytochemicalForm.effectsTags} onChange={(tags) => setPhytochemicalForm((p) => ({ ...p, effectsTags: tags }))} placeholder="Add an effect…" />
                  </Field>
                </div>
              )}
            </div>

            {/* Panel footer — pinned */}
            <div style={{ borderTop: '1.5px solid var(--border-primary)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-primary)' }}>
              {sidePanel.mode === 'new_assignment' && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', flex: 1 }}>
                  <Checkbox id="save-add-another" checked={saveAndAddAnother} onChange={(v) => setSaveAndAddAnother(Boolean(v))} size="sm" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Add another after saving</span>
                </label>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <Button size="sm" variant="outline" onClick={closePanel}>Cancel</Button>
                {(sidePanel.mode === 'new_assignment' || sidePanel.mode === 'edit_assignment') && (
                  <Button size="sm" onClick={saveAssignment} disabled={saving}>
                    {saving ? 'Saving…' : sidePanel.mode === 'new_assignment' ? `Save ${selectedNewPartCount || 1} Assignment${(selectedNewPartCount || 1) > 1 ? 's' : ''}` : 'Save Changes'}
                  </Button>
                )}
                {(sidePanel.mode === 'new_phytochemical' || sidePanel.mode === 'edit_phytochemical') && (
                  <Button size="sm" onClick={savePhytochemical} disabled={saving}>
                    {saving ? 'Saving…' : sidePanel.mode === 'new_phytochemical' ? 'Create' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default PhytochemicalManagementPage;