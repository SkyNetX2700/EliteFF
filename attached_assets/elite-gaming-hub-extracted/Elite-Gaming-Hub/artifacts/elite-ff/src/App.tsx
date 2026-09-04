import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider, useAppContext } from "@/contexts/AppContext";

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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function AppInner() {
  const { humanVerified } = useAppContext();

  if (!humanVerified) {
    return <HumanVerification />;
  }

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <div
        className="min-h-dvh flex flex-col max-w-md mx-auto relative"
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
            <Route path="/feedback" component={Feedback} />
            <Route component={NotFound} />
          </Switch>
        </main>

        <BottomNav />
      </div>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AuthProvider>
          <AppInner />
          <Toaster />
        </AuthProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
