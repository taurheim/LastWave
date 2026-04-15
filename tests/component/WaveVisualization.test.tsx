import { render } from '@testing-library/react';
import WaveVisualization from '@/components/WaveVisualization';
import { useLastWaveStore } from '@/store/appStore';

describe('WaveVisualization', () => {
  beforeEach(() => {
    useLastWaveStore.setState({
      rendererOptions: { color_scheme: 'lastwave' },
      dataSourceOptions: {},
    });
  });

  it('renders an svg element', () => {
    const { container } = render(<WaveVisualization seriesData={[]} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders inside an svg-wrapper div', () => {
    const { container } = render(<WaveVisualization seriesData={[]} />);
    expect(container.querySelector('#svg-wrapper')).toBeInTheDocument();
  });
});
