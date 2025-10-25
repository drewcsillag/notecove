/**
 * NotesListPanel Component Tests
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotesListPanel } from '../NotesListPanel';

// Mock i18n
jest.mock('../../../i18n', () => ({}));

describe('NotesListPanel', () => {
  it('should render the notes list panel title', () => {
    render(<NotesListPanel />);
    expect(screen.getByText('notes.title')).toBeInTheDocument();
  });

  it('should render the notes list placeholder', () => {
    render(<NotesListPanel />);
    expect(screen.getByText('notes.placeholder')).toBeInTheDocument();
  });
});
