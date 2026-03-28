import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import ImageGallery from '../../../components/common/ImageGallery';
import { herbService } from '../../../services/herbService';
import useBatchIntersectionObserver from '../../../hooks/useBatchIntersectionObserver';

const HerbDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [herb, setHerb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestSeqRef = useRef(0);
  const observeReveal = useBatchIntersectionObserver({ threshold: 0.08, rootMargin: '140px 0px' });

  useEffect(() => {
    loadHerb();
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (!herb?.scientificName) return;

    // Notify global breadcrumb without triggering an extra fetch there.
    window.dispatchEvent(new CustomEvent('herb-breadcrumb-label', {
      detail: { scientificName: herb.scientificName },
    }));
  }, [herb?.scientificName]);

  const loadHerb = async () => {
    if (!slug || slug === 'undefined') {
      setError('Herb not found');
      setLoading(false);
      return;
    }

    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;

    try {
      setLoading(true);
      setError(null);
      const response = await herbService.getHerbById(slug);
      if (requestSeqRef.current !== requestId) return;
      const herbData = response.data || response;
      setHerb(herbData);
    } catch (err) {
      if (requestSeqRef.current !== requestId) return;
      console.error('Failed to load herb:', err);
      setError('Herb not found');
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  if (loading) return <div className="min-h-screen bg-base-primary" />;

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-intent-danger rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-intent-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-40 mb-4">Herb Not Found</h2>
          <p className="text-neutral-30 mb-4">The herb you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/herbs')}>
            Back to Herbs
          </Button>
        </div>
      </div>
    );
  }

  if (!herb) {
    return <div className="min-h-screen bg-base-primary" />;
  }

  // Get display name (first common name or main name)
  const displayName = herb.commonNames?.[0] || herb.name || 'Unknown Herb';

  // Get primary image
  const imageUrl = herb.images?.find(img => img.isPrimary)?.url || herb.images?.[0]?.url || herb.image || `data:image/svg+xml;base64,${btoa(
    `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af" font-family="Arial, sans-serif" font-size="18">
        No Image Available
      </text>
    </svg>`
  )}`;

  return (
    <div className="min-h-screen bg-transparent pb-12">
      {/* Header */}
      <PageHeader
        title={displayName}
        subtitle={herb.scientificName}
        backTo="/herbs"
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero Image Gallery */}
            <Card className="overflow-hidden border-none shadow-sm io-reveal" data-io-animation="fade" ref={observeReveal('herbdetail-gallery')}>
              <ImageGallery
                images={herb.images || []}
                maxImages={6}
                herb={herb}
              />
            </Card>

            {/* Description */}
            <Card className="p-8 io-reveal" data-io-animation="slide" ref={observeReveal('herbdetail-description')}>
              <h2 className="text-2xl font-bold text-neutral-40 mb-4 font-display border-l-4 border-secondary pl-4">Description</h2>
              <div className="prose prose-neutral max-w-none text-neutral-30 leading-relaxed">
                {herb.description}
              </div>
            </Card>

            {/* Uses/Symptoms */}
            <Card className="p-8 io-reveal" data-io-animation="slide" ref={observeReveal('herbdetail-uses')}>
              <h2 className="text-2xl font-bold text-neutral-40 mb-6 font-display border-l-4 border-secondary pl-4">Traditional Uses & Properties</h2>
              <div className="space-y-6">
                {herb.symptoms && herb.symptoms.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-20 uppercase tracking-wider mb-3">Treats Symptoms</h3>
                    <div className="flex flex-wrap gap-2">
                      {herb.symptoms.map((symptom, index) => (
                        <span key={index} className="px-4 py-2 bg-base-tertiary border border-brand-hover rounded-full text-sm font-medium text-accent">
                          {symptom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {herb.properties && herb.properties.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-20 uppercase tracking-wider mb-3">Therapeutic Properties</h3>
                    <div className="flex flex-wrap gap-2">
                      {herb.properties.map((prop, index) => (
                        <span key={index} className="px-4 py-2 bg-base-tertiary border border-brand-hover rounded-full text-sm font-medium text-accent">
                          {prop}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Active Compounds (Phytochemicals) */}
            {herb.phytochemicals && herb.phytochemicals.length > 0 && (
              <Card className="p-8 io-reveal" data-io-animation="slide" ref={observeReveal('herbdetail-compounds')}>
                <h2 className="text-2xl font-bold text-neutral-40 mb-6 font-display border-l-4 border-secondary pl-4">Active Compounds</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {herb.phytochemicals.map((compound, index) => (
                    <div key={index} className="bg-neutral-0 p-4 rounded-lg border border-neutral-10 hover:border-secondary transition-colors">
                      <h3 className="font-bold text-neutral-40 text-lg mb-1">{compound.compound?.name || 'Unknown compound'}</h3>
                      <p className="text-xs font-semibold text-secondary uppercase mb-2">
                        {compound.compound?.category?.replace('_', ' ') || 'Other'}
                      </p>
                      {compound.compound?.description && (
                        <p className="text-sm text-neutral-30 line-clamp-3">{compound.compound.description}</p>
                      )}
                      {compound.compound?.effects && compound.compound.effects.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {compound.compound.effects.map((benefit, i) => (
                            <span key={i} className="text-[10px] bg-neutral-0 border border-neutral-10 text-neutral-20 px-1.5 py-0.5 rounded">
                              {benefit}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Interactions */}
            {herb.interactions && herb.interactions.length > 0 && (
              <Card className="p-8 io-reveal" data-io-animation="slide" ref={observeReveal('herbdetail-interactions')}>
                <h2 className="text-2xl font-bold text-neutral-40 mb-6 font-display border-l-4 border-secondary pl-4 text-accent">Interactions</h2>
                <div className="space-y-4">
                  {herb.interactions.map((interaction, index) => (
                    <div key={index} className={`p-5 rounded-lg border-l-4 shadow-sm ${interaction.severity === 'major' || interaction.severity === 'contraindicated'
                      ? 'bg-intent-danger/5 border-intent-danger border-t border-r border-b'
                      : interaction.severity === 'moderate'
                        ? 'bg-intent-warning/5 border-intent-warning border-t border-r border-b'
                        : 'bg-secondary/5 border-secondary border-t border-r border-b'
                      }`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-neutral-40 text-lg">
                          {interaction.interactsWith?.type === 'drug'
                            ? `Interacts with: ${interaction.interactsWith.drugName}`
                            : `Interacts with: ${interaction.interactsWith.herbId?.name || 'Another herb'}`
                          }
                        </h3>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${interaction.severity === 'major' || interaction.severity === 'contraindicated'
                          ? 'bg-intent-danger text-neutral-0'
                          : interaction.severity === 'moderate'
                            ? 'bg-intent-warning text-white'
                            : 'bg-secondary text-white'
                          }`}>
                          {interaction.severity}
                        </span>
                      </div>
                      <p className="text-neutral-30 mb-2 font-medium">{interaction.effect}</p>
                      <div className="text-sm text-neutral-30 bg-neutral-0/50 p-2 rounded border border-neutral-10 italic">
                        <strong>Recommendation:</strong> {interaction.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Contraindications */}
            {herb.contraindications && herb.contraindications.length > 0 && (
              <Card className="p-8 bg-intent-danger/5 border-none io-reveal" data-io-animation="slide" ref={observeReveal('herbdetail-contraindications')}>
                <h2 className="text-2xl font-bold text-intent-danger mb-6 font-display flex items-center">
                  <svg className="w-8 h-8 mr-3 text-intent-danger" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Contraindications
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {herb.contraindications.map((item, index) => (
                    <div key={index} className="flex items-start space-x-3 bg-neutral-0 p-4 rounded-lg shadow-sm">
                      <div className="w-2 h-2 bg-intent-danger rounded-full mt-2 shrink-0"></div>
                      <p className="text-intent-danger font-medium leading-tight">
                        {item.condition || item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Reviews */}
            {herb.reviews && herb.reviews.length > 0 && (
              <Card className="p-8 io-reveal" data-io-animation="slide" ref={observeReveal('herbdetail-reviews')}>
                <h2 className="text-2xl font-bold text-neutral-40 mb-8 font-display border-l-4 border-secondary pl-4">User Experience & Reviews</h2>
                <div className="space-y-8">
                  {herb.reviews.map((review, index) => (
                    <div key={index} className="border-b border-neutral-10 last:border-0 pb-8 last:pb-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-secondary/10 flex items-center justify-center text-secondary font-bold text-xl border-2 border-bg shadow-sm">
                            {review.userId?.photoURL ? (
                              <img src={review.userId.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (review.userId?.displayName || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-neutral-40">{review.userId?.displayName || 'Anonymous'}</p>
                            <div className="flex items-center mt-1">
                              {[...Array(5)].map((_, i) => (
                                <svg key={i} className={`w-4 h-4 ${i < review.rating ? 'text-secondary fill-current' : 'text-neutral-10'}`} viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-neutral-20 tabular-nums">
                          {new Date(review.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="bg-neutral-0 border border-neutral-10 p-4 rounded-lg">
                        <p className="text-neutral-30 leading-relaxed italic">"{review.comment}"</p>
                      </div>
                      {review.usedFor && review.usedFor.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {review.usedFor.map((use, i) => (
                            <span key={i} className="text-[10px] uppercase font-bold tracking-widest bg-neutral-0 border border-neutral-10 text-neutral-20 px-2 py-1 rounded">
                              Used for: {use}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Quick Info */}
            <Card className="p-6 overflow-hidden relative io-reveal" data-io-animation="fade" ref={observeReveal('herbdetail-sidebar-info')}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-bl-full -mr-10 -mt-10"></div>
              <h3 className="text-lg font-bold text-neutral-40 mb-6 font-display border-b border-neutral-10 pb-2">Quick Info</h3>
              <div className="space-y-5">
                {herb.family && (
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Family</span>
                    <p className="text-gray-700 font-medium">{herb.family}</p>
                  </div>
                )}

                {herb.commonNames && herb.commonNames.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Common Names</span>
                    <div className="flex flex-wrap gap-2">
                      {herb.commonNames.map((name, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-base-tertiary border border-brand-hover text-accent text-xs rounded hover:border-secondary transition-colors"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {herb.partsUsed && herb.partsUsed.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Parts Used</span>
                    <div className="flex flex-wrap gap-2">
                      {herb.partsUsed.map((part, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-base-tertiary border border-brand-hover rounded-full text-xs font-medium text-accent"
                        >
                          {part}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dosage Information */}
                <div className="pt-4 border-t border-neutral-10">
                  <span className="text-xs font-bold text-neutral-20 uppercase tracking-widest block mb-3">Dosage Information</span>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-neutral-30 block mb-1">Adult</span>
                      <p className="text-neutral-30 text-sm">
                        {herb.dosage?.adult?.min && herb.dosage?.adult?.max ? (
                          <a
                            href={herb.dosage.sources?.[0]?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View dosage source"
                            className="text-accent hover:text-accent-hover transition-colors"
                          >
                            {`${herb.dosage.adult.min}-${herb.dosage.adult.max} ${herb.dosage.adult.unit || ''}`.trim()}
                          </a>
                        ) : (
                          herb.dosage?.adult?.min || herb.dosage?.adult?.max || <span className="text-neutral-20 italic">No dosage information available</span>
                        )}
                        {herb.dosage?.adult?.frequency && (
                          <span className="ml-1 text-neutral-20">({herb.dosage.adult.frequency})</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-neutral-30 block mb-1">Child</span>
                      <p className="text-neutral-30 text-sm">
                        {herb.dosage?.child?.min && herb.dosage?.child?.max ? (
                          <a
                            href={herb.dosage.sources?.[0]?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View dosage source"
                            className="text-accent hover:text-accent-hover transition-colors"
                          >
                            {`${herb.dosage.child.min}-${herb.dosage.child.max} ${herb.dosage.child.unit || ''}`.trim()}
                          </a>
                        ) : (
                          herb.dosage?.child?.min || herb.dosage?.child?.max || <span className="text-neutral-20 italic">No dosage information available</span>
                        )}
                        {herb.dosage?.child?.frequency && (
                          <span className="ml-1 text-neutral-20">({herb.dosage.child.frequency})</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Preparations */}
            {herb.preparation && herb.preparation.length > 0 && (
              <Card className="p-6 io-reveal" data-io-animation="fade" ref={observeReveal('herbdetail-sidebar-prep')}>
                <h3 className="text-lg font-bold text-neutral-40 mb-6 font-display border-b border-neutral-10 pb-2">Preparation Guide</h3>
                <div className="space-y-4">
                  {herb.preparation.map((prep, index) => (
                    <div key={index} className="group cursor-default">
                      <h4 className="font-bold text-neutral-40 capitalize flex items-center mb-1 group-hover:text-secondary transition-colors">
                        <span className="w-2 h-2 rounded-full bg-secondary mr-2 opacity-50 group-hover:opacity-100"></span>
                        {prep.method}
                      </h4>
                      {prep.instructions && (
                        <p className="text-sm text-neutral-30 leading-snug pl-4">{prep.instructions}</p>
                      )}
                      {prep.ratio && (
                        <div className="mt-1 pl-4">
                          <span className="text-[10px] font-bold text-neutral-20 uppercase tracking-widest">Ratio: {prep.ratio}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Growing Information */}
            {herb.growingInfo && (
              <Card className="p-6 io-reveal" data-io-animation="fade" ref={observeReveal('herbdetail-sidebar-growing')}>
                <h3 className="text-lg font-bold text-neutral-40 mb-6 font-display border-b border-neutral-10 pb-2">Cultivation</h3>
                <div className="space-y-4">
                  {Object.entries(herb.growingInfo).map(([key, value]) => (
                    value && (
                      <div key={key}>
                        <span className="text-[10px] font-bold text-neutral-20 uppercase tracking-widest block mb-1">{key}</span>
                        <p className="text-sm text-neutral-30 leading-tight">{value}</p>
                      </div>
                    )
                  ))}
                </div>
              </Card>
            )}

            {/* Safety Disclaimer */}
            <div className="p-6 bg-intent-warning/5 rounded-xl border border-yellow-600/50 relative overflow-hidden io-reveal" data-io-animation="fade" ref={observeReveal('herbdetail-sidebar-disclaimer')}>
              <svg className="absolute -right-4 -bottom-4 w-24 h-24 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h3 className="text-yellow-600 font-bold mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Safety First
              </h3>
              <p className="text-sm text-neutral-30 leading-relaxed relative z-10">
                Always consult with a healthcare professional before using herbal remedies, especially if you have existing medical conditions, are
              </p>
              <p className="text-sm text-neutral-30 leading-relaxed relative z-10">
                pregnant, or taking prescribed medicine.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HerbDetailPage;
