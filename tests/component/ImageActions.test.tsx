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

  it('renders desktop Download PNG button', () => {
    render(<ImageActions />);
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeInTheDocument();
  });

  it('renders desktop Download SVG button', () => {
    render(<ImageActions />);
    expect(screen.getByRole('button', { name: /Download SVG/i })).toBeInTheDocument();
  });

  it('renders Get share link buttons', () => {
    render(<ImageActions />);
    const buttons = screen.getAllByRole('button', { name: /share link/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders mobile Download button', () => {
    render(<ImageActions />);
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });
});
