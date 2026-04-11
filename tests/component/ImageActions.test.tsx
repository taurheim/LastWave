import { render, screen } from '@testing-library/react';
import ImageActions from '@/components/ImageActions';
import { useLastWaveStore } from '@/store/index';

describe('ImageActions', () => {
  beforeEach(() => {
    useLastWaveStore.setState({
      dataSourceOptions: {},
      rendererOptions: {},
    });
  });

  it('renders desktop Download button', () => {
    render(<ImageActions />);
    expect(screen.getAllByRole('button', { name: 'Download' }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders download options dropdown toggles', () => {
    render(<ImageActions />);
    const toggles = screen.getAllByRole('button', { name: 'Download options' });
    expect(toggles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders download and share buttons', () => {
    render(<ImageActions />);
    const downloads = screen.getAllByRole('button', { name: 'Download' });
    expect(downloads.length).toBeGreaterThanOrEqual(1);
    const shares = screen.getAllByRole('button', { name: /share/i });
    expect(shares.length).toBeGreaterThanOrEqual(1);
  });
});
