import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/root-layout";
import { MobileLayout } from "./components/mobile-layout";
import { Dashboard } from "./components/pages/dashboard";
import { TasksPage } from "./components/pages/tasks-page";
import { HabitsPage } from "./components/pages/habits-page";
import { MoodPage } from "./components/pages/mood-page";
import { StatsPage } from "./components/pages/stats-page";
import { ProfilePage } from "./components/pages/profile-page";
import { NotificationsPage } from "./components/pages/notifications-page";
import { JournalPage } from "./components/pages/journal-page";
import { AnxietyPage } from "./components/pages/anxiety-page";
import { GroundingPage } from "./components/pages/grounding-page";
import { SOSPage } from "./components/pages/sos-page";
import { WorryPage } from "./components/pages/worry-page";
import { BingoPage } from "./components/pages/bingo-page";
import { SkillTreePage } from "./components/pages/skill-tree-page";
import { CognitiveDistortionsPage } from "./components/pages/cognitive-distortions-page";
import { ChallengePage } from "./components/pages/challenge-page";
import { SoundscapesPage } from "./components/pages/soundscapes-page";
import { PMRPage } from "./components/pages/pmr-page";
import { LifeWheelPage } from "./components/pages/life-wheel-page";
import { CapsulePage } from "./components/pages/capsule-page";
import { SleepPage } from "./components/pages/sleep-page";
import { MeditationPage } from "./components/pages/meditation-page";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        Component: MobileLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: "tasks", Component: TasksPage },
          { path: "habits", Component: HabitsPage },
          { path: "mood", Component: MoodPage },
          { path: "stats", Component: StatsPage },
          { path: "profile", Component: ProfilePage },
          { path: "notifications", Component: NotificationsPage },
          { path: "journal", Component: JournalPage },
          { path: "anxiety", Component: AnxietyPage },
          { path: "anxiety/grounding", Component: GroundingPage },
          { path: "sos", Component: SOSPage },
          { path: "worry", Component: WorryPage },
          { path: "bingo", Component: BingoPage },
          { path: "skills", Component: SkillTreePage },
          { path: "distortions", Component: CognitiveDistortionsPage },
          { path: "challenge", Component: ChallengePage },
          { path: "soundscapes", Component: SoundscapesPage },
          { path: "pmr", Component: PMRPage },
          { path: "lifewheel", Component: LifeWheelPage },
          { path: "capsule", Component: CapsulePage },
          { path: "sleep", Component: SleepPage },
          { path: "meditation", Component: MeditationPage },
        ],
      },
    ],
  },
]);