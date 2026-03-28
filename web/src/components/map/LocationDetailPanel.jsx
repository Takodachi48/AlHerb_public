import React from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import Loading from '../common/Loading';

/**
 * Location Detail Panel Component
 * Displays detailed information about a selected location
 */
const LocationDetailPanel = ({
  location,
  herbs,
  isLoading,
  onClose,
  onEdit,
  onDelete,
  onHerbSelect
}) => {
  if (!location) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-bg rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto typography-user">
        {/* Header */}
        <div className="flex justify-between items-center p-6">
          <h2 className="text-xl font-semibold font-display text-text-neutral">
            {location.name}
          </h2>
          <Button
            variant="ghost"
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <Loading />
          ) : (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium font-display text-text-neutral mb-3">Location Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium font-sans text-text-neutral/60">Type</label>
                    <p className="text-text-neutral capitalize">{location.type}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium font-sans text-text-neutral/60">Status</label>
                    <span className={`px-2 py-1 rounded-full text-xs font-accent font-medium uppercase ${
                      location.status === 'active' 
                        ? 'bg-intent-success/10 text-intent-success' 
                        : 'bg-intent-danger/10 text-intent-danger'
                    }`}>
                      {location.status}
                    </span>
                  </div>
                </div>

                {location.address && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium font-sans text-text-neutral/60">Address</label>
                    <p className="text-text-neutral">{location.address}</p>
                  </div>
                )}

                {location.phone && (
                  <div>
                    <label className="text-sm font-medium font-sans text-text-neutral/60">Phone</label>
                    <p className="text-text-neutral">{location.phone}</p>
                  </div>
                )}

                {location.website && (
                  <div>
                    <label className="text-sm font-medium font-sans text-text-neutral/60">Website</label>
                    <a 
                      href={location.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {location.website}
                    </a>
                  </div>
                )}

                {location.hours && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium font-sans text-text-neutral/60">Hours</label>
                    <pre className="whitespace-pre-wrap text-text-neutral bg-surface/5 p-3 rounded">
                      {location.hours}
                    </pre>
                  </div>
                )}
              </div>

              {/* Description */}
              {location.description && (
                <div>
                  <h3 className="text-lg font-medium font-display text-text-neutral mb-3">Description</h3>
                  <p className="text-text-neutral leading-relaxed">
                    {location.description}
                  </p>
                </div>
              )}

              {/* Available Herbs */}
              {herbs && herbs.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium font-display text-text-neutral mb-3">
                    Available Herbs ({herbs.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {herbs.map(herb => (
                      <div 
                        key={herb.id}
                        className="p-4 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => onHerbSelect && onHerbSelect(herb.id)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-text-neutral">
                            {herb.name}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-accent font-medium uppercase ${
                            herb.availability === 'available' 
                              ? 'bg-intent-success/10 text-intent-success' 
                              : 'bg-intent-warning/10 text-intent-warning'
                          }`}>
                            {herb.availability || 'unknown'}
                          </span>
                        </div>
                        
                        {herb.scientificName && (
                          <p className="text-sm text-text-neutral/60 italic">
                            {herb.scientificName}
                          </p>
                        )}
                        
                        {herb.commonNames && herb.commonNames.length > 0 && (
                          <p className="text-xs text-text-neutral/60">
                            Also known as: {herb.commonNames.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coordinates */}
              {location.coordinates && (
                <div>
                  <h3 className="text-lg font-medium font-display text-text-neutral mb-3">Location</h3>
                  <div className="bg-surface/5 p-3 rounded">
                    <p className="text-sm text-text-neutral/60">
                      <strong>Coordinates:</strong><br />
                      Latitude: {location.coordinates[1]}<br />
                      Longitude: {location.coordinates[0]}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 p-6">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
            
            {onEdit && (
              <Button
                onClick={() => onEdit(location._id)}
              >
                Edit Location
              </Button>
            )}
            
            {onDelete && (
              <Button
                variant="danger"
                onClick={() => onDelete(location._id)}
              >
                Delete Location
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationDetailPanel;

