interface ErrorBannerProps {
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Error banner — pixel-art styled.
 */
export function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div data-testid="error-banner" style={{ padding: '0 8px', marginBottom: 4 }}>
      <div style={{
        borderRadius: 6,
        border: '1px solid var(--accent-coral-dim)',
        background: 'rgba(192, 96, 80, 0.15)',
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ flex: 1, fontSize: 9, color: 'var(--accent-coral)' }}>{error}</div>
        <button
          type="button"
          onClick={onRetry}
          style={{
            flexShrink: 0,
            borderRadius: 4,
            backgroundColor: 'var(--accent-coral)',
            color: 'var(--text-bright)',
            fontSize: 7,
            padding: '3px 8px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-pixel)',
            letterSpacing: 1,
          }}
        >
          RETRY
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            flexShrink: 0,
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 7,
            padding: '3px 8px',
            cursor: 'pointer',
            fontFamily: 'var(--font-pixel)',
            letterSpacing: 1,
          }}
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}
