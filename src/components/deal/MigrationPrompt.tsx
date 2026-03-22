import { useState, useRef, useEffect } from 'react';

interface MigrationPromptProps {
  onMigrate: (action: 'general' | 'new-deal', dealName?: string) => void;
  onDismiss: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '5px 8px', fontSize: 9,
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 4, color: 'var(--text-primary)', outline: 'none', marginBottom: 6,
};

export function MigrationPrompt({ onMigrate, onDismiss }: MigrationPromptProps) {
  const [showNameInput, setShowNameInput] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (showNameInput) nameRef.current?.focus(); }, [showNameInput]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 340, backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--accent-gold)', borderRadius: 8,
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)', padding: 20,
      }}>
        <h2 style={{
          fontSize: 9, fontFamily: 'var(--font-pixel)', fontWeight: 700,
          color: 'var(--accent-gold)', marginBottom: 6, letterSpacing: 1,
        }}>
          LEGACY DATA FOUND
        </h2>
        <p style={{
          fontSize: 9, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5,
        }}>
          You have conversations from before Deal Rooms. Where should they go?
        </p>

        {!showNameInput ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => onMigrate('general')} style={{
              width: '100%', padding: '7px 0', fontSize: 8, fontFamily: 'var(--font-pixel)',
              backgroundColor: 'var(--accent-gold)', color: 'var(--bg-dark)',
              border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
            }}>
              ASSIGN TO GENERAL
            </button>
            <button onClick={() => setShowNameInput(true)} style={{
              width: '100%', padding: '7px 0', fontSize: 8, fontFamily: 'var(--font-pixel)',
              backgroundColor: 'transparent', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', letterSpacing: 1,
            }}>
              CREATE NEW DEAL
            </button>
            <button onClick={onDismiss} style={{
              fontSize: 7, fontFamily: 'var(--font-pixel)', color: 'var(--text-secondary)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              marginTop: 2, letterSpacing: 1,
            }}>
              DISMISS
            </button>
          </div>
        ) : (
          <div>
            <input ref={nameRef} type="text" style={inputStyle}
              placeholder="Deal name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nameRef.current?.value.trim()) onMigrate('new-deal', nameRef.current.value.trim());
                if (e.key === 'Escape') setShowNameInput(false);
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={!showNameInput} onClick={() => {
                const name = nameRef.current?.value.trim();
                if (name) onMigrate('new-deal', name);
              }} style={{
                flex: 1, padding: '5px 0', fontSize: 7, fontFamily: 'var(--font-pixel)',
                backgroundColor: 'var(--accent-gold)', color: 'var(--bg-dark)',
                border: 'none', borderRadius: 3, fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
              }}>
                CREATE
              </button>
              <button onClick={() => setShowNameInput(false)} style={{
                flex: 1, padding: '5px 0', fontSize: 7, fontFamily: 'var(--font-pixel)',
                color: 'var(--text-secondary)', background: 'transparent',
                border: 'none', cursor: 'pointer', letterSpacing: 1,
              }}>
                BACK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
