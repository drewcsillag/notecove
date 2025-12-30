/**
 * StepUserSettings Tests
 *
 * Tests for the user settings step component.
 * This step collects optional username and handle.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepUserSettings } from '../StepUserSettings';
import type { StepProps } from '../types';

describe('StepUserSettings', () => {
  const defaultState: StepProps['state'] = {
    profileName: 'Test Profile',
    mode: 'local',
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

  it('should render username and handle inputs', () => {
    const props = createProps();
    render(<StepUserSettings {...props} />);

    expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Handle')).toBeInTheDocument();
  });

  it('should show the title and subtitle', () => {
    const props = createProps();
    render(<StepUserSettings {...props} />);

    expect(screen.getByText('Your Identity')).toBeInTheDocument();
    expect(screen.getByText(/Optional: Set a display name and handle/)).toBeInTheDocument();
  });

  it('should show placeholders', () => {
    const props = createProps();
    render(<StepUserSettings {...props} />);

    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('@username')).toBeInTheDocument();
  });

  it('should call onStateChange when typing username', () => {
    const onStateChange = jest.fn();
    const props = createProps({ onStateChange });
    render(<StepUserSettings {...props} />);

    const usernameInput = screen.getByLabelText('Display Name');
    fireEvent.change(usernameInput, { target: { value: 'John Doe' } });

    expect(onStateChange).toHaveBeenCalledWith({ username: 'John Doe' });
  });

  it('should call onStateChange when typing handle', () => {
    const onStateChange = jest.fn();
    const props = createProps({ onStateChange });
    render(<StepUserSettings {...props} />);

    const handleInput = screen.getByLabelText('Handle');
    fireEvent.change(handleInput, { target: { value: '@johndoe' } });

    expect(onStateChange).toHaveBeenCalledWith({ handle: '@johndoe' });
  });

  it('should show existing username value', () => {
    const props = createProps({ state: { ...defaultState, username: 'Existing User' } });
    render(<StepUserSettings {...props} />);

    const usernameInput = screen.getByLabelText<HTMLInputElement>('Display Name');
    expect(usernameInput.value).toBe('Existing User');
  });

  it('should show existing handle value', () => {
    const props = createProps({ state: { ...defaultState, handle: '@existing' } });
    render(<StepUserSettings {...props} />);

    const handleInput = screen.getByLabelText<HTMLInputElement>('Handle');
    expect(handleInput.value).toBe('@existing');
  });

  it('should always enable Next button (fields are optional)', () => {
    const props = createProps({ state: { ...defaultState, username: '', handle: '' } });
    render(<StepUserSettings {...props} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
  });

  it('should call onNext when Next button is clicked', () => {
    const onNext = jest.fn();
    const props = createProps({ onNext });
    render(<StepUserSettings {...props} />);

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(onNext).toHaveBeenCalled();
  });

  it('should call onNext when form is submitted', () => {
    const onNext = jest.fn();
    const props = createProps({ onNext });
    const { container } = render(<StepUserSettings {...props} />);

    const form = container.querySelector('form');
    fireEvent.submit(form!);

    expect(onNext).toHaveBeenCalled();
  });

  it('should call onBack when Back button is clicked', () => {
    const onBack = jest.fn();
    const props = createProps({ onBack });
    render(<StepUserSettings {...props} />);

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalled();
  });

  it('should call onCancel when Cancel button is clicked', () => {
    const onCancel = jest.fn();
    const props = createProps({ onCancel });
    render(<StepUserSettings {...props} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should show info box about optional fields', () => {
    const props = createProps();
    render(<StepUserSettings {...props} />);

    expect(
      screen.getByText(/These are used to personalize your notes and can be changed later/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/You can skip this step/i)).toBeInTheDocument();
  });
});
