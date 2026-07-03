import { useRef } from 'react';

interface Props {
  value: number;
  side: 'left' | 'right';
  onChange: (px: number) => void;
}

// A thin draggable divider for resizing sidebars.
export default function ResizeHandle({ value, side, onChange }: Props) {
  const start = useRef({ x: 0, value: 0 });

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, value };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!(e.buttons & 1)) return;
    const dx = e.clientX - start.current.x;
    onChange(side === 'left' ? start.current.value + dx : start.current.value - dx);
  }
  function onPointerUp(e: React.PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="group relative z-10 w-1 shrink-0 cursor-col-resize"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line/40 transition group-hover:bg-accent group-hover:w-0.5" />
    </div>
  );
}
