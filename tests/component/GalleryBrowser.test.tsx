import { render, screen, waitFor } from '@testing-library/react';
import GalleryBrowser from '@/components/GalleryBrowser';

describe('GalleryBrowser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pagination buttons', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ resources: [] }),
    } as Response);

    render(<GalleryBrowser />);
    expect(screen.getByRole('button', { name: /Previous/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
  });

  it('shows page info text', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ resources: [] }),
    } as Response);

    render(<GalleryBrowser />);
    expect(screen.getByText(/Page 1/)).toBeInTheDocument();
  });

  it('disables Previous Page on first page', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ resources: [] }),
    } as Response);

    render(<GalleryBrowser />);
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
  });

  it('renders images after fetch resolves', async () => {
    const mockResources = [
      { public_id: 'img1' },
      { public_id: 'img2' },
    ];

    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ resources: mockResources }),
    } as Response);

    const { container } = render(<GalleryBrowser />);

    await waitFor(() => {
      const images = container.querySelectorAll('[style*="background-image"]');
      expect(images.length).toBe(2);
    });
  });
});
