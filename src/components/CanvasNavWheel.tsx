import { useReactFlow } from "@xyflow/react";

const PAN_STEP = 170;
const ZOOM_STEP = 0.18;

type CanvasNavWheelProps = {
  isLocked: boolean;
  onToggleLock: () => void;
};

export function CanvasNavWheel({
  isLocked,
  onToggleLock
}: CanvasNavWheelProps) {
  const reactFlow = useReactFlow();

  function panBy(deltaX: number, deltaY: number) {
    if (isLocked) {
      return;
    }
    const viewport = reactFlow.getViewport();
    reactFlow.setViewport(
      {
        x: viewport.x + deltaX,
        y: viewport.y + deltaY,
        zoom: viewport.zoom
      },
      { duration: 140 }
    );
  }

  function zoomBy(delta: number) {
    if (isLocked) {
      return;
    }
    const viewport = reactFlow.getViewport();
    const nextZoom = Math.max(0.1, Math.min(1.5, viewport.zoom + delta));
    reactFlow.zoomTo(nextZoom, { duration: 120 });
  }

  return (
    <div className="nav-panel">
      <button
        type="button"
        className="nav-btn"
        onClick={() => zoomBy(-ZOOM_STEP)}
        title="Zoom out"
      >
        -
      </button>
      <button
        type="button"
        className="nav-btn"
        onClick={() => panBy(0, PAN_STEP)}
        title="Pan up"
      >
        ↑
      </button>{" "}
      <button
        type="button"
        className="nav-btn"
        onClick={() => zoomBy(ZOOM_STEP)}
        title="Zoom in"
      >
        +
      </button>{" "}
      <button
        type="button"
        className="nav-btn"
        onClick={() => reactFlow.fitView()}
        title="Fit view"
      >
        ⤢
      </button>
      <button
        type="button"
        className="nav-btn"
        onClick={() => panBy(PAN_STEP, 0)}
        title="Pan left"
      >
        ←
      </button>
      <button
        type="button"
        className="nav-btn"
        onClick={() => panBy(0, -PAN_STEP)}
        title="Pan down"
      >
        ↓
      </button>{" "}
      <button
        type="button"
        className="nav-btn"
        onClick={() => panBy(-PAN_STEP, 0)}
        title="Pan right"
      >
        →
      </button>
      <button
        type="button"
        className="nav-btn"
        onClick={onToggleLock}
        title={isLocked ? "Unlock canvas" : "Lock canvas"}
      >
        {isLocked ? "🔒" : "🔓"}
      </button>
    </div>
  );
}
