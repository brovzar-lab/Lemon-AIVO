import { TOKEN_LIMITS, DEFAULT_MODEL } from '@/services/context/tokenCounter';

interface TokenCounterProps {
  tokenCount: number;
  isSummarizing: boolean;
}

/**
 * Token usage bar — pixel-art styled.
 * Hidden until >60%. Amber 60-80%, coral >80%.
 */
export function TokenCounter({ tokenCount, isSummarizing }: TokenCounterProps) {
  const limit = TOKEN_LIMITS[DEFAULT_MODEL];
  const percentage = (tokenCount / limit) * 100;

  if (isSummarizing) {
    return (
      <div style={{ padding: '4px 8px' }}>
        <div style={{ height: 3, width: '100%', background: 'var(--bg-dark)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: 'var(--accent-gold)',
            borderRadius: 2,
            width: '100%',
            animation: 'livePulse 1.5s ease-in-out infinite',
          }} />
        </div>
        <div style={{
          fontSize: 7,
          color: 'var(--accent-gold)',
          textAlign: 'center',
          marginTop: 2,
          fontFamily: 'var(--font-pixel)',
          letterSpacing: 1,
          animation: 'livePulse 1.5s ease-in-out infinite',
        }}>
          SUMMARIZING...
        </div>
      </div>
    );
  }

  if (percentage < 60) return null;

  const barColor = percentage > 80 ? 'var(--accent-coral)' : 'var(--accent-gold)';

  return (
    <div
      style={{ padding: '4px 8px' }}
      title={`~${tokenCount.toLocaleString()} tokens (${percentage.toFixed(1)}%)`}
    >
      <div style={{ height: 3, width: '100%', background: 'var(--bg-dark)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          background: barColor,
          borderRadius: 2,
          width: `${Math.min(percentage, 100)}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}
