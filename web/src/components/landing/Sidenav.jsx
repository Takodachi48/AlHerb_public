import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { SYSTEM_SHORT_NAME } from '../../../../shared/constants/app.js';
import { useSwiper } from '../../context/SwiperContext';

const SideNav = () => {
  const sections = [
    { id: 'welcome', name: 'Welcome' },
    { id: 'recent', name: 'Recent' },
    { id: 'about', name: 'About' },
    { id: 'more', name: 'More' },
    { id: 'contact', name: 'Contact' }
  ];

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize active section based on URL hash or default to welcome
  const getInitialActiveSection = () => {
    const hash = window.location.hash.replace('#', '');
    return hash && sections.some(section => section.id === hash) ? hash : 'welcome';
  };

  const [activeSection, setActiveSection] = useState(getInitialActiveSection);
  const [isOpen, setIsOpen] = useState(() => window.innerWidth >= 768); // Default open on desktop, closed on mobile
  const swiper = useSwiper();

  useEffect(() => {
    // Listen for swiper slide changes
    const handleSlideChange = (event) => {
      if (event.detail && event.detail.slide) {
        setActiveSection(event.detail.slide);
      }
    };

    // Listen for hash changes as backup
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && sections.some(section => section.id === hash)) {
        setActiveSection(hash);
      }
    };

    // Set initial active section
    handleHashChange();

    window.addEventListener('slideChange', handleSlideChange);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('slideChange', handleSlideChange);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigateToSlide = (sectionId) => {
    if (swiper) {
      // Find the slide index
      const slideIndex = sections.findIndex(section => section.id === sectionId);
      if (slideIndex !== -1) {
        swiper.slideTo(slideIndex);
        setActiveSection(sectionId);
      }
    }
  };

  return (
    <>
      {/* Hamburger Toggle Button - anchored vertically to sidenav, always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-6 top-1/2 z-50 p-1 rounded-md hover:bg-surface-secondary transition-colors"
        style={{ top: isMobile ? '6vh' : 'calc(38vh - 116px)', transform: 'translateY(-50%) translateX(-50%) scale(1.15)' }}
        aria-label="Toggle navigation"
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <path
            d="M3 5c0-1.1.9-2 2-2h4v18H5c-1.1 0-2-.9-2-2V5z"
            fill="currentColor"
            className="opacity-40"
            stroke="none"
          />
          <path
            d="M14 15l3-3-3-3"
            strokeWidth="2.5"
            className={`transition-transform duration-300 origin-[15px_12px] ${isOpen ? 'rotate-180' : ''}`}
          />
        </svg>
      </button>

      {/* Mobile Backdrop */}
      <div className={`md:hidden fixed left-0 top-0 w-2/4 h-full bg-base-secondary z-30 transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />

      {/* Side Navigation Panel */}
      <div 
        className={`fixed left-2 top-1/2 w-48 z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ transform: isOpen ? 'translateY(-50%) scale(1.15)' : 'translateY(-50%) translateX(-100%) scale(1.15)' }}
      >
        <div className="p-6">
          {/* Spacer for button */}
          <div className="mb-4"></div>

          {/* Navigation Items with vertical line indicator */}
          <nav className="relative flex-1">
            {/* Vertical line */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border-primary"></div>

            {/* Active indicator dot - centered on each button */}
            <div
              className="absolute left-0 w-0.5 bg-border-primary transition-all duration-300"
              style={{
                height: '2.5rem',
                transform: `translateY(${sections.findIndex(s => s.id === activeSection) * 4}rem)`
              }}
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-5 bg-accent dark:shadow-[0_0_8px_var(--interactive-accent-indicator)]"></div>
            </div>

            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => navigateToSlide(section.id)}
                  className={`relative w-full text-left pl-6 transition-all duration-500 h-10 mb-6 flex items-center ${isActive ? 'text-primary' : 'text-secondary'
                    }`}
                  style={{
                    fontSize: isActive ? '1.2rem' : '0.875rem',
                    fontWeight: '600',
                    opacity: isActive ? 1 : 0.6
                  }}
                >
                  <span
                    className={`inline-block transition-all duration-300 font-display relative`}
                  >
                    {section.name}
                    <span 
                      className={`absolute bottom-0 left-0 h-0.5 bg-accent transition-all duration-300 ease-out ${isActive ? 'w-full' : 'w-0'}`}
                    />
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom spacer */}
          <div className="mt-auto"></div>
        </div>
      </div>
    </>
  );
};

export default SideNav;
