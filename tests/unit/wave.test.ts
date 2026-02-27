import type { MeasureTextFn } from '@/core/wave/util';
import { findLabelIndices } from '@/core/wave/util';
import { isWType, getWLabel } from '@/core/wave/waveW';
import { isXType, getXLabel } from '@/core/wave/waveX';
import { isYType, getYLabel } from '@/core/wave/waveY';
import { isZType, getZLabel } from '@/core/wave/waveZ';
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

  it('does not include first or last index', () => {
    const counts = [100, 1, 1, 1, 100];
    const indices = findLabelIndices(counts, 1);
    expect(indices).not.toContain(0);
    expect(indices).not.toContain(4);
  });

  it('handles single-element array', () => {
    const indices = findLabelIndices([5], 1);
    expect(indices).toEqual([]);
  });

  it('handles two-element array', () => {
    const indices = findLabelIndices([5, 10], 1);
    expect(indices).toEqual([]);
  });
});

// -------------------------------------------------------------------
// isWType
// -------------------------------------------------------------------
describe('isWType', () => {
  it('detects W1 pattern (valley: A<=0, B>=0, C<0, D>0)', () => {
    // Valley shape: left and right higher than center
    const stack = makeStack(
      [0, 40, 60],  // topLeft=(0,100), bottomLeft=(0,60)
      [1, 10, 50],  // top=(1,60), bottom=(1,50)
      [2, 40, 60],  // topRight=(2,100), bottomRight=(2,60)
    );
    const peak = new Peak(1, stack);
    // A: slope=(60-100)/1 = -40, B: slope=(100-60)/1 = 40
    // C: slope=(50-60)/1 = -10, D: slope=(60-50)/1 = 10
    expect(isWType(peak)).toBe(true);
  });

  it('detects W2 pattern (mountain: A>0, B<0, C>0, D<0)', () => {
    const stack = makeStack(
      [0, 10, 40],  // topLeft=(0,50), bottomLeft=(0,40)
      [1, 100, 50], // top=(1,150), bottom=(1,50)
      [2, 10, 40],  // topRight=(2,50), bottomRight=(2,40)
    );
    const peak = new Peak(1, stack);
    // A: slope=(150-50)/1 = 100, B: slope=(50-150)/1 = -100
    // C: slope=(50-40)/1 = 10, D: slope=(40-50)/1 = -10
    expect(isWType(peak)).toBe(true);
  });

  it('returns false for non-W patterns', () => {
    // All slopes positive (X2 type)
    const stack = makeStack(
      [0, 60, 20],  // topLeft=(0,80), bottomLeft=(0,20)
      [1, 80, 50],  // top=(1,130), bottom=(1,50)
      [2, 100, 80], // topRight=(2,180), bottomRight=(2,80)
    );
    const peak = new Peak(1, stack);
    expect(isWType(peak)).toBe(false);
  });
});

// -------------------------------------------------------------------
// isXType
// -------------------------------------------------------------------
describe('isXType', () => {
  it('detects X1 pattern (all slopes <= 0, descending)', () => {
    const stack = makeStack(
      [0, 100, 80], // topLeft=(0,180), bottomLeft=(0,80)
      [1, 80, 50],  // top=(1,130), bottom=(1,50)
      [2, 60, 20],  // topRight=(2,80), bottomRight=(2,20)
    );
    const peak = new Peak(1, stack);
    // A: (130-180)/1=-50, B: (80-130)/1=-50, C: (50-80)/1=-30, D: (20-50)/1=-30
    expect(isXType(peak)).toBe(true);
  });

  it('detects X2 pattern (all slopes >= 0, ascending)', () => {
    const stack = makeStack(
      [0, 60, 20],  // topLeft=(0,80), bottomLeft=(0,20)
      [1, 80, 50],  // top=(1,130), bottom=(1,50)
      [2, 100, 80], // topRight=(2,180), bottomRight=(2,80)
    );
    const peak = new Peak(1, stack);
    // A: (130-80)/1=50, B: (180-130)/1=50, C: (50-20)/1=30, D: (80-50)/1=30
    expect(isXType(peak)).toBe(true);
  });

  it('returns false for non-X patterns', () => {
    // W1 pattern should not be X
    const stack = makeStack(
      [0, 40, 60],
      [1, 10, 50],
      [2, 40, 60],
    );
    const peak = new Peak(1, stack);
    expect(isXType(peak)).toBe(false);
  });
});

