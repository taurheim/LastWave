import type { MeasureTextFn } from '@/core/wave/util';
import { findLabelIndices } from '@/core/wave/util';
import { findOptimalLabel } from '@/core/wave/bezierFit';
import Peak, { type StackPoint } from '@/core/models/Peak';

// Deterministic mock: width proportional to text length and font size
const mockMeasureText: MeasureTextFn = (text: string, _font: string, fontSize: number) => {
  const charWidth = fontSize * 0.6;
  const width = text.length * charWidth;
  const height = fontSize * 1.2;
  return { height, width, slope: height / width };
};

// Helper to build StackPoint arrays from [x, y, y0] tuples
const makeStack = (...points: [number, number, number][]): StackPoint[] =>
  points.map(([x, y, y0]) => ({ x, y, y0 }));

// -------------------------------------------------------------------
// findLabelIndices
// -------------------------------------------------------------------
describe('findLabelIndices', () => {
  it('returns peak indices (local maxima) from an array of counts', () => {
    const counts = [1, 5, 2, 8, 3, 6, 1];
    const indices = findLabelIndices(counts, 1);
    // Should find 3 (value 8) first, then 5 (value 6), then 1 (value 5)
    expect(indices).toContain(3);
    expect(indices).toContain(5);
  });

  it('respects minimum segments between labels', () => {
    const counts = [1, 5, 2, 8, 3, 6, 1];
    const indices = findLabelIndices(counts, 3);
    // With segmentsBetweenLabels=3, after picking index 3, indices 1-5 are removed
    expect(indices).toContain(3);
    // Index 5 is within 3 of index 3, so it should be excluded
    expect(indices).not.toContain(5);
  });

  it('returns empty for all-zero array', () => {
    const counts = [0, 0, 0, 0, 0];
    const indices = findLabelIndices(counts, 1);
    expect(indices).toEqual([]);
  });

  it('includes first and last index when they are maxima', () => {
    const counts = [100, 1, 1, 1, 100];
    const indices = findLabelIndices(counts, 1);
    expect(indices).toContain(0);
    expect(indices).toContain(4);
  });

  it('handles single-element array', () => {
    const indices = findLabelIndices([5], 1);
    expect(indices).toEqual([0]);
  });

  it('handles two-element array', () => {
    const indices = findLabelIndices([5, 10], 1);
    expect(indices).toEqual([1]);
  });
});

// -------------------------------------------------------------------
// findOptimalLabel - W type
// -------------------------------------------------------------------
describe('findOptimalLabel - W type', () => {
  it('returns a non-null Label with fontSize > 0 for a valid W2 peak', () => {
    // Large W2 mountain: both top AND bottom rise in the center
    const stack = makeStack(
      [0, 10, 40],     // topLeft=(0,50), bottomLeft=(0,40)
      [100, 300, 100],  // top=(100,400), bottom=(100,100)
      [200, 10, 40],    // topRight=(200,50), bottomRight=(200,40)
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
    expect(label!.text).toBe('Test');
  });

  it('returns a non-null Label for a valid W1 peak', () => {
    // Large W1 valley peak
    const stack = makeStack(
      [0, 400, 100],  // topLeft=(0,500), bottomLeft=(0,100)
      [100, 10, 50],   // top=(100,60), bottom=(100,50)
      [200, 400, 100], // topRight=(200,500), bottomRight=(200,100)
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Hi', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
  });

  it('returns null when peak is too small for text', () => {
    // Tiny W2 mountain peak - not enough vertical space
    const stack = makeStack(
      [0, 1, 100],
      [1, 2, 100],
      [2, 1, 100],
    );
    const peak = new Peak(1, stack);
    const label = findOptimalLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).toBeNull();
  });
});

// -------------------------------------------------------------------
// findOptimalLabel - X type
// -------------------------------------------------------------------
describe('findOptimalLabel - X type', () => {
  it('returns a non-null Label with fontSize > 0 for a valid X1 peak', () => {
    // Large descending X1 peak
    const stack = makeStack(
      [0, 200, 300],  // topLeft=(0,500), bottomLeft=(0,300)
      [100, 200, 150], // top=(100,350), bottom=(100,150)
      [200, 200, 0],   // topRight=(200,200), bottomRight=(200,0)
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
    expect(label!.text).toBe('Test');
  });

  it('returns a non-null Label for a valid X2 peak', () => {
    // Large ascending X2 peak with different top/bottom slopes
    const stack = makeStack(
      [0, 50, 50],    // topLeft=(0,100), bottomLeft=(0,50)
      [100, 200, 100], // top=(100,300), bottom=(100,100)
      [200, 200, 200], // topRight=(200,400), bottomRight=(200,200)
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
  });

  it('returns null when peak is too small for text', () => {
    // Tiny X1 peak - less than 1px between top and bottom
    const stack = makeStack(
      [0, 1, 100],
      [1, 1, 100],
      [2, 1, 100],
    );
    const peak = new Peak(1, stack);
    const label = findOptimalLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).toBeNull();
  });
});

// -------------------------------------------------------------------
// findOptimalLabel - Y type
// -------------------------------------------------------------------
describe('findOptimalLabel - Y type', () => {
  it('returns a non-null Label for a Y1 peak', () => {
    const stack = makeStack(
      [0, 10, 40],
      [100, 300, 50],
      [200, 10, 60],
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Hi', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
    expect(label!.text).toBe('Hi');
  });

  it('returns a non-null Label for a Y2 peak', () => {
    const stack = makeStack(
      [0, 10, 160],
      [100, 300, 50],
      [200, 10, 40],
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Hi', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
  });

  it('returns a non-null Label for a Y3 peak', () => {
    const stack = makeStack(
      [0, 300, 60],
      [100, 200, 50],
      [200, 150, 60],
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Hi', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
  });

  it('returns a non-null Label for a Y4 peak', () => {
    const stack = makeStack(
      [0, 150, 60],
      [100, 200, 50],
      [200, 300, 60],
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Hi', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// findOptimalLabel - Z type
// -------------------------------------------------------------------
describe('findOptimalLabel - Z type', () => {
  it('returns a non-null Label with fontSize > 0 for a valid Z peak', () => {
    // Large diamond Z peak
    const stack = makeStack(
      [0, 100, 200],   // topLeft=(0,300), bottomLeft=(0,200)
      [100, 400, 50],  // top=(100,450), bottom=(100,50)
      [200, 100, 200], // topRight=(200,300), bottomRight=(200,200)
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
    expect(label!.text).toBe('Test');
    expect(label!.font).toBe('Arial');
  });

  it('falls back to clamped sizing when intersections escape segment bounds', () => {
    // Use a realistically-sized peak so the fallback produces a viable label.
    const stack = makeStack(
      [0, 50, 450],
      [500, 120, 400],
      [1000, 50, 450],
    );
    const peak = new Peak(1, stack);

    const label = findOptimalLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
    expect(isFinite(label!.xPosition)).toBe(true);
    expect(isFinite(label!.yPosition)).toBe(true);
  });
});
