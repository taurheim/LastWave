import { render, screen } from '@testing-library/react';
import StageLoadingBar from '@/components/StageLoadingBar';
import { useLastWaveStore } from '@/store/index';

describe('StageLoadingBar', () => {
  beforeEach(() => {
    useLastWaveStore.setState({
      stages: [],
      currentStage: -1,
    });
  });

  it('renders nothing when no stages are set', () => {
    const { container } = render(<StageLoadingBar />);
    expect(container.innerHTML).toBe('');
  });

  it('shows stage name when a stage is active', () => {
    useLastWaveStore.setState({
      stages: [
        { stageName: 'Getting data...', stageWeight: 80, stageSegments: 10, currentSegment: 3 },
      ],
      currentStage: 0,
    });

    render(<StageLoadingBar />);
    expect(screen.getByText(/Getting data\.\.\./)).toBeInTheDocument();
  });

  it('shows progress as currentSegment / stageSegments', () => {
    useLastWaveStore.setState({
      stages: [
        { stageName: 'Getting data...', stageWeight: 80, stageSegments: 10, currentSegment: 3 },
      ],
      currentStage: 0,
    });

    render(<StageLoadingBar />);
    expect(screen.getByText(/3 \/ 10/)).toBeInTheDocument();
  });
});
