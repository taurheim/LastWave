import { render, screen, fireEvent } from '@testing-library/react';
import OptionActions from '@/components/OptionActions';
import { useLastWaveStore } from '@/store/index';

describe('OptionActions', () => {
  const mockToggleCustomize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useLastWaveStore.setState({
      dataSourceOptions: {},
      rendererOptions: {},
      showOptions: false,
      showLoadingBar: true,
      showActions: true,
      showVisualization: true,
    });
  });

  it('renders Modify options button', () => {
    render(<OptionActions onToggleCustomize={mockToggleCustomize} isCustomizeOpen={false} />);
    expect(screen.getByRole('button', { name: /Modify options/i })).toBeInTheDocument();
  });

  it('renders Customize button', () => {
    render(<OptionActions onToggleCustomize={mockToggleCustomize} isCustomizeOpen={false} />);
    expect(screen.getByRole('button', { name: /Customize/i })).toBeInTheDocument();
  });

  it('clicking Modify options resets the store', () => {
    render(<OptionActions onToggleCustomize={mockToggleCustomize} isCustomizeOpen={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Modify options/i }));

    const state = useLastWaveStore.getState();
    expect(state.showOptions).toBe(true);
    expect(state.showLoadingBar).toBe(false);
    expect(state.showActions).toBe(false);
    expect(state.showVisualization).toBe(false);
  });
});
