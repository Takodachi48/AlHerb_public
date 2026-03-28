import React from 'react';
import PropTypes from 'prop-types';

const Table = ({
  headers,
  data,
  onRowClick = null,
  className = '',
  loading = false,
}) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="table">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={headers.length} className="text-center py-10">
              <div className="flex items-center justify-center gap-2">
                <span className="spinner" />
                <span className="label" style={{ marginBottom: 0 }}>Loading…</span>
              </div>
            </td>
          </tr>
        ) : (
          data.map((row, ri) => (
            <tr
              key={ri}
              onClick={() => onRowClick?.(row, ri)}
              className={onRowClick ? 'cursor-pointer' : ''}
            >
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

Table.propTypes = {
  headers: PropTypes.arrayOf(PropTypes.node).isRequired,
  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  onRowClick: PropTypes.func,
  className: PropTypes.string,
  loading: PropTypes.bool,
};

export default Table;
