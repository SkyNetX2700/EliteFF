import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import AuthPage from "@/components/AuthPage";

import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

import HumanVerification from "@/pages/HumanVerification";
import Home from "@/pages/Home";
import Tournaments from "@/pages/Tournaments";
import TournamentDetail from "@/pages/TournamentDetail";
import Results from "@/pages/Results";
import Alerts from "@/pages/Alerts";
import Settings from "@/pages/Settings";
import HostSettings from "@/pages/HostSettings";
import Feedback from "@/pages/Feedback";
import EditTournament from "@/pages/EditTournament";
import UploadResults from "@/pages/UploadResults";
import LiveScoreboard from "@/pages/LiveScoreboard";
import PaymentVerification from "@/pages/PaymentVerification";
import Profile from "@/pages/Profile";
import Leaderboard from "@/pages/Leaderboard";
import NotFound from "@/pages/not-found";
import SeoManager from "@/components/SeoManager";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function AppInner() {
  const { humanVerified } = useAppContext();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <WouterRouter base={basePath}>
      <Switch>
        <Route path="/sign-in/*?">
          <AuthPage kind="sign-in" basePath={basePath} />
        </Route>
        <Route path="/sign-up/*?">
          <AuthPage kind="sign-up" basePath={basePath} />
        </Route>
        <Route>
          {humanVerified ? <AppShell /> : <HumanVerification />}
        </Route>
      </Switch>
    </WouterRouter>
  );
}

function AppShell() {
  return (
    <>
      <SeoManager />
      <div
        className="min-h-dvh w-full max-w-md mx-auto flex flex-col relative overflow-x-hidden"
        style={{ background: "var(--th-bg)" }}
      >
        <Header />
        <main className="flex-1 overflow-y-auto pt-14 pb-20">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/tournaments" component={Tournaments} />
            <Route path="/tournaments/:id/edit" component={EditTournament} />
            <Route path="/tournaments/:id/results" component={UploadResults} />
            <Route path="/tournaments/:id/scoreboard" component={LiveScoreboard} />
            <Route path="/tournaments/:id/payments" component={PaymentVerification} />
            <Route path="/tournaments/:id" component={TournamentDetail} />
            <Route path="/results" component={Results} />
            <Route path="/alerts" component={Alerts} />
            <Route path="/settings" component={Settings} />
            <Route path="/host-settings" component={HostSettings} />
            <Route path="/profile" component={Profile} />
            <Route path="/leaderboard" component={Leaderboard} />
            <Route path="/feedback" component={Feedback} />
            <Route component={NotFound} />
          </Switch>
        </main>
        <BottomNav />
      </div>
    </>
  );
}

function App() {
  const appContent = (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AuthProvider>
          <AppInner />
          <Toaster />
        </AuthProvider>
      </AppProvider>
    </QueryClientProvider>
  );

  return appContent;
}

export default App;
