/**
 * StepProfileName Tests
 *
 * Tests for the profile name step component.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepProfileName } from '../StepProfileName';
import type { StepProps } from '../types';

describe('StepProfileName', () => {
  const defaultState: StepProps['state'] = {
    profileName: '',
    mode: null,
    storagePath: null,
    cloudProvider: null,
    username: '',
    handle: '',
    availableCloudProviders: [],
    defaultStoragePath: '/Users/test/Documents/NoteCove',
  };

  const createProps = (overrides: Partial<StepProps> = {}): StepProps => ({
    state: defaultState,
    onStateChange: jest.fn(),
    onNext: jest.fn(),
    onBack: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  });

  it('should render profile name input', () => {
    const props = createProps();
    render(<StepProfileName {...props} />);

    expect(screen.getByLabelText('Profile Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Personal, Work, Side Project')).toBeInTheDocument();
  });

  it('should show the title and subtitle', () => {
    const props = createProps();
    render(<StepProfileName {...props} />);

    expect(screen.getByText('Create New Profile')).toBeInTheDocument();
    expect(screen.getByText('Choose a name for your new profile')).toBeInTheDocument();
  });

  it('should call onStateChange when typing profile name', () => {
    const onStateChange = jest.fn();
    const props = createProps({ onStateChange });
    render(<StepProfileName {...props} />);

    const input = screen.getByLabelText('Profile Name');
    fireEvent.change(input, { target: { value: 'My Profile' } });

    expect(onStateChange).toHaveBeenCalledWith({ profileName: 'My Profile' });
  });

  it('should disable Next button when profile name is empty', () => {
    const props = createProps({ state: { ...defaultState, profileName: '' } });
    render(<StepProfileName {...props} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should disable Next button when profile name is only whitespace', () => {
    const props = createProps({ state: { ...defaultState, profileName: '   ' } });
    render(<StepProfileName {...props} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should enable Next button when profile name is valid', () => {
    const props = createProps({ state: { ...defaultState, profileName: 'Work' } });
    render(<StepProfileName {...props} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
  });

  it('should call onNext when Next button is clicked', () => {
    const onNext = jest.fn();
    const props = createProps({
      state: { ...defaultState, profileName: 'Work' },
      onNext,
    });
    render(<StepProfileName {...props} />);

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(onNext).toHaveBeenCalled();
  });

  it('should call onNext when form is submitted', () => {
    const onNext = jest.fn();
    const props = createProps({
      state: { ...defaultState, profileName: 'Work' },
      onNext,
    });
    const { container } = render(<StepProfileName {...props} />);

    const form = container.querySelector('form');
    fireEvent.submit(form!);

    expect(onNext).toHaveBeenCalled();
  });

  it('should not call onNext when form is submitted with empty name', () => {
    const onNext = jest.fn();
    const props = createProps({
      state: { ...defaultState, profileName: '' },
      onNext,
    });
    const { container } = render(<StepProfileName {...props} />);

    const form = container.querySelector('form');
    fireEvent.submit(form!);

    expect(onNext).not.toHaveBeenCalled();
  });

  it('should call onCancel when Cancel button is clicked', () => {
    const onCancel = jest.fn();
    const props = createProps({ onCancel });
    render(<StepProfileName {...props} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should show info box about profiles', () => {
    const props = createProps();
    render(<StepProfileName {...props} />);

    expect(
      screen.getByText(/Profiles let you keep different note collections separate/i)
    ).toBeInTheDocument();
  });
});