// -------------------------------------------------------------------
// isYType
// -------------------------------------------------------------------
describe('isYType', () => {
  it('detects Y1 pattern (A>0, B<0, C>0, D>=0)', () => {
    const stack = makeStack(
      [0, 10, 40],  // topLeft=(0,50), bottomLeft=(0,40)
      [1, 100, 50], // top=(1,150), bottom=(1,50)
      [2, 10, 60],  // topRight=(2,70), bottomRight=(2,60)
    );
    const peak = new Peak(1, stack);
    // A: (150-50)/1=100, B: (70-150)/1=-80, C: (50-40)/1=10, D: (60-50)/1=10
    expect(peak.A.slope).toBeGreaterThan(0);
    expect(peak.B.slope).toBeLessThan(0);
    expect(peak.C.slope).toBeGreaterThan(0);
    expect(peak.D.slope).toBeGreaterThanOrEqual(0);
    expect(isYType(peak)).toBe(true);
  });

  it('detects Y2 pattern (A>0, B<0, C<=0, D<0)', () => {
    const stack = makeStack(
      [0, 10, 60],  // topLeft=(0,70), bottomLeft=(0,60)
      [1, 100, 50], // top=(1,150), bottom=(1,50)
      [2, 10, 40],  // topRight=(2,50), bottomRight=(2,40)
    );
    const peak = new Peak(1, stack);
    // A: (150-70)/1=80, B: (50-150)/1=-100, C: (50-60)/1=-10, D: (40-50)/1=-10
    expect(peak.A.slope).toBeGreaterThan(0);
    expect(peak.B.slope).toBeLessThan(0);
    expect(peak.C.slope).toBeLessThanOrEqual(0);
    expect(peak.D.slope).toBeLessThan(0);
    expect(isYType(peak)).toBe(true);
  });

  it('detects Y3 pattern (A<0, B<=0, C<0, D>0)', () => {
    const stack = makeStack(
      [0, 100, 60], // topLeft=(0,160), bottomLeft=(0,60)
      [1, 80, 50],  // top=(1,130), bottom=(1,50)
      [2, 60, 60],  // topRight=(2,120), bottomRight=(2,60)
    );
    const peak = new Peak(1, stack);
    // A: (130-160)/1=-30, B: (120-130)/1=-10, C: (50-60)/1=-10, D: (60-50)/1=10
    expect(peak.A.slope).toBeLessThan(0);
    expect(peak.B.slope).toBeLessThanOrEqual(0);
    expect(peak.C.slope).toBeLessThan(0);
    expect(peak.D.slope).toBeGreaterThan(0);
    expect(isYType(peak)).toBe(true);
  });

  it('detects Y4 pattern (A>=0, B>0, C<0, D>0)', () => {
    const stack = makeStack(
      [0, 60, 60],  // topLeft=(0,120), bottomLeft=(0,60)
      [1, 80, 50],  // top=(1,130), bottom=(1,50)
      [2, 100, 60], // topRight=(2,160), bottomRight=(2,60)
    );
    const peak = new Peak(1, stack);
    // A: (130-120)/1=10, B: (160-130)/1=30, C: (50-60)/1=-10, D: (60-50)/1=10
    expect(peak.A.slope).toBeGreaterThanOrEqual(0);
    expect(peak.B.slope).toBeGreaterThan(0);
    expect(peak.C.slope).toBeLessThan(0);
    expect(peak.D.slope).toBeGreaterThan(0);
    expect(isYType(peak)).toBe(true);
  });

  it('returns false for non-Y patterns', () => {
    // Z-type diamond should not be Y
    const stack = makeStack(
      [0, 20, 80],
      [1, 100, 50],
      [2, 20, 80],
    );
    const peak = new Peak(1, stack);
    expect(isYType(peak)).toBe(false);
  });
});

// -------------------------------------------------------------------
// isZType
// -------------------------------------------------------------------
describe('isZType', () => {
  it('detects Z pattern (diamond: A>=0, B<=0, C<=0, D>=0)', () => {
    const stack = makeStack(
      [0, 20, 80],  // topLeft=(0,100), bottomLeft=(0,80)
      [1, 100, 50], // top=(1,150), bottom=(1,50)
      [2, 20, 80],  // topRight=(2,100), bottomRight=(2,80)
    );
    const peak = new Peak(1, stack);
    // A: (150-100)/1=50, B: (100-150)/1=-50, C: (50-80)/1=-30, D: (80-50)/1=30
    expect(peak.A.slope).toBeGreaterThanOrEqual(0);
    expect(peak.B.slope).toBeLessThanOrEqual(0);
    expect(peak.C.slope).toBeLessThanOrEqual(0);
    expect(peak.D.slope).toBeGreaterThanOrEqual(0);
    expect(isZType(peak)).toBe(true);
  });

  it('returns false for non-Z patterns', () => {
    // X2 ascending
    const stack = makeStack(
      [0, 60, 20],
      [1, 80, 50],
      [2, 100, 80],
    );
    const peak = new Peak(1, stack);
    expect(isZType(peak)).toBe(false);
  });
});

