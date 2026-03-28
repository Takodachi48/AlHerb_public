import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  it('calls onSubmit with current value', () => {
    const onSubmit = vi.fn();

    render(<SearchBar value="lagundi" onSubmit={onSubmit} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSubmit).toHaveBeenCalledWith('lagundi');
  });

  it('filters autocomplete options and selects one', () => {
    const onSelectOption = vi.fn();
    const onChange = vi.fn();

    render(
      <SearchBar
        value="lag"
        onChange={onChange}
        onSelectOption={onSelectOption}
        autocompleteOptions={[
          { label: 'Lagundi', value: 'lagundi' },
          { label: 'Sambong', value: 'sambong' },
        ]}
      />
    );

    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Lagundi' }));

    expect(onSelectOption).toHaveBeenCalledWith({ label: 'Lagundi', value: 'lagundi' });
  });
});
