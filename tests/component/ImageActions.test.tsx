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

  it('renders Download SVG button', () => {
    render(<ImageActions />);
    expect(screen.getByRole('button', { name: 'Download SVG' })).toBeInTheDocument();
  });

  it('renders Download PNG button', () => {
    render(<ImageActions />);
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeInTheDocument();
  });

  it('renders Get image link button', () => {
    render(<ImageActions />);
    expect(screen.getByRole('button', { name: /share link/i })).toBeInTheDocument();
  });
});