// -------------------------------------------------------------------
// getWLabel
// -------------------------------------------------------------------
describe('getWLabel', () => {
  it('returns a non-null Label with fontSize > 0 for a valid W2 peak', () => {
    // Large W2 mountain: both top AND bottom rise in the center
    const stack = makeStack(
      [0, 10, 40],     // topLeft=(0,50), bottomLeft=(0,40)
      [100, 300, 100],  // top=(100,400), bottom=(100,100)
      [200, 10, 40],    // topRight=(200,50), bottomRight=(200,40)
    );
    const peak = new Peak(1, stack);
    expect(isWType(peak)).toBe(true);

    const label = getWLabel(peak, 'Test', 'Arial', mockMeasureText);
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
    expect(isWType(peak)).toBe(true);

    const label = getWLabel(peak, 'Hi', 'Arial', mockMeasureText);
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
    const label = getWLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).toBeNull();
  });
});

// -------------------------------------------------------------------
// getXLabel
// -------------------------------------------------------------------
describe('getXLabel', () => {
  it('returns a non-null Label with fontSize > 0 for a valid X1 peak', () => {
    // Large descending X1 peak
    const stack = makeStack(
      [0, 200, 300],  // topLeft=(0,500), bottomLeft=(0,300)
      [100, 200, 150], // top=(100,350), bottom=(100,150)
      [200, 200, 0],   // topRight=(200,200), bottomRight=(200,0)
    );
    const peak = new Peak(1, stack);
    expect(isXType(peak)).toBe(true);

    const label = getXLabel(peak, 'Test', 'Arial', mockMeasureText);
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
    expect(isXType(peak)).toBe(true);

    const label = getXLabel(peak, 'Test', 'Arial', mockMeasureText);
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
    const label = getXLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).toBeNull();
  });
});

// -------------------------------------------------------------------
// getYLabel
// -------------------------------------------------------------------
describe('getYLabel', () => {
  it('returns a non-null Label for a Y1 peak', () => {
    const stack = makeStack(
      [0, 10, 40],
      [100, 300, 50],
      [200, 10, 60],
    );
    const peak = new Peak(1, stack);
    expect(isYType(peak)).toBe(true);

    const label = getYLabel(peak, 'Hi', 'Arial', mockMeasureText);
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
    expect(isYType(peak)).toBe(true);

    const label = getYLabel(peak, 'Hi', 'Arial', mockMeasureText);
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
    expect(isYType(peak)).toBe(true);

    const label = getYLabel(peak, 'Hi', 'Arial', mockMeasureText);
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
    expect(isYType(peak)).toBe(true);

    const label = getYLabel(peak, 'Hi', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// getZLabel
// -------------------------------------------------------------------
describe('getZLabel', () => {
  it('returns a non-null Label with fontSize > 0 for a valid Z peak', () => {
    // Large diamond Z peak
    const stack = makeStack(
      [0, 100, 200],   // topLeft=(0,300), bottomLeft=(0,200)
      [100, 400, 50],  // top=(100,450), bottom=(100,50)
      [200, 100, 200], // topRight=(200,300), bottomRight=(200,200)
    );
    const peak = new Peak(1, stack);
    expect(isZType(peak)).toBe(true);

    const label = getZLabel(peak, 'Test', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
    expect(label!.fontSize).toBeGreaterThan(0);
    expect(label!.text).toBe('Test');
    expect(label!.font).toBe('Arial');
  });

  it('returns a Label even for small Z peak (always returns a label)', () => {
    const stack = makeStack(
      [0, 5, 45],
      [1, 10, 40],
      [2, 5, 45],
    );
    const peak = new Peak(1, stack);
    expect(isZType(peak)).toBe(true);

    // getZLabel always computes a label (no early null return for small peaks)
    const label = getZLabel(peak, 'X', 'Arial', mockMeasureText);
    expect(label).not.toBeNull();
  });
});
