/**
 * TipTapEditor Empty State Tests
 *
 * Tests that TipTapEditor shows an empty state message when no note is selected,
 * instead of showing a spinner forever.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';

// Mock the entire TipTapEditor module's heavy dependencies
jest.mock('../getEditorExtensions', () => ({
  getEditorExtensions: jest.fn(() => []),
}));

jest.mock('../tipTapEditorStyles', () => ({
  getTipTapEditorStyles: jest.fn(() => ({})),
}));

jest.mock('@tiptap/react', () => ({
  useEditor: () => null,
  EditorContent: () => <div data-testid="editor-content" />,
}));

jest.mock('yjs', () => ({
  Doc: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    destroy: jest.fn(),
  })),
}));

jest.mock('../useNoteSync', () => ({
  useNoteSync: () => ({ showSyncIndicator: false }),
}));

jest.mock('../useEditorStateRestoration', () => ({
  useEditorStateRestoration: jest.fn(),
}));

jest.mock('../useEditorImages', () => ({
  useEditorImages: () => ({
    handleImageButtonClick: jest.fn(),
  }),
}));

jest.mock('../useEditorComments', () => ({
  useEditorComments: () => ({
    openCommentCount: 0,
    handleCommentButtonClick: jest.fn(),
    overlapPopover: { open: false, threadIds: [], anchorEl: null },
    handleOverlapPopoverClose: jest.fn(),
    handleOverlapPopoverSelectThread: jest.fn(),
  }),
}));

jest.mock('../useEditorContextMenu', () => ({
  useEditorContextMenu: () => ({
    contextMenu: null,
    handleContextMenu: jest.fn(),
    handleContextMenuClose: jest.fn(),
    handleContextMenuCut: jest.fn(),
    handleContextMenuCopy: jest.fn(),
    handleContextMenuPaste: jest.fn(),
    handleContextMenuSelectAll: jest.fn(),
    handleContextMenuSearchGoogle: jest.fn(),
    handleContextMenuLookUp: jest.fn(),
    contextMenuSelectedText: '',
    hasLink: false,
    handleContextMenuOpenLink: jest.fn(),
    handleContextMenuCopyLink: jest.fn(),
    handleContextMenuEditLink: jest.fn(),
    handleContextMenuRemoveLink: jest.fn(),
  }),
}));

jest.mock('../useEditorLinkPopovers', () => ({
  useEditorLinkPopovers: () => ({
    linkPopoverData: null,
    showLinkInputPopover: false,
    linkInputAnchorEl: null,
    linkEditMode: 'text-and-url',
    setLinkPopoverData: jest.fn(),
    handleLinkPopoverClose: jest.fn(),
    handleLinkClick: jest.fn(),
    handleLinkEdit: jest.fn(),
    handleLinkRemove: jest.fn(),
    handleLinkButtonClick: jest.fn(),
    handleLinkInputSubmit: jest.fn(),
    handleLinkInputClose: jest.fn(),
    handleCmdKRef: { current: null },
  }),
}));

jest.mock('../extensions/WebLink', () => ({
  setWebLinkCallbacks: jest.fn(),
}));

jest.mock('../ImageLightbox', () => ({
  ImageLightbox: () => null,
}));

jest.mock('../ImageContextMenu', () => ({
  ImageContextMenu: () => null,
}));

jest.mock('../EditorToolbar', () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar">Toolbar</div>,
}));

jest.mock('../TableSizePickerDialog', () => ({
  TableSizePickerDialog: () => null,
}));

jest.mock('../DatePickerDialog', () => ({
  DatePickerDialog: () => null,
}));

jest.mock('../MentionPopover', () => ({
  MentionPopover: () => null,
}));

jest.mock('../SearchPanel', () => ({
  SearchPanel: () => null,
}));

// Mock electronAPI
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    sd: {
      getActive: jest.fn().mockResolvedValue({ id: 'test-sd' }),
    },
    user: {
      getCurrentProfile: jest.fn().mockResolvedValue({
        profileId: 'test-profile',
        username: 'Test User',
        handle: '@test',
      }),
    },
  },
});

// Import after mocks are set up
import { TipTapEditor } from '../TipTapEditor';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('TipTapEditor empty state', () => {
  it('should show empty state message when noteId is null', () => {
    renderWithTheme(<TipTapEditor noteId={null} />);

    // Should show the empty state message
    expect(screen.getByText(/select a note/i)).toBeInTheDocument();
  });

  it('should not show spinner when noteId is null', () => {
    renderWithTheme(<TipTapEditor noteId={null} />);

    // Should NOT show the loading spinner
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('should show spinner when noteId is provided and loading', () => {
    renderWithTheme(<TipTapEditor noteId="test-note-id" />);

    // Should show the loading spinner (CircularProgress has role="progressbar")
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
