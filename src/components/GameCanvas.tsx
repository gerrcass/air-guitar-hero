import { type RefObject, useEffect, useRef } from "react";
import type { SongDefinition } from "../content/types";
import type { Chart, GameSnapshot } from "../game/types";
import type { RenderEffects } from "../render/effects";
import { HighwayRenderer } from "../render/highway";
import type { Settings } from "../state/settings";

interface GameCanvasProps {
  readonly chart: Chart;
  readonly song: SongDefinition;
  readonly settings: Settings;
  readonly effects: RenderEffects;
  readonly snapshotRef: RefObject<GameSnapshot | null>;
  readonly player: 1 | 2;
  readonly eliminated?: boolean;
  readonly label: string;
}

export function GameCanvas({
  chart,
  song,
  settings,
  effects,
  snapshotRef,
  player,
  eliminated = false,
  label,
}: GameCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshotGetter = useRef(snapshotRef);

  useEffect(() => {
    snapshotGetter.current = snapshotRef;
  }, [snapshotRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new HighwayRenderer(canvas);
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);
    let raf = 0;
    const loop = (): void => {
      const snapshot = snapshotGetter.current.current;
      if (snapshot) {
        renderer.render({
          chart,
          song,
          snapshot,
          settings,
          effects,
          player,
          eliminated,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [chart, song, settings, effects, player, eliminated]);

  return <canvas ref={canvasRef} className="highway-canvas" role="img" aria-label={label} />;
}
