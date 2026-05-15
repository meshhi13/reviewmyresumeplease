type ZoomControlProps = {
  value: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  className?: string;
};

export function ZoomControl({ value, onZoomOut, onZoomIn, className }: ZoomControlProps) {
  return (
    <div className={`zoom-control${className ? ` ${className}` : ""}`} aria-label="Zoom controls">
      <button aria-label="Zoom out" onClick={onZoomOut}>−</button>
      <span>{Math.round(value * 100)}%</span>
      <button aria-label="Zoom in" onClick={onZoomIn}>+</button>
    </div>
  );
}