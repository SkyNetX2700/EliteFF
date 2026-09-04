import { useState } from "react";
import { Star, Send, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubmitFeedback } from "@workspace/api-client-react";

const STORAGE_KEY = "eliteff_feedbacks";

export default function Feedback() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.username || "");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const submitMutation = useSubmitFeedback();

  async function handleSubmit() {
    if (!name.trim() || !message.trim() || rating === 0) return;
    setLoading(true);
    await submitMutation.mutateAsync(
      { data: { name: name.trim(), message: message.trim(), rating } },
      {
        onError: () => {
          // fallback to localStorage on error
          const feedbacks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          feedbacks.unshift({ name: name.trim(), message: message.trim(), rating, timestamp: Date.now() });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(feedbacks));
        },
      }
    );
    setLoading(false);
    setSubmitted(true);
  }

  function reset() {
    setName(user?.username || "");
    setMessage("");
    setRating(0);
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className="px-4 py-4" data-testid="feedback.page">
        <div className="font-display font-black text-2xl text-foreground leading-tight mb-4">Feedback</div>
        <div
          className="rounded-2xl p-10 flex flex-col items-center text-center gap-4"
          style={{ background: "var(--th-card)" }}
          data-testid="feedback.success_state"
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.12)" }}>
            <span className="text-4xl">🏆</span>
          </div>
          <div>
            <div className="font-black text-foreground text-xl">Thank you, {name.trim()}!</div>
            <p className="text-sm mt-2 max-w-xs" style={{ color: "var(--th-muted)" }}>
              Your feedback helps us build a better battleground for everyone.
            </p>
          </div>
          <button
            onClick={reset}
            className="text-xs font-semibold px-4 py-2 rounded-xl transition-smooth"
            style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35" }}
            data-testid="feedback.reset_button"
          >
            <RotateCcw size={12} className="inline mr-1" /> Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4" data-testid="feedback.page">
      <div className="font-display font-black text-2xl text-foreground leading-tight mb-1">Feedback</div>
      <p className="text-sm mb-5" style={{ color: "var(--th-muted)" }}>
        Your feedback helps us improve
      </p>

      <div className="rounded-2xl p-5 flex flex-col gap-5" style={{ background: "var(--th-card)" }} data-testid="feedback.form">
        {/* Rating */}
        <div>
          <label className="text-sm font-bold text-foreground mb-3 block">Overall rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
                className="transition-smooth active:scale-90 p-0.5"
              >
                <Star
                  size={36}
                  fill={(hover || rating) >= star ? "#fbbf24" : "none"}
                  style={{ color: (hover || rating) >= star ? "#fbbf24" : "var(--th-border)" }}
                  className="w-9 h-9 transition-all duration-150"
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-xs font-semibold mt-2" style={{ color: "#fbbf24" }}>
              {["", "Poor", "Fair", "Good", "Great", "Champion!"][rating]}
            </p>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-bold text-foreground mb-2 block">Your name</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
            style={{
              background: "var(--th-card2)",
              border: "1px solid var(--th-border2)",
              color: "var(--th-text)",
              "--tw-ring-color": "#ff6b35",
            } as any}
            data-testid="feedback.name.input"
          />
        </div>

        {/* Message */}
        <div>
          <label className="text-sm font-bold text-foreground mb-2 block">Your message</label>
          <textarea
            placeholder="Rate your experience"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2"
            style={{
              background: "var(--th-card2)",
              border: "1px solid var(--th-border2)",
              color: "var(--th-text)",
              "--tw-ring-color": "#ff6b35",
            } as any}
            data-testid="feedback.message.textarea"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !name.trim() || !message.trim() || rating === 0}
          className="flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm transition-smooth disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)", color: "#0a0e27" }}
          data-testid="feedback.submit_button"
        >
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <><Send size={16} /> Send Feedback</>
          )}
        </button>
      </div>
    </div>
  );
}
