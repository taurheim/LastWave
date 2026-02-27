import { render, screen } from '@testing-library/react';
import { useLastWaveStore } from '@/store/index';
import LastWaveApp from '@/components/LastWaveApp';

// Mock child components to isolate LastWaveApp rendering logic
vi.mock('@/components/WaveOptions', () => ({
  default: () => <div data-testid="wave-options">WaveOptions</div>,
}));
vi.mock('@/components/StageLoadingBar', () => ({
  default: () => <div data-testid="stage-loading-bar">StageLoadingBar</div>,
}));
vi.mock('@/components/WaveVisualization', () => ({
  default: () => <div data-testid="wave-visualization">WaveVisualization</div>,
}));
vi.mock('@/components/ImageActions', () => ({
  default: () => <div data-testid="image-actions">ImageActions</div>,
}));
vi.mock('@/components/OptionActions', () => ({
  default: () => <div data-testid="option-actions">OptionActions</div>,
}));

describe('LastWaveApp', () => {
  beforeEach(() => {
    useLastWaveStore.setState({
      showOptions: true,
      showLoadingBar: false,
      showActions: false,
      showVisualization: false,
      rendererOptions: {},
      dataSourceOptions: {},
      stages: [],
      currentStage: -1,
    });
  });

  it('renders the options form when showOptions is true', () => {
    render(<LastWaveApp />);
    expect(screen.getByTestId('wave-options')).toBeInTheDocument();
  });

  it('does not render options form when showOptions is false', () => {
    useLastWaveStore.setState({ showOptions: false });
    render(<LastWaveApp />);
    expect(screen.queryByTestId('wave-options')).not.toBeInTheDocument();
  });

  it('contains the main container element', () => {
    const { container } = render(<LastWaveApp />);
    expect(container.querySelector('.text-center')).toBeInTheDocument();
  });
});
