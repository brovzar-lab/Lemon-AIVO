/**
 * Small inline badge — pixel-art styled.
 */
export function WarRoomBadge() {
  return (
    <span data-testid="war-room-badge" style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      padding: '1px 5px',
      borderRadius: 3,
      fontSize: 7,
      fontFamily: 'var(--font-pixel)',
      fontWeight: 600,
      letterSpacing: 1,
      backgroundColor: 'rgba(192, 160, 96, 0.15)',
      color: 'var(--accent-gold)',
      border: '1px solid rgba(192, 160, 96, 0.3)',
    }}>
      WAR ROOM
    </span>
  );
}
