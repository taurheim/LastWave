import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GalleryBrowser from '@/components/GalleryBrowser';

describe('GalleryBrowser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockResources = Array.from({ length: 15 }, (_, i) => ({
    public_id: `img${i}`,
    width: 2000,
    height: 550,
  }));

  function mockFetchSuccess(resources = mockResources) {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resources }),
    } as Response);
  }

  it('shows loading spinner before fetch resolves', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<GalleryBrowser />);
    expect(screen.getByTestId('gallery-spinner')).toBeInTheDocument();
  });

  it('renders image grid after loading', async () => {
    mockFetchSuccess();
    const { container } = render(<GalleryBrowser />);
    await waitFor(() => {
      const images = container.querySelectorAll('img[loading="lazy"]');
      expect(images.length).toBe(12); // IMAGES_PER_BATCH
    });
  });

  it('shows Load More button when more images exist', async () => {
    mockFetchSuccess();
    render(<GalleryBrowser />);
    await waitFor(() => {
      expect(screen.getByTestId('load-more')).toBeInTheDocument();
      expect(screen.getByText('Showing 12 of 15')).toBeInTheDocument();
    });
  });

  it('loads more images when Load More is clicked', async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    const { container } = render(<GalleryBrowser />);

    await waitFor(() => {
      expect(screen.getByTestId('load-more')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('load-more'));

    await waitFor(() => {
      const images = container.querySelectorAll('img[loading="lazy"]');
      expect(images.length).toBe(15); // all loaded
    });
  });

  it('hides Load More when all images are visible', async () => {
    mockFetchSuccess([
      { public_id: 'img1', width: 800, height: 600 },
      { public_id: 'img2', width: 800, height: 600 },
    ]);
    render(<GalleryBrowser />);
    await waitFor(() => {
      expect(screen.queryByTestId('load-more')).not.toBeInTheDocument();
      expect(screen.getByText('2 visualizations')).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.useFakeTimers();
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    render(<GalleryBrowser />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(screen.getByText(/Could not load gallery images/)).toBeInTheDocument();
    expect(screen.getByText(/niko@savas.ca/)).toBeInTheDocument();

    vi.useRealTimers();
  });
});
