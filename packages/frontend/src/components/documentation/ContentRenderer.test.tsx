import React from 'react';
import { render } from '@testing-library/react';
import { ContentRenderer } from './ContentRenderer';

describe('ContentRenderer', () => {
  it('renders without crashing', () => {
    render(<ContentRenderer content={[]} />);
  });
}); 