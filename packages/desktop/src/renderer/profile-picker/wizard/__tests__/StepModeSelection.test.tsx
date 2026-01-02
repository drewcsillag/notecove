/**
 * StepModeSelection Tests
 *
 * Tests for the mode selection step component.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepModeSelection } from '../StepModeSelection';
import type { StepProps } from '../types';

describe('StepModeSelection', () => {
  const defaultState: StepProps['state'] = {
    profileName: 'Test Profile',
    mode: null,
    storagePath: null,
    cloudProvider: null,
    username: '',
    handle: '',
    availableCloudProviders: [],
    defaultStoragePath: '/Users/test/Documents/NoteCove',
  };

  const stateWithCloudProviders: StepProps['state'] = {
    ...defaultState,
    availableCloudProviders: [
      { name: 'iCloudDrive', path: '/Users/test/Library/Mobile Documents' },
      { name: 'Dropbox', path: '/Users/test/Dropbox' },
    ],
  };

  const createProps = (overrides: Partial<StepProps> = {}): StepProps => ({
    state: defaultState,
    onStateChange: jest.fn(),
    onNext: jest.fn(),
    onBack: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  });

  it('should render all four mode options', () => {
    const props = createProps();
    render(<StepModeSelection {...props} />);

    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('Cloud')).toBeInTheDocument();
    expect(screen.getByText('Paranoid')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('should show the title with profile name', () => {
    const props = createProps();
    render(<StepModeSelection {...props} />);

    expect(screen.getByText('Choose Profile Mode')).toBeInTheDocument();
    expect(screen.getByText(/Test Profile/)).toBeInTheDocument();
  });

  it('should show correct descriptions for each mode', () => {
    const props = createProps({ state: stateWithCloudProviders });
    render(<StepModeSelection {...props} />);

    // Local mode: "Store notes in the profile. Simple and private."
    expect(
      screen.getByText(/Store notes in the profile\. Simple and private\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Store notes in your cloud storage for automatic sync/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Maximum privacy mode/)).toBeInTheDocument();
    expect(screen.getByText(/Choose any folder on your computer/)).toBeInTheDocument();
  });

  it('should disable Cloud option when no cloud providers available', () => {
    const props = createProps({ state: defaultState }); // No cloud providers
    render(<StepModeSelection {...props} />);

    // The cloud card should show "No cloud storage detected" message
    expect(screen.getByText(/No cloud storage detected/)).toBeInTheDocument();
  });

  it('should enable Cloud option when cloud providers are available', () => {
    const props = createProps({ state: stateWithCloudProviders });
    render(<StepModeSelection {...props} />);

    // Should not show the unavailable message
    expect(screen.queryByText(/No cloud storage detected/)).not.toBeInTheDocument();
  });

  it('should call onStateChange when selecting a mode', () => {
    const onStateChange = jest.fn();
    const props = createProps({ onStateChange });
    render(<StepModeSelection {...props} />);

    const localCard = screen.getByText('Local').closest('div');
    fireEvent.click(localCard!);

    expect(onStateChange).toHaveBeenCalledWith({ mode: 'local' });
  });

  it('should call onStateChange when selecting Paranoid mode', () => {
    const onStateChange = jest.fn();
    const props = createProps({ onStateChange });
    render(<StepModeSelection {...props} />);

    const paranoidCard = screen.getByText('Paranoid').closest('div');
    fireEvent.click(paranoidCard!);

    expect(onStateChange).toHaveBeenCalledWith({ mode: 'paranoid' });
  });

  it('should NOT call onStateChange when clicking disabled Cloud option', () => {
    const onStateChange = jest.fn();
    const props = createProps({ state: defaultState, onStateChange }); // No cloud providers
    render(<StepModeSelection {...props} />);

    const cloudCard = screen.getByText('Cloud').closest('div');
    fireEvent.click(cloudCard!);

    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('should call onStateChange when clicking enabled Cloud option', () => {
    const onStateChange = jest.fn();
    const props = createProps({ state: stateWithCloudProviders, onStateChange });
    render(<StepModeSelection {...props} />);

    const cloudCard = screen.getByText('Cloud').closest('div');
    fireEvent.click(cloudCard!);

    expect(onStateChange).toHaveBeenCalledWith({ mode: 'cloud' });
  });

  it('should disable Next button when no mode is selected', () => {
    const props = createProps({ state: { ...defaultState, mode: null } });
    render(<StepModeSelection {...props} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should enable Next button when a mode is selected', () => {
    const props = createProps({ state: { ...defaultState, mode: 'local' } });
    render(<StepModeSelection {...props} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
  });

  it('should call onNext when Next button is clicked', () => {
    const onNext = jest.fn();
    const props = createProps({
      state: { ...defaultState, mode: 'local' },
      onNext,
    });
    render(<StepModeSelection {...props} />);

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(onNext).toHaveBeenCalled();
  });

  it('should call onBack when Back button is clicked', () => {
    const onBack = jest.fn();
    const props = createProps({ onBack });
    render(<StepModeSelection {...props} />);

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalled();
  });

  it('should call onCancel when Cancel button is clicked', () => {
    const onCancel = jest.fn();
    const props = createProps({ onCancel });
    render(<StepModeSelection {...props} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });
});
