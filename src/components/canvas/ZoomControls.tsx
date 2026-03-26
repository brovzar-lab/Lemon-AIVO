import { useOfficeStore } from '@/store/officeStore';
import { startAnimatedZoom, nearestHalf, MAX_ZOOM } from '@/engine/zoomController';
import { zoomState } from '@/engine/input';
import { computeAutoFitZoom } from '@/engine/camera';

export function ZoomControls() {
  const zoomLevel = useOfficeStore((s) => s.zoomLevel);
  const setZoomLevel = useOfficeStore((s) => s.setZoomLevel);
  const minZoom = computeAutoFitZoom(window.innerWidth, window.innerHeight);

  function handleZoomIn(): void {
    const target = Math.min(nearestHalf(zoomLevel) + 0.5, MAX_ZOOM);
    startAnimatedZoom(zoomState, target, window.innerWidth / 2, window.innerHeight / 2);
    setZoomLevel(target);
  }

  function handleZoomOut(): void {
    const target = Math.max(nearestHalf(zoomLevel) - 0.5, minZoom);
    startAnimatedZoom(zoomState, target, window.innerWidth / 2, window.innerHeight / 2);
    setZoomLevel(target);
  }

  const zoomInDisabled = nearestHalf(zoomLevel) + 0.5 > MAX_ZOOM;
  const zoomOutDisabled = nearestHalf(zoomLevel) - 0.5 < minZoom;

  const btnStyle: React.CSSProperties = {
    width: 22, height: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 3,
    background: 'rgba(20, 19, 42, 0.8)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-pixel)',
    cursor: 'pointer', transition: 'opacity 0.15s',
  };

  return (
    <div data-testid="zoom-controls" style={{
      position: 'absolute', bottom: 20, right: 20, zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <button
        type="button" onClick={handleZoomIn} disabled={zoomInDisabled}
        style={{ ...btnStyle, opacity: zoomInDisabled ? 0.2 : 0.5 }}
        aria-label="Zoom in" title="Zoom in (+/=)"
      >+</button>
      <button
        type="button" onClick={handleZoomOut} disabled={zoomOutDisabled}
        style={{ ...btnStyle, opacity: zoomOutDisabled ? 0.2 : 0.5 }}
        aria-label="Zoom out" title="Zoom out (-)"
      >-</button>
    </div>
  );
}
