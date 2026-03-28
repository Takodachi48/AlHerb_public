import React from 'react';
import Button from './Button';
import { useNavigate } from 'react-router-dom';

const PageHeader = ({
  title,
  subtitle,
  showBackButton = true,
  backTo = '/herbs',
  backText = 'Back to Herbs',
  extraActions = null,
  className = '',
  customTitle = false,
  editableTitle = false,
  titleValue = '',
  subtitleValue = '',
  onTitleChange = null,
  onSubtitleChange = null
}) => {
  const navigate = useNavigate();

  const getHeaderClasses = () => {
    const baseClasses = 'sticky top-0 relative will-change-transform shadow-md bg-surface-primary z-20';

    return `${baseClasses} ${className}`;
  };

  const getTextClasses = () => {
    return 'text-primary';
  };

  const getSubtitleClasses = () => {
    return 'text-tertiary';
  };

  const getBackButtonClasses = () => {
    return 'bg-surface-secondary border border-primary text-primary hover:bg-surface-tertiary';
  };

  const renderEditableTitle = () => (
    <div className="flex-1 max-w-2xl">
      <input
        type="text"
        name="name"
        value={titleValue || ''}
        onChange={onTitleChange}
        className={`text-3xl font-bold font-display ${getTextClasses()} leading-tight bg-surface-primary border-b-2 border-transparent hover:border-primary/50 focus:border-brand focus:outline-none transition-colors w-full`}
        placeholder="Herb name"
      />
      <input
        type="text"
        name="scientificName"
        value={subtitleValue || ''}
        onChange={onSubtitleChange}
        className={`text-lg font-sans ${getSubtitleClasses()} italic bg-surface-primary border-b border-transparent hover:border-primary/50 focus:border-brand focus:outline-none transition-colors w-full mt-2`}
        placeholder="Scientific name"
      />
    </div>
  );

  return (
    <div className={getHeaderClasses()}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {showBackButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(backTo)}
                className={getBackButtonClasses()}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {backText}
              </Button>
            )}
            {editableTitle ? (
              renderEditableTitle()
            ) : (
              <div className="flex-1">
                {title && (
                  <h1 className={`text-3xl font-bold font-display ${getTextClasses()} leading-tight`}>
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className={`text-lg font-sans ${getSubtitleClasses()} italic`}>
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>
          {extraActions && (
            <div className="flex items-center space-x-3">
              {extraActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
