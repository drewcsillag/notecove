/**
 * EditorPanel Component Tests
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditorPanel } from '../EditorPanel';

// Mock i18n
jest.mock('../../../i18n', () => ({}));

describe('EditorPanel', () => {
  it('should render the editor panel title', () => {
    render(<EditorPanel />);
    expect(screen.getByText('editor.title')).toBeInTheDocument();
  });

  it('should render the editor placeholder', () => {
    render(<EditorPanel />);
    expect(screen.getByText('editor.placeholder')).toBeInTheDocument();
  });
});
