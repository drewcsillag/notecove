/**
 * Tests for DatePickerDialog keyboard navigation
 *
 * @see plans/datepicker-keyboard-nav/PLAN.md
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DatePickerDialog } from '../DatePickerDialog';
import dayjs from 'dayjs';

// Mock dayjs to have consistent dates in tests
const TODAY = '2025-01-15';
const TOMORROW = '2025-01-16';

jest.mock('dayjs', () => {
  const actualDayjs = jest.requireActual('dayjs');
  const mockDayjs = (date?: string | Date | dayjs.Dayjs) => {
    if (date === undefined) {
      return actualDayjs(TODAY);
    }
    return actualDayjs(date);
  };
  mockDayjs.extend = actualDayjs.extend;
  mockDayjs.locale = actualDayjs.locale;
  mockDayjs.isDayjs = actualDayjs.isDayjs;
  return mockDayjs;
});

describe('DatePickerDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSelect = jest.fn();
  const mockAnchorEl = document.createElement('button');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when open', () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate={null}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Tomorrow')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Select')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <DatePickerDialog
          open={false}
          initialDate={null}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });
  });

  describe('focus management', () => {
    it('should focus the selected day when dialog opens', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate={TODAY}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Wait for focus to be set
      await waitFor(() => {
        const selectedDay = document.querySelector('.MuiPickersDay-root.Mui-selected');
        expect(selectedDay).toBe(document.activeElement);
      });
    });
  });

  describe('keyboard shortcuts', () => {
    it('should select and close when Enter is pressed on a day', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate={TODAY}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Wait for dialog to be ready and day to be focused
      await waitFor(() => {
        const selectedDay = document.querySelector('.MuiPickersDay-root.Mui-selected');
        expect(selectedDay).toBe(document.activeElement);
      });

      // Press Enter on the focused day - this triggers MUI's click handler
      const selectedDay = document.querySelector('.MuiPickersDay-root.Mui-selected');
      fireEvent.keyDown(selectedDay!, { key: 'Enter' });
      // MUI converts Enter to click
      fireEvent.click(selectedDay!);

      expect(mockOnSelect).toHaveBeenCalledWith(TODAY);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should select and close when a day is clicked', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate={TODAY}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select')).toBeInTheDocument();
      });

      // Click on the selected day
      const selectedDay = document.querySelector('.MuiPickersDay-root.Mui-selected');
      fireEvent.click(selectedDay!);

      expect(mockOnSelect).toHaveBeenCalledWith(TODAY);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should select today and close when T is pressed', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate="2025-01-20" // Different from today
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select')).toBeInTheDocument();
      });

      const popover = document.querySelector('.MuiPopover-paper');
      fireEvent.keyDown(popover!, { key: 't' });

      expect(mockOnSelect).toHaveBeenCalledWith(TODAY);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should select today when T (uppercase) is pressed', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate="2025-01-20"
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select')).toBeInTheDocument();
      });

      const popover = document.querySelector('.MuiPopover-paper');
      fireEvent.keyDown(popover!, { key: 'T' });

      expect(mockOnSelect).toHaveBeenCalledWith(TODAY);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should select tomorrow and close when M is pressed', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate={TODAY}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select')).toBeInTheDocument();
      });

      const popover = document.querySelector('.MuiPopover-paper');
      fireEvent.keyDown(popover!, { key: 'm' });

      expect(mockOnSelect).toHaveBeenCalledWith(TOMORROW);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should select tomorrow when M (uppercase) is pressed', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate={TODAY}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select')).toBeInTheDocument();
      });

      const popover = document.querySelector('.MuiPopover-paper');
      fireEvent.keyDown(popover!, { key: 'M' });

      expect(mockOnSelect).toHaveBeenCalledWith(TOMORROW);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close without selecting when Escape is pressed', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate={TODAY}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select')).toBeInTheDocument();
      });

      const popover = document.querySelector('.MuiPopover-paper');
      fireEvent.keyDown(popover!, { key: 'Escape' });

      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('button interactions', () => {
    it('should select today when Today button is clicked', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate="2025-01-20"
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.click(screen.getByText('Today'));

      expect(mockOnSelect).toHaveBeenCalledWith(TODAY);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should select tomorrow when Tomorrow button is clicked', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate={TODAY}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.click(screen.getByText('Tomorrow'));

      expect(mockOnSelect).toHaveBeenCalledWith(TOMORROW);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close without selecting when Cancel is clicked', async () => {
      render(
        <DatePickerDialog
          open={true}
          initialDate={TODAY}
          anchorEl={mockAnchorEl}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
