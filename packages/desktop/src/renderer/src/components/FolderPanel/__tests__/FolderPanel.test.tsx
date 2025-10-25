/**
 * FolderPanel Component Tests
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FolderPanel } from '../FolderPanel';

// Mock i18n
jest.mock('../../../i18n', () => ({}));

describe('FolderPanel', () => {
  it('should render the folder panel title', () => {
    render(<FolderPanel />);
    expect(screen.getByText('folders.title')).toBeInTheDocument();
  });

  it('should render the folder panel placeholder', () => {
    render(<FolderPanel />);
    expect(screen.getByText('folders.placeholder')).toBeInTheDocument();
  });
});
