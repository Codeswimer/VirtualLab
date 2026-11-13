import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { SceneProps } from './types';
import {
  DisplacementScene,
  ForcesScene,
  InclineScene,
  MomentsScene,
} from './MechanicsScenes';
import { MeasureScene } from './MeasureScene';
import { OpticsScene } from './OpticsScene';
import { BridgeScene, CircuitScene } from './ElectricityScenes';
import { CoolingScene, GasScene, ThermalScene } from './ThermalScenes';
const PendulumScene = lazy(() => import('./PendulumScene'));
const SpringScene = lazy(() =>
  import('./SpringScene').then((module) => ({ default: module.SpringScene })),
);
const TitrationScene = lazy(() =>
  import('./TitrationScene').then((module) => ({ default: module.TitrationScene })),
);
const TubesScene = lazy(() =>
  import('./QualitativeScenes').then((module) => ({ default: module.TubesScene })),
);
const FoodScene = lazy(() =>
  import('./QualitativeScenes').then((module) => ({ default: module.FoodScene })),
);

function SceneLoading() {
  return (
    <div className="bench-dark flex h-[420px] items-center justify-center rounded-2xl">
      <div className="flex flex-col items-center gap-2 text-ink-200">
        <Loader2 className="h-6 w-6 animate-spin text-jade-400" />
        <p className="text-xs font-medium">Setting up the apparatus…</p>
      </div>
    </div>
  );
}

function LazyScene({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<SceneLoading />}>{children}</Suspense>;
}

export function SceneRenderer(props: SceneProps) {
  switch (props.experiment.scene) {
    case 'pendulum':
      return (
        <LazyScene>
          <PendulumScene {...props} />
        </LazyScene>
      );
    case 'spring':
      return (
        <LazyScene>
          <SpringScene {...props} />
        </LazyScene>
      );
    case 'moments':
      return <MomentsScene {...props} />;
    case 'displacement':
      return <DisplacementScene {...props} />;
    case 'forces':
      return <ForcesScene {...props} />;
    case 'incline':
      return <InclineScene {...props} />;
    case 'measure':
      return <MeasureScene {...props} />;
    case 'optics':
      return <OpticsScene {...props} />;
    case 'circuit':
      return <CircuitScene {...props} />;
    case 'bridge':
      return <BridgeScene {...props} />;
    case 'thermal':
      return <ThermalScene {...props} />;
    case 'cooling':
      return <CoolingScene {...props} />;
    case 'gas':
      return <GasScene {...props} />;
    case 'titration':
      return (
        <LazyScene>
          <TitrationScene {...props} />
        </LazyScene>
      );
    case 'tubes':
      return (
        <LazyScene>
          <TubesScene {...props} />
        </LazyScene>
      );
    case 'food':
      return (
        <LazyScene>
          <FoodScene {...props} />
        </LazyScene>
      );
    default:
      return null;
  }
}
