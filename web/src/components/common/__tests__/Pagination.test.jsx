import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Pagination from '../Pagination';

describe('Pagination', () => {
  it('calls onPageChange when clicking next', () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        total={30}
        limit={10}
        onPageChange={onPageChange}
      />
    );

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('does not call onPageChange for disabled previous button on first page', () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        total={30}
        limit={10}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
