/**
 * DatePickerDialog Component
 *
 * A popover dialog containing a date picker. Used when:
 * - User clicks on an existing date chip to change the date
 * - User selects @date from the autocomplete menu
 */

import React, { useState, useEffect, useRef } from 'react';
import { Popover, Box, Button, Stack } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import dayjs, { Dayjs } from 'dayjs';

export interface DatePickerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Initial date to show (YYYY-MM-DD format or null for today) */
  initialDate: string | null;
  /** Anchor element for positioning */
  anchorEl: HTMLElement | null;
  /** Called when user selects a date */
  onSelect: (date: string) => void;
  /** Called when dialog is closed without selection */
  onClose: () => void;
}

/**
 * DatePickerDialog - Popover with date calendar
 */
export const DatePickerDialog: React.FC<DatePickerDialogProps> = ({
  open,
  initialDate,
  anchorEl,
  onSelect,
  onClose,
}) => {
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(() => {
    if (initialDate) {
      return dayjs(initialDate);
    }
    return dayjs();
  });

  const handleDateChange = (newDate: Dayjs | null): void => {
    if (newDate) {
      onSelect(newDate.format('YYYY-MM-DD'));
      onClose();
    }
  };

  const handleConfirm = (): void => {
    if (selectedDate) {
      onSelect(selectedDate.format('YYYY-MM-DD'));
    }
    onClose();
  };

  const handleCancel = (): void => {
    onClose();
  };

  // Quick date buttons
  const handleToday = (): void => {
    const today = dayjs();
    setSelectedDate(today);
    onSelect(today.format('YYYY-MM-DD'));
    onClose();
  };

  const handleTomorrow = (): void => {
    const tomorrow = dayjs().add(1, 'day');
    setSelectedDate(tomorrow);
    onSelect(tomorrow.format('YYYY-MM-DD'));
    onClose();
  };

  // Ref to the container for focus management
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the selected day when dialog opens for keyboard navigation
  useEffect(() => {
    if (!open) {
      return;
    }
    // Small delay to ensure the calendar is rendered
    const timeoutId = setTimeout(() => {
      const selectedDay = containerRef.current?.querySelector(
        '.MuiPickersDay-root.Mui-selected'
      ) as HTMLElement | null;
      if (selectedDay) {
        selectedDay.focus();
      }
    }, 50);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [open]);

  // Keyboard shortcuts handler
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    const key = event.key.toLowerCase();

    // T = Today
    if (key === 't') {
      event.preventDefault();
      event.stopPropagation();
      const today = dayjs();
      onSelect(today.format('YYYY-MM-DD'));
      onClose();
      return;
    }

    // M = toMorrow
    if (key === 'm') {
      event.preventDefault();
      event.stopPropagation();
      const tomorrow = dayjs().add(1, 'day');
      onSelect(tomorrow.format('YYYY-MM-DD'));
      onClose();
      return;
    }

    // Let MUI handle Enter/Space natively - it will trigger onChange
    // which we handle in handleDateChange

    // Escape = close without selecting
    if (event.key === 'Escape') {
      onClose();
      return;
    }
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={handleCancel}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      slotProps={{
        paper: {
          sx: { mt: 1 },
          onKeyDown: handleKeyDown,
        },
      }}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box ref={containerRef} sx={{ p: 1 }}>
          {/* Quick date buttons */}
          <Stack direction="row" spacing={1} sx={{ mb: 1, px: 1 }}>
            <Button size="small" variant="outlined" onClick={handleToday}>
              Today
            </Button>
            <Button size="small" variant="outlined" onClick={handleTomorrow}>
              Tomorrow
            </Button>
          </Stack>

          {/* Calendar */}
          <DateCalendar
            value={selectedDate}
            onChange={handleDateChange}
            sx={{
              '& .MuiPickersDay-root.Mui-selected': {
                backgroundColor: 'primary.main',
              },
            }}
          />

          {/* Action buttons */}
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ px: 2, pb: 1 }}>
            <Button size="small" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={handleConfirm}>
              Select
            </Button>
          </Stack>
        </Box>
      </LocalizationProvider>
    </Popover>
  );
};

export default DatePickerDialog;
