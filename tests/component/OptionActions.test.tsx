import { render, screen, fireEvent } from '@testing-library/react';
import OptionActions from '@/components/OptionActions';
import { useLastWaveStore } from '@/store/index';

describe('OptionActions', () => {
  beforeEach(() => {
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
    render(<OptionActions />);
    expect(screen.getByRole('button', { name: /Modify options/i })).toBeInTheDocument();
  });

  it('renders Export options button', () => {
    render(<OptionActions />);
    expect(screen.getByRole('button', { name: /Export options/i })).toBeInTheDocument();
  });

  it('clicking Modify options resets the store', () => {
    render(<OptionActions />);
    fireEvent.click(screen.getByRole('button', { name: /Modify options/i }));

    const state = useLastWaveStore.getState();
    expect(state.showOptions).toBe(true);
    expect(state.showLoadingBar).toBe(false);
    expect(state.showActions).toBe(false);
    expect(state.showVisualization).toBe(false);
  });
});
