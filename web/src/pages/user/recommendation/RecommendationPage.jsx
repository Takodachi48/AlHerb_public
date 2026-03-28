import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Checkbox from '../../../components/common/Checkbox';
import Dropdown from '../../../components/common/Dropdown';
import Input from '../../../components/common/Input';
import { herbService } from '../../../services/herbService';
import { useAuth } from '../../../hooks/useAuth';
import userProfileService from '../../../services/userProfileService';

const splitCsv = (value = '') => value.split(',').map((item) => item.trim()).filter(Boolean);

const getAgeFromDateOfBirth = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const getHerbRouteParam = (herb) => herb?.slug || herb?._id || herb?.id || null;
const fieldClassName = 'w-full px-3 py-2 rounded-lg bg-surface-primary text-primary';

const genderOptions = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const severityOptions = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];

const rankingSourceOptions = [
  { value: 'all', label: 'All' },
  { value: 'recommendation-engine', label: 'Recommendation Engine' },
  { value: 'heuristic', label: 'Heuristic' },
  { value: 'none', label: 'None' },
];

const blockedOptions = [
  { value: 'all', label: 'All' },
  { value: 'blocked', label: 'Blocked Only' },
  { value: 'non_blocked', label: 'Non-Blocked Only' },
];

const RecommendationHistoryDetailModal = ({ item, onClose }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-base-primary/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <Card className="relative w-full max-w-3xl border border-border-primary max-h-[85vh] overflow-y-auto" shadow="xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">Recommendation Detail</h2>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="text-secondary"><span className="font-semibold text-primary">Date:</span> {formatDateTime(item.createdAt)}</div>
          <div className="text-secondary"><span className="font-semibold text-primary">Status:</span> {item.status || '-'}</div>
          <div className="text-secondary"><span className="font-semibold text-primary">Source:</span> {item.rankingSource || '-'}</div>
          <div className="text-secondary"><span className="font-semibold text-primary">Feedback:</span> {item.feedbackRating == null ? '-' : item.feedbackRating}</div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold text-primary mb-1">Symptoms</div>
          <div className="text-sm text-secondary">{(item.symptoms || []).join(', ') || '-'}</div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold text-primary mb-2">Recommended Herbs</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary text-left text-tertiary">
                  <th className="py-2 pr-3">Herb</th>
                  <th className="py-2 pr-3">Scientific Name</th>
                  <th className="py-2 pr-3">Confidence</th>
                  <th className="py-2">Open</th>
                </tr>
              </thead>
              <tbody>
                {(item.topHerbs || []).map((herb) => (
                  <tr key={herb.id || `${herb.name}-${herb.slug}`} className="border-b border-border-primary/50">
                    <td className="py-2 pr-3 text-secondary">{herb.name || '-'}</td>
                    <td className="py-2 pr-3 text-secondary">{herb.scientificName || '-'}</td>
                    <td className="py-2 pr-3 text-secondary">{herb.confidence == null ? '-' : Number(herb.confidence).toFixed(3)}</td>
                    <td className="py-2">
                      {getHerbRouteParam(herb) ? <Link to={`/herbs/${getHerbRouteParam(herb)}`} className="text-brand hover:underline">Open</Link> : '-'}
                    </td>
                  </tr>
                ))}
                {(item.topHerbs || []).length === 0 && (
                  <tr>
                    <td className="py-2 text-secondary" colSpan={4}>No herbs recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

const RecommendationPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('generate');
  const [symptomsInput, setSymptomsInput] = useState('');
  const [conditionsInput, setConditionsInput] = useState('');
  const [medicationsInput, setMedicationsInput] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('female');
  const [severity, setSeverity] = useState('moderate');
  const [isPregnant, setIsPregnant] = useState(false);
  const [isBreastfeeding, setIsBreastfeeding] = useState(false);
  const [recipientType, setRecipientType] = useState('other');
  const [profileLoading, setProfileLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({
    symptoms: '',
    age: '',
    gender: '',
    recipient: '',
  });
  const [result, setResult] = useState(null);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyItems, setHistoryItems] = useState([]);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [historyFilters, setHistoryFilters] = useState({
    dateFrom: '',
    dateTo: '',
    rankingSource: 'all',
    blocked: 'all',
  });

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const profile = await userProfileService.getProfile();
        setUserProfile(profile || null);
      } catch (requestError) {
        setUserProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const userAge = useMemo(
    () => getAgeFromDateOfBirth(userProfile?.dateOfBirth),
    [userProfile?.dateOfBirth],
  );
  const hasUserDemographics = Boolean(userAge !== null && userProfile?.gender);

  useEffect(() => {
    if (hasUserDemographics) {
      setRecipientType('self');
    } else {
      setRecipientType('other');
    }
  }, [hasUserDemographics]);

  const loadHistory = async (page = 1) => {
    try {
      setHistoryLoading(true);
      setHistoryError('');
      const response = await herbService.getRecommendationHistory({
        page,
        limit: 10,
        dateFrom: historyFilters.dateFrom || undefined,
        dateTo: historyFilters.dateTo || undefined,
        rankingSource: historyFilters.rankingSource,
        blocked: historyFilters.blocked,
      });
      const data = response && typeof response === 'object' ? response : {};
      setHistoryItems(Array.isArray(data.items) ? data.items : []);
      setHistoryPagination(data.pagination || null);
      setHistoryPage(page);
    } catch (requestError) {
      setHistoryError(requestError?.details || requestError?.message || 'Failed to load recommendation history');
      setHistoryItems([]);
      setHistoryPagination(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory(1);
    }
  }, [activeTab, historyFilters]);

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextFormErrors = { symptoms: '', age: '', gender: '', recipient: '' };
    const symptoms = splitCsv(symptomsInput);
    if (symptoms.length === 0) {
      nextFormErrors.symptoms = 'Please add at least one symptom.';
    }

    const profileAge = recipientType === 'self' ? userAge : (age === '' ? undefined : Number(age));
    const profileGender = recipientType === 'self' ? userProfile?.gender : gender;

    if (recipientType === 'self' && !hasUserDemographics) {
      nextFormErrors.recipient = 'Your birth date and gender are not set. Please update them from Home.';
    }

    if (recipientType === 'other') {
      if (profileAge === undefined || Number.isNaN(profileAge)) {
        nextFormErrors.age = 'Age is required for someone else.';
      } else if (profileAge < 0 || profileAge > 120) {
        nextFormErrors.age = 'Enter an age between 0 and 120.';
      }
      if (!profileGender) {
        nextFormErrors.gender = 'Please select a gender.';
      }
    }

    if (nextFormErrors.symptoms || nextFormErrors.age || nextFormErrors.gender || nextFormErrors.recipient) {
      setFormErrors(nextFormErrors);
      setError('');
      return;
    }

    try {
      setLoading(true);
      setFormErrors({ symptoms: '', age: '', gender: '', recipient: '' });
      setError('');
      const payload = await herbService.recommendHerbs({
        symptoms,
        topN: 10,
        userProfile: {
          age: profileAge,
          gender: profileGender,
          severity,
          conditions: splitCsv(conditionsInput),
          medications: splitCsv(medicationsInput),
          allergies: splitCsv(allergiesInput),
          isPregnant,
          isBreastfeeding,
        },
      });
      setResult(payload || null);
    } catch (requestError) {
      setError(requestError?.details || requestError?.message || 'Failed to generate recommendations');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Card className="border border-border-primary" shadow="sm">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveTab('generate')}
            className={`px-3 py-1.5 rounded-md text-sm border ${activeTab === 'generate' ? 'border-brand text-brand bg-surface-brand' : 'border-border-primary text-secondary'}`}
          >
            Generate
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-md text-sm border ${activeTab === 'history' ? 'border-brand text-brand bg-surface-brand' : 'border-border-primary text-secondary'}`}
          >
            History
          </Button>
        </div>
      </Card>

      {activeTab === 'generate' && (
        <>
          <Card className="border border-border-primary" shadow="sm">
            <h1 className="text-xl font-semibold text-primary mb-4">Herb Recommendation</h1>

            <div className="mb-4">
              <label className="block text-sm text-primary mb-2">Who is this recommendation for?</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!hasUserDemographics || profileLoading}
                  onClick={() => setRecipientType('self')}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    recipientType === 'self' ? 'border-brand text-brand bg-surface-brand' : 'border-border-primary text-secondary'
                  } ${(!hasUserDemographics || profileLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  For me
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRecipientType('other')}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    recipientType === 'other' ? 'border-brand text-brand bg-surface-brand' : 'border-border-primary text-secondary'
                  }`}
                >
                  For someone else
                </Button>
              </div>
              {!profileLoading && !hasUserDemographics && (
                <div className="text-sm text-warning mt-2">
                  Your birth date and gender are not set. Add them on the Home page to enable "For me".
                </div>
              )}
              {formErrors.recipient && (
                <div className="text-sm text-error mt-2">{formErrors.recipient}</div>
              )}
              {recipientType === 'self' && hasUserDemographics && (
                <div className="text-sm text-secondary mt-2">
                  Using your profile: age {userAge}, gender {userProfile?.gender}.
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-primary mb-1">Symptoms (comma-separated)</label>
                <Input
                  className={fieldClassName}
                  value={symptomsInput}
                  onChange={(e) => {
                    setSymptomsInput(e.target.value);
                    setFormErrors((prev) => ({ ...prev, symptoms: '' }));
                  }}
                  placeholder="e.g. headache, nausea"
                  error={formErrors.symptoms || undefined}
                />
              </div>

              {recipientType === 'other' && (
                <>
                  <div>
                    <label className={`block text-sm mb-1 ${formErrors.age ? 'text-error' : 'text-primary'}`}>Age</label>
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      className={fieldClassName}
                      value={age}
                      onChange={(e) => {
                        setAge(e.target.value);
                        setFormErrors((prev) => ({ ...prev, age: '' }));
                      }}
                      error={formErrors.age || undefined}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${formErrors.gender ? 'text-error' : 'text-primary'}`}>Gender</label>
                    <Dropdown
                      value={gender}
                      onChange={(value) => {
                        setGender(value);
                        setFormErrors((prev) => ({ ...prev, gender: '' }));
                      }}
                      options={genderOptions}
                      customClasses={{ input: fieldClassName }}
                    />
                    {formErrors.gender && <p className="text-xs text-error mt-1">{formErrors.gender}</p>}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-primary mb-1">Condition Severity</label>
                <Dropdown value={severity} onChange={setSeverity} options={severityOptions} customClasses={{ input: fieldClassName }} />
              </div>
              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 text-sm text-secondary">
                  <Checkbox id="recommendation-pregnant" checked={isPregnant} onChange={(checked) => setIsPregnant(!!checked)} />
                  Pregnant
                </label>
                <label className="flex items-center gap-2 text-sm text-secondary">
                  <Checkbox id="recommendation-breastfeeding" checked={isBreastfeeding} onChange={(checked) => setIsBreastfeeding(!!checked)} />
                  Breastfeeding
                </label>
              </div>
              <div>
                <label className="block text-sm text-primary mb-1">Medical Conditions (comma-separated)</label>
                <Input className={fieldClassName} value={conditionsInput} onChange={(e) => setConditionsInput(e.target.value)} placeholder="e.g. hypertension" />
              </div>
              <div>
                <label className="block text-sm text-primary mb-1">Medications (comma-separated)</label>
                <Input className={fieldClassName} value={medicationsInput} onChange={(e) => setMedicationsInput(e.target.value)} placeholder="e.g. lisinopril" />
              </div>
              <div>
                <label className="block text-sm text-primary mb-1">Allergies (comma-separated)</label>
                <Input className={fieldClassName} value={allergiesInput} onChange={(e) => setAllergiesInput(e.target.value)} placeholder="e.g. ragweed" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={loading}>{loading ? 'Generating...' : 'Generate Recommendations'}</Button>
              </div>
            </form>
            {error && <div className="text-sm text-error mt-3">{error}</div>}
          </Card>

          {result && (
            <>
              {result.status === 'blocked_red_flag' && (
                <Card className="border border-error" shadow="sm">
                  <h2 className="text-base font-semibold text-error mb-2">Recommendations Blocked</h2>
                  <p className="text-sm text-error mb-2">
                    {result.message || 'At least one red-flag symptom requires medical attention before herb recommendations can be shown.'}
                  </p>
                </Card>
              )}

              {Array.isArray(result.redFlags) && result.redFlags.length > 0 && (
                <Card className="border border-warning" shadow="sm">
                  <h2 className="text-base font-semibold text-warning mb-2">Medical Attention Flags</h2>
                  <ul className="space-y-1">
                    {result.redFlags.map((item) => (
                      <li key={item._id || item.name} className="text-sm text-warning">{item.name}: {item.medicalAttentionNote}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {result.status !== 'blocked_red_flag' && (
                <Card className="border border-border-primary" shadow="sm">
                  <div className="text-sm text-secondary mb-3">Ranking source: <span className="font-semibold text-primary">{result.rankingSource || 'unknown'}</span></div>
                  {(result?.excluded?.combinationConflicts || []).length > 0 && (
                    <div className="text-sm text-warning mb-3">
                      {(result.excluded.combinationConflicts || []).length} herb(s) were removed due to major or contraindicated combination conflicts.
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-primary text-left text-tertiary">
                          <th className="py-2 pr-3">Herb</th>
                          <th className="py-2 pr-3">Score</th>
                          <th className="py-2 pr-3">Pred. Rating</th>
                          <th className="py-2 pr-3">Effectiveness</th>
                          <th className="py-2 pr-3">Warnings</th>
                          <th className="py-2">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.results || []).map((entry) => (
                          <tr key={entry.herb?._id} className="border-b border-border-primary/50">
                            <td className="py-2 pr-3">
                              <div className="font-medium text-primary">{entry.herb?.name}</div>
                              <div className="text-xs italic text-tertiary">{entry.herb?.scientificName}</div>
                            </td>
                            <td className="py-2 pr-3 text-secondary">{Number(entry.score || 0).toFixed(3)}</td>
                            <td className="py-2 pr-3 text-secondary">{entry.predictedRating == null ? '-' : Number(entry.predictedRating).toFixed(2)}</td>
                            <td className="py-2 pr-3 text-secondary">{entry.predictedEffectiveness || '-'}</td>
                            <td className="py-2 pr-3 text-secondary">{entry.warnings?.length || 0}</td>
                            <td className="py-2">
                              {getHerbRouteParam(entry.herb)
                                ? <Link to={`/herbs/${getHerbRouteParam(entry.herb)}`} className="text-brand hover:underline">Open</Link>
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
              {result.status !== 'blocked_red_flag' && (result.results || []).length === 0 && (
                <Card className="border border-border-primary" shadow="sm">
                  {result.status === 'no_matches' ? (
                    <div className="text-sm text-secondary">
                      No matching herbs were found for the provided symptoms.
                    </div>
                  ) : (
                    <div className="text-sm text-secondary">
                      No recommendations were returned after safety checks.
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <Card className="border border-border-primary" shadow="sm">
          <h1 className="text-xl font-semibold text-primary mb-4">Recommendation History</h1>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs text-tertiary mb-1">From</label>
              <Input
                type="date"
                value={historyFilters.dateFrom}
                onChange={(e) => setHistoryFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className={fieldClassName}
              />
            </div>
            <div>
              <label className="block text-xs text-tertiary mb-1">To</label>
              <Input
                type="date"
                value={historyFilters.dateTo}
                onChange={(e) => setHistoryFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                className={fieldClassName}
              />
            </div>
            <div>
              <label className="block text-xs text-tertiary mb-1">Ranking Source</label>
              <Dropdown
                value={historyFilters.rankingSource}
                onChange={(value) => setHistoryFilters((prev) => ({ ...prev, rankingSource: value }))}
                options={rankingSourceOptions}
                customClasses={{ input: fieldClassName }}
              />
            </div>
            <div>
              <label className="block text-xs text-tertiary mb-1">Blocked</label>
              <Dropdown
                value={historyFilters.blocked}
                onChange={(value) => setHistoryFilters((prev) => ({ ...prev, blocked: value }))}
                options={blockedOptions}
                customClasses={{ input: fieldClassName }}
              />
            </div>
          </div>
          {historyError && <div className="text-sm text-error mb-3">{historyError}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary text-left text-tertiary">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Symptoms</th>
                  <th className="py-2 pr-3">Top Herbs</th>
                  <th className="py-2 pr-3">Count</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading && (
                  <tr>
                    <td className="py-3 text-secondary" colSpan={7}>Loading history...</td>
                  </tr>
                )}
                {!historyLoading && historyItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border-primary/50 cursor-pointer hover:bg-surface-secondary/60"
                    onClick={() => setSelectedHistoryItem(item)}
                  >
                    <td className="py-2 pr-3 text-secondary">{formatDateTime(item.createdAt)}</td>
                    <td className="py-2 pr-3 text-secondary">{(item.symptoms || []).slice(0, 3).join(', ') || '-'}{(item.symptoms || []).length > 3 ? ` +${item.symptoms.length - 3}` : ''}</td>
                    <td className="py-2 pr-3 text-secondary">
                      {(item.topHerbs || []).map((herb) => herb.name).filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="py-2 pr-3 text-secondary">{item.recommendationCount ?? 0}</td>
                    <td className="py-2 pr-3 text-secondary">{item.rankingSource || 'unknown'}</td>
                    <td className="py-2 pr-3 text-secondary">{item.status || '-'}</td>
                    <td className="py-2 text-secondary">{item.feedbackRating == null ? '-' : item.feedbackRating}</td>
                  </tr>
                ))}
                {!historyLoading && historyItems.length === 0 && (
                  <tr>
                    <td className="py-3 text-secondary" colSpan={7}>No recommendation history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-tertiary">
              Page {historyPagination?.page || 1} of {historyPagination?.totalPages || 1}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => loadHistory(Math.max(1, historyPage - 1))}
                disabled={historyLoading || !(historyPagination?.hasPrevPage)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => loadHistory(historyPage + 1)}
                disabled={historyLoading || !(historyPagination?.hasNextPage)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
      <RecommendationHistoryDetailModal
        item={selectedHistoryItem}
        onClose={() => setSelectedHistoryItem(null)}
      />
    </div>
  );
};

export default RecommendationPage;
