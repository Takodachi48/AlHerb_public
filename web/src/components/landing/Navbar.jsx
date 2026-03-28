import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogoWrapper } from '../common';
import SearchButton from '../common/SearchButton';
import { DarkModeToggle } from '../common';
import { SYSTEM_SHORT_NAME } from '../../../../shared/constants/app.js';

const Navbar = ({ onSearchClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeItem, setActiveItem] = useState('');
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Trigger animation by setting active item after a small delay
    const timer = setTimeout(() => {
      setActiveItem(location.pathname);
    }, 50);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const navItems = [
    { id: 'home', name: 'Home', path: '/' },
    { id: 'about', name: 'About Us', path: '/about' },
    { id: 'blogs', name: 'Blogs', path: '/blogs' },
    { id: 'contact', name: 'Contact Us', path: '/contact' }
  ];

  const isActivePath = (path) => activeItem === path;

  return (
    <nav
      className={`
        w-full z-50
        transition-all duration-300 ease-in-out
        ${isScrolled ? 'navbar-scrolled' : 'navbar-top'}
      `}
    >
      {/* Content Container */}
      <div className="relative max-w-[1920px] mx-auto">
        <div className="flex items-center justify-between h-20 w-full px-6 lg:px-12 pt-12 pb-16">

          {/* Left Section: Logo + System Name */}
          <Link to="/" className="flex items-center gap-4 flex-shrink-0">
            <LogoWrapper
              width="48px"
              height="48px"
              className="transition-all duration-300"
              transparent
            />
            <span className="text-xl lg:text-2xl font-bold text-primary tracking-tight font-display">
              {SYSTEM_SHORT_NAME}
            </span>
          </Link>

          {/* Center Section: Navigation Links */}
          <div className="hidden lg:flex flex-1 justify-center items-end gap-1">
            {navItems.map((item) => {
              const isActive = isActivePath(item.path);

              return (
                <div
                  key={item.id}
                  className="relative flex flex-col items-center"
                >
                  <Link
                    to={item.path}
                    className={`
                      relative px-6 py-2.5 font-core
                      text-sm font-medium tracking-wide
                      transition-all duration-500 ease-out
                      ${isActive
                        ? 'text-primary scale-125 -translate-y-1'
                        : 'text-secondary hover:text-accent scale-100 translate-y-0'
                      }
                    `}
                  >
                    {item.name}
                  </Link>

                  {/* Animated Underline - expands from center */}
                  <span
                    className={`
                      h-0.5 bg-accent rounded-full
                      transition-all duration-500 ease-out
                      ${isActive ? 'w-full opacity-100' : 'w-0 opacity-0'}
                    `}
                  />
                </div>
              );
            })}
          </div>

          {/* Right Section: Search + CTA */}
          <div className="flex items-center gap-16 flex-shrink-0">

            {/* Search Button */}
            <SearchButton onClick={onSearchClick} />

            {/* Dark Mode Toggle */}
            <DarkModeToggle />
          </div>
        </div>
      </div>

    </nav>
  );
};

export default Navbar;
