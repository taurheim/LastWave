import { render, screen, waitFor, act } from '@testing-library/react';
import GalleryBrowser from '@/components/GalleryBrowser';

describe('GalleryBrowser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pagination buttons', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resources: [] }),
    } as Response);

    render(<GalleryBrowser />);
    expect(screen.getByRole('button', { name: /Previous/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
  });

  it('shows page info text', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resources: [] }),
    } as Response);

    render(<GalleryBrowser />);
    expect(screen.getByText(/Page 1/)).toBeInTheDocument();
  });

  it('disables Previous Page on first page', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
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
      ok: true,
      json: () => Promise.resolve({ resources: mockResources }),
    } as Response);

    const { container } = render(<GalleryBrowser />);

    await waitFor(() => {
      const images = container.querySelectorAll('[style*="background-image"]');
      expect(images.length).toBe(2);
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.useFakeTimers();
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    render(<GalleryBrowser />);

    // Advance past retry delays (1s + 2s exponential backoff)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(screen.getByText(/Could not load gallery images/)).toBeInTheDocument();
    expect(screen.getByText(/niko@savas.ca/)).toBeInTheDocument();

    vi.useRealTimers();
  });
});
