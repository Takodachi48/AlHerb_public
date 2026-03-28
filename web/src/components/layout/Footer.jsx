import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-surface-primary text-primary border-t border-primary/20">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-lg font-semibold font-display text-primary mb-4">
              Herbal Medicine
            </h3>
            <p className="text-sm font-sans text-tertiary">
              Discover natural remedies for your health needs with our comprehensive herbal medicine database.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold font-display text-primary mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm font-sans">
              <li>
                <Link to="/home" className="text-secondary hover:text-brand transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/recommendation" className="text-secondary hover:text-brand transition-colors">
                  Recommendations
                </Link>
              </li>
              <li>
                <Link to="/map" className="text-secondary hover:text-brand transition-colors">
                  Map
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold font-display text-primary mb-4">
              Contact
            </h3>
            <p className="text-sm font-sans text-tertiary">
              Email: info@herbalmedicine.com
            </p>
            <p className="text-sm font-sans text-tertiary">
              Phone: (555) 123-4567
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-primary/10">
          <p className="text-center text-sm font-sans text-tertiary">
            © 2024 Herbal Medicine. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
