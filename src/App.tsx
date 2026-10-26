import { type JSX, useEffect } from "react";
import { Shell } from "./components/Shell";
import { CareerScreen } from "./screens/CareerScreen";
import { ExtrasScreen } from "./screens/ExtrasScreen";
import { FaceOffScreen } from "./screens/FaceOffScreen";
import { GameplayScreen } from "./screens/GameplayScreen";
import { MainMenu } from "./screens/MainMenu";
import { PracticeScreen } from "./screens/PracticeScreen";
import { QuickplayScreen } from "./screens/QuickplayScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TutorialScreen } from "./screens/TutorialScreen";
import type { Route } from "./state/router";
import { routeTitle, useRoute } from "./state/router";

function Screen({ route }: { route: Route }): JSX.Element {
  switch (route.name) {
    case "menu":
      return <MainMenu />;
    case "career":
      return <CareerScreen />;
    case "quickplay":
      return <QuickplayScreen />;
    case "practice":
      return <PracticeScreen />;
    case "tutorial":
      return <TutorialScreen />;
    case "faceoff":
      return <FaceOffScreen />;
    case "settings":
      return <SettingsScreen />;
    case "extras":
      return <ExtrasScreen />;
    case "play":
      return route.mode === "faceoff" ? (
        <FaceOffScreen route={route} />
      ) : (
        <GameplayScreen route={route} />
      );
    case "results":
      return <ResultsScreen />;
    default:
      return <MainMenu />;
  }
}

export function App(): JSX.Element {
  const route = useRoute();
  const immersive = route.name === "play";
  useEffect(() => {
    document.title =
      route.name === "menu" ? "Air Guitar Hero" : `${routeTitle(route)} · Air Guitar Hero`;
  }, [route]);

  return (
    <Shell route={route} immersive={immersive}>
      <Screen route={route} />
    </Shell>
  );
}
