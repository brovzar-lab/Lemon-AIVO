import { useEffect, useState } from 'react';
import { useOfficeStore } from '@/store/officeStore';
import { ROOMS } from '@/engine/officeLayout';

export function RoomLabel() {
  const activeRoomId = useOfficeStore((s) => s.activeRoomId);
  const [visible, setVisible] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!activeRoomId) { setVisible(false); return; }
    const room = ROOMS.find((r) => r.id === activeRoomId);
    if (!room) { setVisible(false); return; }
    setDisplayName(room.name);
    requestAnimationFrame(() => setVisible(true));
  }, [activeRoomId]);

  if (!activeRoomId) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, pointerEvents: 'none',
      transition: 'opacity 0.3s', opacity: visible ? 1 : 0,
    }}>
      <div style={{
        padding: '5px 12px', borderRadius: 6,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontSize: 8, fontFamily: 'var(--font-pixel)',
        fontWeight: 600, letterSpacing: 1, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <RoomIcon roomId={activeRoomId} />
        <span>{displayName.toUpperCase()}</span>
      </div>
    </div>
  );
}

function RoomIcon({ roomId }: { roomId: string }) {
  const label = getRoomBadge(roomId);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 16, height: 16, borderRadius: 3,
      fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-pixel)',
      background: 'var(--bg-panel)', color: 'var(--text-secondary)',
    }}>
      {label}
    </span>
  );
}

function getRoomBadge(roomId: string): string {
  switch (roomId) {
    case 'billy': return 'B';
    case 'war-room': return 'W';
    case 'patrik': return 'D';
    case 'marcos': return 'M';
    case 'sandra': return 'S';
    case 'isaac': return 'R';
    case 'wendy': return 'V';
    default: return '?';
  }
}
