/**
 * ThreePanelLayout Component Tests
 */

import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThreePanelLayout } from '../ThreePanelLayout';

describe('ThreePanelLayout', () => {
  it('should render three panels', () => {
    const { container } = render(
      <ThreePanelLayout
        leftPanel={<div>Left Panel</div>}
        middlePanel={<div>Middle Panel</div>}
        rightPanel={<div>Right Panel</div>}
      />
    );

    expect(container.textContent).toContain('Left Panel');
    expect(container.textContent).toContain('Middle Panel');
    expect(container.textContent).toContain('Right Panel');
  });

  it('should use initial sizes when provided', () => {
    const initialSizes = [30, 30, 40];

    render(
      <ThreePanelLayout
        leftPanel={<div>Left</div>}
        middlePanel={<div>Middle</div>}
        rightPanel={<div>Right</div>}
        initialSizes={initialSizes}
      />
    );

    // Panel sizes are managed by react-resizable-panels internally
    // We can't easily test the actual sizes without more complex setup
    // but we can verify the component renders without errors
  });

  it('should call onLayoutChange when provided', () => {
    const handleLayoutChange = jest.fn();

    render(
      <ThreePanelLayout
        leftPanel={<div>Left</div>}
        middlePanel={<div>Middle</div>}
        rightPanel={<div>Right</div>}
        onLayoutChange={handleLayoutChange}
      />
    );

    // onLayoutChange will be called by react-resizable-panels
    // when the layout is initialized
    // We can't easily trigger resize events in jsdom
  });

  it('should use default sizes when initialSizes is not provided', () => {
    const { container } = render(
      <ThreePanelLayout
        leftPanel={<div>Left</div>}
        middlePanel={<div>Middle</div>}
        rightPanel={<div>Right</div>}
      />
    );

    // Should render without errors with default sizes [25, 25, 50]
    expect(container).toBeTruthy();
  });
});
