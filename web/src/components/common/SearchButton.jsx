import React from 'react';

const SearchButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="btn-icon"
    aria-label="Open search"
    title="Open search"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  </button>
);

export default SearchButton;
