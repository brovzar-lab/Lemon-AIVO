import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const GoodChild = () => <div>Working</div>;

describe('ErrorBoundary', () => {
  const originalError = console.error;
  beforeEach(() => { console.error = vi.fn(); });
  afterEach(() => { console.error = originalError; });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary name="test">
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Working')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    const ThrowingChild = () => { throw new Error('Test crash'); };
    render(
      <ErrorBoundary name="test-panel">
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/test-panel/i)).toBeInTheDocument();
  });

  it('resets error state when retry is clicked and child no longer throws', () => {
    let shouldThrow = true;
    const MaybeThrowingChild = () => {
      if (shouldThrow) throw new Error('Transient crash');
      return <div>Recovered</div>;
    };

    render(
      <ErrorBoundary name="test">
        <MaybeThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
