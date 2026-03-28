import React, { useState } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Checkbox from '../../components/common/Checkbox';
import Input from '../../components/common/Input';
import { herbService } from '../../services/herbService';

const splitCsv = (value = '') => value.split(',').map((item) => item.trim()).filter(Boolean);
const fieldClassName = 'w-full px-3 py-2 rounded-lg bg-surface-primary text-primary';

const HerbSafetyPage = () => {
  const [selectedHerb, setSelectedHerb] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [conditionsInput, setConditionsInput] = useState('');
  const [medicationsInput, setMedicationsInput] = useState('');
  const [pairInput, setPairInput] = useState('');
  const [age, setAge] = useState('');
  const [isPregnant, setIsPregnant] = useState(false);
  const [isBreastfeeding, setIsBreastfeeding] = useState(false);
  const [tab, setTab] = useState('interactions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({
    herb: '',
    age: '',
  });
  const [interactionData, setInteractionData] = useState(null);
  const [contraData, setContraData] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [combinationData, setCombinationData] = useState([]);

  const runSearch = async (value) => {
    setSearch(value);
    if (!value || value.length < 2) {
      setResults([]);
      return;
    }
    try {
      const response = await herbService.searchHerbs(value);
      const herbs = Array.isArray(response?.data) ? response.data : [];
      setResults(herbs.slice(0, 8));
    } catch (e) {
      setResults([]);
    }
  };

  const runChecks = async () => {
    const nextFormErrors = { herb: '', age: '' };
    if (!selectedHerb?._id && !selectedHerb?.slug) {
      nextFormErrors.herb = 'Select a herb first.';
    }

    const numericAge = age === '' ? undefined : Number(age);
    if (numericAge !== undefined && (Number.isNaN(numericAge) || numericAge < 0 || numericAge > 120)) {
      nextFormErrors.age = 'Enter an age between 0 and 120.';
    }

    if (nextFormErrors.herb || nextFormErrors.age) {
      setFormErrors(nextFormErrors);
      setError('');
      return;
    }
    setFormErrors({ herb: '', age: '' });

    const herbId = selectedHerb._id || selectedHerb.slug;
    const profile = {
      age: numericAge,
      isPregnant,
      isBreastfeeding,
      conditions: splitCsv(conditionsInput),
      medications: splitCsv(medicationsInput),
    };

    try {
      setLoading(true);
      setError('');
      const [assessmentRes, interactionsRes, contraRes] = await Promise.all([
        herbService.assessHerbSafety(herbId, profile),
        herbService.getHerbInteractions(herbId, { medications: profile.medications }),
        herbService.getHerbContraindications(herbId, profile.conditions),
      ]);

      setAssessment(assessmentRes?.data || null);
      setInteractionData(interactionsRes?.data || null);
      setContraData(Array.isArray(contraRes?.data) ? contraRes.data : []);

      const pairNames = splitCsv(pairInput);
      if (pairNames.length > 0) {
        const found = [];
        for (const name of pairNames) {
          const searchRes = await herbService.searchHerbs(name);
          const list = Array.isArray(searchRes?.data) ? searchRes.data : [];
          if (list[0]?._id) found.push(list[0]._id);
        }
        if (found.length > 0 && selectedHerb?._id) {
          const comboRes = await herbService.checkCombinationSafety([selectedHerb._id, ...found]);
          setCombinationData(Array.isArray(comboRes?.data) ? comboRes.data : []);
        } else {
          setCombinationData([]);
        }
      } else {
        setCombinationData([]);
      }
    } catch (requestError) {
      setError(requestError?.details || requestError?.message || 'Failed to run safety checks');
      setInteractionData(null);
      setContraData(null);
      setAssessment(null);
      setCombinationData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Card className="border border-border-primary" shadow="sm">
        <h1 className="text-xl font-semibold text-primary mb-4">Herb Safety Check</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className={`block text-sm mb-1 ${formErrors.herb ? 'text-error' : 'text-primary'}`}>Herb</label>
            <Input
              className={fieldClassName}
              value={search}
              onChange={(e) => {
                runSearch(e.target.value);
                setFormErrors((prev) => ({ ...prev, herb: '' }));
              }}
              placeholder="Search herb"
              error={formErrors.herb || undefined}
            />
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-surface-primary border border-border-primary rounded-lg max-h-52 overflow-y-auto">
                {results.map((herb) => (
                  <Button
                    key={herb._id}
                    type="button"
                    variant="ghost"
                    className="w-full text-left px-3 py-2 hover:bg-surface-secondary rounded-none"
                    onClick={() => {
                      setSelectedHerb(herb);
                      setSearch(herb.name);
                      setResults([]);
                      setFormErrors((prev) => ({ ...prev, herb: '' }));
                    }}
                  >
                    <div className="text-sm text-primary">{herb.name}</div>
                    <div className="text-xs text-tertiary italic">{herb.scientificName}</div>
                  </Button>
                ))}
              </div>
            )}
          </div>
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
            <label className="block text-sm text-primary mb-1">Conditions (comma-separated)</label>
            <Input className={fieldClassName} value={conditionsInput} onChange={(e) => setConditionsInput(e.target.value)} placeholder="e.g. diabetes" />
          </div>
          <div>
            <label className="block text-sm text-primary mb-1">Medications (comma-separated)</label>
            <Input className={fieldClassName} value={medicationsInput} onChange={(e) => setMedicationsInput(e.target.value)} placeholder="e.g. warfarin" />
          </div>
          <div>
            <label className="block text-sm text-primary mb-1">Herb Combination Check (other herbs, comma-separated)</label>
            <Input className={fieldClassName} value={pairInput} onChange={(e) => setPairInput(e.target.value)} placeholder="e.g. ginkgo, garlic" />
          </div>
          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-sm text-secondary">
              <Checkbox id="herb-safety-pregnant" checked={isPregnant} onChange={(checked) => setIsPregnant(!!checked)} />
              Pregnant
            </label>
            <label className="flex items-center gap-2 text-sm text-secondary">
              <Checkbox id="herb-safety-breastfeeding" checked={isBreastfeeding} onChange={(checked) => setIsBreastfeeding(!!checked)} />
              Breastfeeding
            </label>
          </div>
          <div className="md:col-span-2">
            <Button type="button" onClick={runChecks} disabled={loading || !selectedHerb}>
              {loading ? 'Checking...' : 'Run Safety Checks'}
            </Button>
          </div>
        </div>
        {error && <div className="text-sm text-error mt-3">{error}</div>}
      </Card>

      <Card className="border border-border-primary" shadow="sm">
        <div className="flex gap-2 mb-4">
          <Button type="button" variant="ghost" onClick={() => setTab('interactions')} className={`px-3 py-1.5 rounded-md text-sm border ${tab === 'interactions' ? 'border-brand text-brand bg-surface-brand' : 'border-border-primary text-secondary'}`}>Interactions</Button>
          <Button type="button" variant="ghost" onClick={() => setTab('contraindications')} className={`px-3 py-1.5 rounded-md text-sm border ${tab === 'contraindications' ? 'border-brand text-brand bg-surface-brand' : 'border-border-primary text-secondary'}`}>Contraindications</Button>
        </div>

        {assessment && (
          <div className={`mb-4 px-3 py-2 rounded border ${assessment.safe ? 'border-success text-success bg-success/10' : 'border-error text-error bg-error/10'}`}>
            {assessment.safe ? 'No hard blockers detected for this profile.' : 'Blockers detected for this profile.'}
          </div>
        )}

        {tab === 'interactions' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-primary mb-2">Matched Drug Interactions</h2>
              <ul className="space-y-2">
                {(interactionData?.matchedDrugs || []).map((entry) => (
                  <li key={entry._id} className="text-sm text-secondary border border-border-primary rounded-md px-3 py-2">
                    <span className="font-semibold text-primary">{entry.interactsWith?.drugName}</span> ({entry.severity}) - {entry.effect}
                    {entry.mechanism?.description && <div className="text-xs text-tertiary mt-1">Mechanism: {entry.mechanism.description}</div>}
                  </li>
                ))}
                {(!interactionData?.matchedDrugs || interactionData.matchedDrugs.length === 0) && <li className="text-sm text-tertiary">No medication matches found.</li>}
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold text-primary mb-2">All Known Interactions</h2>
              <ul className="space-y-2">
                {(interactionData?.all || []).map((entry) => (
                  <li key={entry._id} className="text-sm text-secondary border border-border-primary rounded-md px-3 py-2">
                    <span className="font-semibold text-primary">{entry.interactsWith?.type === 'drug' ? entry.interactsWith?.drugName : entry.interactsWith?.herbId?.name}</span> ({entry.severity}) - {entry.effect}
                  </li>
                ))}
                {(!interactionData?.all || interactionData.all.length === 0) && <li className="text-sm text-tertiary">No interactions documented.</li>}
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold text-primary mb-2">Combination Conflicts</h2>
              <ul className="space-y-2">
                {(combinationData || []).map((entry) => (
                  <li key={entry._id} className="text-sm text-secondary border border-border-primary rounded-md px-3 py-2">
                    {entry.herbId?.name} + {entry.interactsWith?.herbId?.name} ({entry.severity}) - {entry.effect}
                  </li>
                ))}
                {(combinationData || []).length === 0 && <li className="text-sm text-tertiary">No combination conflicts found.</li>}
              </ul>
            </div>
          </div>
        )}

        {tab === 'contraindications' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-primary">Contraindications</h2>
            <ul className="space-y-2">
              {(contraData || []).map((item) => (
                <li key={item._id} className="text-sm text-secondary border border-border-primary rounded-md px-3 py-2">
                  <span className="font-semibold text-primary">{item.condition}</span> ({item.severity}) - {item.reason}
                  {item.causativeCompound?.name && <div className="text-xs text-tertiary mt-1">Compound: {item.causativeCompound.name} ({item.causativeCompound.category})</div>}
                </li>
              ))}
              {(contraData || []).length === 0 && <li className="text-sm text-tertiary">No contraindications matched.</li>}
            </ul>

            {assessment?.warnings?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-warning mb-1">Warnings</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {assessment.warnings.map((item) => <li key={item} className="text-sm text-warning">{item}</li>)}
                </ul>
              </div>
            )}
            {assessment?.blockers?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-error mb-1">Blockers</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {assessment.blockers.map((item) => <li key={item} className="text-sm text-error">{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default HerbSafetyPage;
