import { useState, useRef } from "react";
import { ChevronRight, Settings2, MessageSquare, Mail, Shield, Star, X, Pencil, ImagePlus, RotateCcw, UserCircle2, Sun, Moon, Trophy } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import LoginSheet from "@/components/LoginSheet";

const FAIRPLAY_RULES = [
  "Follow tournament rules strictly as defined by the Host",
  "No use of hacks, cheats, or unauthorized software",
  "No abusive language or harassment towards other players",
  "Play with integrity and sportsmanship",
  "All decisions by tournament organizers are final",
  "Repeated violations may result in permanent ban from Elite FF tournaments",
  "Zero tolerance for cheating. All results are verified.",
  "Any violation will result in immediate disqualification",
];

export default function Settings() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { appName, logoUrl, setAppIdentity, theme, setTheme, whatsappUrl, instagramUrl, setSocialLinks } = useAppContext();
  const [loginOpen, setLoginOpen] = useState(false);
  const [fairPlayOpen, setFairPlayOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState(whatsappUrl);
  const [instagram, setInstagram] = useState(instagramUrl);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [updateConfirm, setUpdateConfirm] = useState(false);

  const [draftName, setDraftName] = useState(appName);
  const [draftLogoUrl, setDraftLogoUrl] = useState(logoUrl);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [identitySaved, setIdentitySaved] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  function openIdentity() {
    setDraftName(appName);
    setDraftLogoUrl(logoUrl);
    setLogoPreview(null);
    setIdentityError("");
    setIdentitySaved(false);
    setIdentityOpen(true);
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setIdentityError("Please select an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { setIdentityError("Image must be under 2 MB"); return; }
    setIdentityError("");
    setLogoLoading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setLogoPreview(result);
      setDraftLogoUrl(result);
      setLogoLoading(false);
    };
    reader.onerror = () => { setLogoLoading(false); setIdentityError("Failed to read image"); };
    reader.readAsDataURL(file);
  }

  function saveIdentity() {
    if (!draftName.trim()) { setIdentityError("App name cannot be empty"); return; }
    setAppIdentity(draftName.trim(), draftLogoUrl || logoUrl);
    setIdentityError("");
    setIdentitySaved(true);
    setTimeout(() => { setIdentitySaved(false); setIdentityOpen(false); }, 1200);
  }

  function resetIdentity() {
    setAppIdentity("ELITE FF", "/Elite_1777629983897.png");
    setDraftName("ELITE FF");
    setDraftLogoUrl("/Elite_1777629983897.png");
    setLogoPreview(null);
  }

  const isHost = user?.role === "host";
  function handleSaveLinks() {
    if (!whatsapp.trim() || !instagram.trim()) { setSaveError("Link cannot be empty."); return; }
    try { new URL(whatsapp); new URL(instagram); } catch { setSaveError("Please enter a valid URL."); return; }
    setUpdateConfirm(true);
  }

  function confirmSaveLinks() {
    setSocialLinks(whatsapp.trim(), instagram.trim());
    setSaveError("");
    setSaveSuccess(true);
    setUpdateConfirm(false);
    setLinksOpen(false);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  function Row({ icon: Icon, iconBg, iconColor, title, subtitle, onClick, right }: any) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 p-3 rounded-xl transition-smooth hover:bg-white/5 text-left"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-sm font-semibold text-foreground truncate">{title}</div>
          {subtitle && <div className="text-xs mt-0.5 break-words leading-snug" style={{ color: "var(--th-muted)" }}>{subtitle}</div>}
        </div>
        {right ?? <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />}
      </button>
    );
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-1 pb-4" data-testid="settings.page">
      <div className="font-display font-black text-3xl text-foreground mb-4">Settings</div>

      {/* Profile */}
      {user ? (
        <div
          className="rounded-2xl p-4 mb-4 flex flex-col gap-3"
          style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
            >
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-display font-black text-xl text-foreground leading-none">{user.username}</div>
              <div className="text-xs mt-1 font-bold" style={{ color: "#ff6b35" }}>
                {user.isHost ? "Host" : "Player"}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm font-semibold transition-smooth active:scale-95"
            style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.15)" }}
          >
            <UserCircle2 size={16} style={{ color: "#ff6b35" }} />
            <span className="text-foreground">My Profile</span>
            <ChevronRight size={14} className="ml-auto text-muted-foreground" />
          </button>
          <button
            onClick={logout}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-smooth flex items-center justify-center gap-2"
            style={{ background: "rgba(255,69,0,0.1)", color: "#ff4500", border: "1px solid rgba(255,69,0,0.2)" }}
          >
            Log out
          </button>
        </div>
      ) : (
        <div className="rounded-2xl p-4 mb-4 flex flex-col gap-2 text-center" style={{ background: "var(--th-card)" }}>
          <p className="text-sm" style={{ color: "var(--th-muted)" }}>Sign in to join tournaments</p>
          <button
            onClick={() => setLoginOpen(true)}
            className="w-full py-3 rounded-xl font-bold text-sm transition-smooth"
            style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
          >
            Log In / Sign Up
          </button>
        </div>
      )}

      {/* Appearance — visible to all users */}
      <div className="rounded-2xl mb-2" style={{ background: "var(--th-card)" }}>
        <div className="px-4 pt-4 pb-1">
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>
            Appearance
          </div>
        </div>
        <div className="px-3 pb-3 flex flex-col gap-1">
          <div className="w-full flex items-center gap-3 p-3 rounded-xl">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(251,191,36,0.12)" }}>
              {theme === "dark" ? <Moon size={18} style={{ color: "#fbbf24" }} /> : <Sun size={18} style={{ color: "#fbbf24" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">Theme</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--th-muted)" }}>{theme === "dark" ? "Dark mode" : "Light mode"}</div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setTheme("dark")}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-smooth active:scale-95"
                style={theme === "dark"
                  ? { background: "linear-gradient(135deg,#ff6b35,#ff4500)", color: "#0a0e27" }
                  : { background: "var(--th-border)", color: "var(--th-muted)" }}
              >
                <Moon size={12} /> Dark
              </button>
              <button
                onClick={() => setTheme("light")}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-smooth active:scale-95"
                style={theme === "light"
                  ? { background: "linear-gradient(135deg,#ff6b35,#ff4500)", color: "#0a0e27" }
                  : { background: "var(--th-border)", color: "var(--th-muted)" }}
              >
                <Sun size={12} /> Light
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rank & Leaderboard — visible to everyone */}
      <div className="rounded-2xl mb-2" style={{ background: "var(--th-card)" }}>
        <div className="px-4 pt-4 pb-1">
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>
            Rank & Leaderboard
          </div>
        </div>
        <div className="px-3 pb-3 flex flex-col gap-1">
          <Row icon={Trophy} iconBg="rgba(251,191,36,0.12)" iconColor="#fbbf24"
            title="Rank & Progression" subtitle={user ? `${user.rank ?? "Blaze"} · ${user.points ?? 0} pts` : "View all 10 ranks and point system"}
            onClick={() => setRankOpen(true)}
          />
          <Row icon={Trophy} iconBg="rgba(255,107,53,0.12)" iconColor="#ff6b35"
            title="Leaderboard" subtitle="Top 50 players ranked by points"
            onClick={() => navigate("/leaderboard")}
          />
        </div>
      </div>

      {/* Player quick links — logged-in non-host users */}
      {!isHost && user && (
        <div className="rounded-2xl mb-2" style={{ background: "var(--th-card)" }}>
          <div className="px-4 pt-4 pb-1">
            <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>
              Player
            </div>
          </div>
          <div className="px-3 pb-3 flex flex-col gap-1">
            <Row icon={Trophy} iconBg="rgba(255,107,53,0.12)" iconColor="#ff6b35"
              title="My Registered Tournaments" subtitle="View your registrations, slots and status"
              onClick={() => navigate("/tournaments?tab=my")}
            />
            <Row icon={Shield} iconBg="rgba(99,102,241,0.12)" iconColor="#818cf8"
              title="Fair Play Policy" subtitle="Rules you agree to when joining a tournament"
              onClick={() => setFairPlayOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Host-only links */}
      {isHost && (
        <div className="rounded-2xl mb-2" style={{ background: "var(--th-card)" }}>
          <div className="px-4 pt-4 pb-1">
            <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>
              Host Controls
            </div>
          </div>
          <div className="px-3 pb-3 flex flex-col gap-1">
            <Row icon={Settings2} iconBg="rgba(255,107,53,0.12)" iconColor="#ff6b35"
              title="Manage Tournaments" subtitle="Create, edit and manage all tournaments"
              onClick={() => navigate("/tournaments")}
              data-testid="settings.manage_tournaments.link"
            />
            <Row icon={MessageSquare} iconBg="rgba(34,197,94,0.12)" iconColor="#22c55e"
              title="Manage Links" subtitle="Update the WhatsApp and Instagram links"
              onClick={() => setLinksOpen(true)}
            />
            <Row icon={Pencil} iconBg="rgba(251,191,36,0.12)" iconColor="#fbbf24"
              title="App Identity" subtitle="Change the app name and logo"
              onClick={openIdentity}
              data-testid="settings.app_identity.row"
            />
            <Row icon={Settings2} iconBg="rgba(129,140,248,0.12)" iconColor="#818cf8"
              title="Advanced Settings" subtitle="Notifications, slot assignment, display options"
              onClick={() => navigate("/host-settings")}
              data-testid="settings.advanced_settings.link"
            />
          </div>
        </div>
      )}

      {/* App section */}
      <div className="rounded-2xl" style={{ background: "var(--th-card)" }}>
        <div className="px-4 pt-4 pb-1">
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>
            App
          </div>
        </div>
        <div className="px-3 pb-3 flex flex-col gap-1">
          <Row icon={Shield} iconBg="rgba(99,102,241,0.12)" iconColor="#818cf8"
            title="Fair Play Policy" subtitle="Elite FF is committed to fair and competitive gaming"
            onClick={() => setFairPlayOpen(true)}
            data-testid="settings.fair_play.row"
          />
          <Row icon={Star} iconBg="rgba(251,191,36,0.12)" iconColor="#fbbf24"
            title="Rate your experience" subtitle="Share suggestions and help us improve"
            onClick={() => navigate("/feedback")}
            data-testid="settings.feedback.link"
          />
          <Row icon={Mail} iconBg="rgba(255,107,53,0.12)" iconColor="#ff6b35"
            title="Contact Us" subtitle="Have a question? Reach us directly"
            onClick={() => setContactOpen(true)}
            data-testid="settings.contact_us.section"
          />
        </div>
      </div>

      {/* About */}
      <div className="rounded-2xl mt-2 p-4 text-center" style={{ background: "var(--th-card3)" }}>
        <div className="font-display font-black text-xl text-foreground mb-1">{appName}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--th-dim)" }}>App made by Mandar Patil</div>
      </div>

      {/* Modals */}
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />

      {/* Rank & Progression Modal */}
      {rankOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setRankOpen(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{ background: "var(--th-card)", border: "1px solid var(--th-border)", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="font-display font-black text-xl text-foreground">Rank & Progression</div>
                <button onClick={() => setRankOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-smooth">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Current rank card */}
              <div className="rounded-2xl p-4 mb-4 flex items-center gap-4" style={{ background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.15)" }}>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center font-display font-black text-xl" style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}>
                  {(user?.rank ?? "Blaze").slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-foreground">{user?.rank ?? "Blaze"}</div>
                  <div className="text-xs" style={{ color: "var(--th-muted)" }}>{user?.points ?? 0} pts · {(user?.prestigeStars ?? 0) > 0 ? `${user?.prestigeStars}⭐ prestige` : "No prestige stars"}</div>
                </div>
                {(user?.totalEarnings ?? 0) > 0 && (
                  <div className="text-right">
                    <div className="text-sm font-black" style={{ color: "#fbbf24" }}>₹{(user?.totalEarnings ?? 0).toLocaleString("en-IN")}</div>
                    <div className="text-[10px]" style={{ color: "var(--th-dim)" }}>earned</div>
                  </div>
                )}
              </div>

              {/* Point shift history */}
              {user?.pointShifts && (() => {
                try {
                  const shifts = JSON.parse(user.pointShifts);
                  if (!shifts.length) return null;
                  return (
                    <div className="mb-4">
                      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>Recent Point Shifts</div>
                      <div className="flex flex-col gap-1.5">
                        {shifts.slice(0, 10).map((s: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                            <span className={`text-xs font-black ${s.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {s.delta >= 0 ? "↑" : "↓"} {s.delta > 0 ? "+" : ""}{s.delta}
                            </span>
                            <span className="text-xs flex-1" style={{ color: "var(--th-muted)" }}>{s.reason}</span>
                            <span className="text-[10px]" style={{ color: "var(--th-dimmer)" }}>{new Date(s.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* Rank ladder */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>All Ranks</div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { name: "Blaze", emoji: "\ud83d\udd25", range: "0-149", color: "#ff6b35" },
                    { name: "Striker", emoji: "\u2694\ufe0f", range: "150-299", color: "#f59e0b" },
                    { name: "Predator", emoji: "\ud83d\udc3a", range: "300-499", color: "#dc2626" },
                    { name: "Phantom", emoji: "\ud83d\udc64", range: "500-749", color: "#818cf8" },
                    { name: "Nexus", emoji: "\u26a1", range: "750-999", color: "#a855f7" },
                    { name: "Nova", emoji: "\u2728", range: "1000-1249", color: "#ec4899" },
                    { name: "Supreme", emoji: "\ud83d\udc51", range: "1250-1499", color: "#fbbf24" },
                    { name: "Legend", emoji: "\u2b50", range: "1500-1699", color: "#f59e0b" },
                    { name: "Apex", emoji: "\ud83c\udfd4\ufe0f", range: "1700-1999", color: "#22c55e" },
                    { name: "Elite", emoji: "\ud83d\udc8e", range: "2000+", color: "#38bdf8" },
                  ].map(r => {
                    const isCurrent = (user?.rank ?? "Blaze") === r.name;
                    return (
                      <div key={r.name} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: isCurrent ? `${r.color}12` : "rgba(255,255,255,0.03)", border: isCurrent ? `1px solid ${r.color}40` : "1px solid transparent" }}>
                        <span className="text-sm">{r.emoji}</span>
                        <span className="text-xs font-bold flex-1" style={{ color: isCurrent ? r.color : "var(--th-muted)" }}>{r.name}</span>
                        <span className="text-[10px]" style={{ color: "var(--th-dimmer)" }}>{r.range}</span>
                        {isCurrent && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${r.color}20`, color: r.color }}>YOU</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Prestige info */}
              <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <div className="text-xs font-bold mb-1" style={{ color: "#fbbf24" }}>Elite Prestige Loop</div>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--th-muted)" }}>
                  Reach Elite (2000+ pts) to earn ₹500 + a prestige star. Your points reset to 0 so you can climb again. Apex (1700-1999) gives ₹300 on first reach.
                </p>
              </div>

              <button
                onClick={() => setRankOpen(false)}
                className="mt-5 w-full py-3 rounded-2xl font-display font-bold text-sm transition-smooth active:scale-95"
                style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fair Play Modal */}
      {fairPlayOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setFairPlayOpen(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{ background: "var(--th-card)", border: "1px solid var(--th-border)", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
            data-testid="fair_play_modal.dialog"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="font-display font-black text-xl text-foreground">Fair Play Policy</div>
                <button onClick={() => setFairPlayOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-smooth">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="flex flex-col gap-2 mb-4">
                {FAIRPLAY_RULES.map((rule, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                      style={{ background: "rgba(255,107,53,0.15)", color: "#ff6b35" }}>
                      {i + 1}
                    </div>
                    <span className="text-sm text-foreground leading-relaxed">{rule}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setFairPlayOpen(false)}
                className="mt-5 w-full py-3 rounded-2xl font-display font-bold text-sm transition-smooth active:scale-95"
                style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
                data-testid="fair_play_modal.confirm_button"
              >
                I understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {contactOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setContactOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: "var(--th-card)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-black text-xl text-foreground">Contact Us</div>
              <button onClick={() => setContactOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-smooth">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--th-muted)" }}>Have a question or need help? Reach us directly:</p>
            <div className="flex flex-col gap-2">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl font-semibold text-sm transition-smooth"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
                data-testid="settings.contact_whatsapp.link"
              >
                <MessageSquare size={16} /> WhatsApp Us
              </a>
              <a href="mailto:eliteff@gmail.com"
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl font-semibold text-sm transition-smooth"
                style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }}
                data-testid="settings.contact_gmail.link"
              >
                <Mail size={16} /> Email Us
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Manage Links Modal */}
      {linksOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setLinksOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl p-6 flex flex-col gap-4" style={{ background: "var(--th-card)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-display font-black text-xl text-foreground">Manage Links</div>
              <button onClick={() => setLinksOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--th-muted)" }}>
              Update the social links shown to players on the Home page.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">WhatsApp URL</label>
              <input
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="https://wa.me/..."
                className="w-full h-11 rounded-xl px-4 text-sm"
                style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
                data-testid="settings.whatsapp_link_input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Instagram URL</label>
              <input
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
                placeholder="https://instagram.com/..."
                className="w-full h-11 rounded-xl px-4 text-sm"
                style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
                data-testid="settings.instagram_link_input"
              />
            </div>
            {saveError && <p className="text-xs font-semibold" style={{ color: "#ff4500" }}>{saveError}</p>}
            {saveSuccess && <p className="text-xs text-green-400 font-semibold">Links updated!</p>}
            <button
              onClick={handleSaveLinks}
              className="w-full h-11 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm transition-smooth active:scale-95"
              style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
              data-testid="settings.save_links_button"
            >
              Save Links
            </button>
          </div>
        </div>
      )}

      {/* App Identity Modal */}
      {identityOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setIdentityOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300"
            style={{ background: "var(--th-card3)", border: "1px solid var(--th-border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 rounded-full mx-auto" style={{ background: "var(--th-border)" }} />
            <div className="flex items-center justify-between">
              <div className="font-display font-black text-2xl text-foreground">App Identity</div>
              <button onClick={() => setIdentityOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Logo preview + upload */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: "2px solid var(--th-border2)" }}>
                {logoLoading ? (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--th-card2)" }}>
                    <div className="w-7 h-7 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: "#ff6b35 transparent #ff6b35 #ff6b35" }} />
                  </div>
                ) : (
                  <img
                    src={logoPreview || draftLogoUrl}
                    alt="logo preview"
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = "/Elite_1777629983897.png"; }}
                  />
                )}
                {!logoLoading && (
                  <button
                    onClick={() => logoFileRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center transition-smooth"
                    style={{ background: "rgba(0,0,0,0.45)" }}
                  >
                    <ImagePlus size={22} style={{ color: "#ff6b35" }} />
                  </button>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <p className="text-xs font-semibold" style={{ color: "var(--th-muted)" }}>Tap the logo to upload a new image (max 2 MB)</p>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFile}
                />
                <button
                  onClick={() => logoFileRef.current?.click()}
                  className="h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-smooth active:scale-95"
                  style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }}
                >
                  <ImagePlus size={14} /> Upload Logo
                </button>
              </div>
            </div>

            {/* App name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">App Name</label>
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="e.g. ELITE FF"
                maxLength={24}
                className="w-full h-11 rounded-xl px-4 text-sm font-bold"
                style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
              />
            </div>

            {/* Logo URL (advanced) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Logo URL (optional override)</label>
              <input
                value={draftLogoUrl.startsWith("data:") ? "" : draftLogoUrl}
                onChange={e => { setDraftLogoUrl(e.target.value); setLogoPreview(null); }}
                placeholder="https://... or leave blank to use upload"
                className="w-full h-11 rounded-xl px-4 text-sm"
                style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
              />
            </div>

            {identityError && <p className="text-xs font-semibold" style={{ color: "#ff4500" }}>{identityError}</p>}
            {identitySaved && <p className="text-xs font-semibold text-green-400">Saved! App identity updated.</p>}

            <div className="flex gap-2">
              <button
                onClick={resetIdentity}
                className="h-11 px-4 rounded-xl font-semibold text-sm flex items-center gap-1.5 transition-smooth active:scale-95"
                style={{ background: "var(--th-border)", color: "var(--th-muted)" }}
                title="Reset to default"
              >
                <RotateCcw size={14} /> Reset
              </button>
              <button
                onClick={saveIdentity}
                className="flex-1 h-11 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-smooth active:scale-95"
                style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
              >
                Save Identity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Confirm */}
      {updateConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--th-card)" }}>
            <div className="font-display font-bold text-xl text-foreground">Update Links?</div>
            <p className="text-sm" style={{ color: "var(--th-muted)" }}>
              This will update the WhatsApp and Instagram links shown to all players on the Home page.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setUpdateConfirm(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>
                Cancel
              </button>
              <button onClick={confirmSaveLinks} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}>
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
