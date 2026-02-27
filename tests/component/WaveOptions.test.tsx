import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WaveOptions from '@/components/WaveOptions';
import { useLastWaveStore } from '@/store/index';

describe('WaveOptions', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useLastWaveStore.setState({
      dataSourceOptions: {},
      rendererOptions: {},
    });
  });

  it('renders username input', () => {
    render(<WaveOptions onSubmit={mockOnSubmit} />);
    expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<WaveOptions onSubmit={mockOnSubmit} />);
    expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument();
  });

  it('renders date range selector', () => {
    render(<WaveOptions onSubmit={mockOnSubmit} />);
    expect(screen.getByText('Date range')).toBeInTheDocument();
  });

  it('shows advanced options when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<WaveOptions onSubmit={mockOnSubmit} />);

    expect(screen.queryByText('Data Source')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Advanced Options/ }));

    expect(screen.getByText('Data Source')).toBeInTheDocument();
    expect(screen.getByText('Renderer')).toBeInTheDocument();
  });

  it('calls onSubmit when form is submitted', async () => {
    const user = userEvent.setup();
    render(<WaveOptions onSubmit={mockOnSubmit} />);

    await user.click(screen.getByRole('button', { name: /Generate/i }));

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSourceOptions: expect.any(Object),
        rendererOptions: expect.any(Object),
      }),
    );
  });
});
