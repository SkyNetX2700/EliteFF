import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";

export default function HumanVerification() {
  const { setHumanVerified, appName, logoUrl } = useAppContext();
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleCheck() {
    if (checked || checking) return;
    setChecking(true);
    await new Promise(r => setTimeout(r, 1400));
    setChecked(true);
    await new Promise(r => setTimeout(r, 600));
    setHumanVerified(true);
  }

  return (
    <div
      className="min-h-dvh w-full flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #fff5f0 0%, #ffe8dc 100%)",
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(255,107,53,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,69,0,0.07) 0%, transparent 50%), linear-gradient(135deg, #fff5f0 0%, #ffe8dc 100%)",
      }}
    >
      {/* Main card */}
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "#ffffff", border: "1px solid rgba(255,107,53,0.15)" }}
      >
        {/* Red top accent */}
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, #ff6b35 0%, #ff2d00 100%)" }}
        />

        {/* Header */}
        <div className="p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 shadow-md ring-2 ring-orange-200">
            <img src={logoUrl} alt={`${appName} logo`} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-display font-black text-xl leading-none">
              <span style={{ color: "#ff6b35" }}>{appName.split(" ")[0]}</span>
              {appName.includes(" ") && (
                <span style={{ color: "#111827" }}> {appName.split(" ").slice(1).join(" ")}</span>
              )}
            </div>
            <div className="text-sm font-semibold mt-1" style={{ color: "#374151" }}>
              Security Verification
            </div>
            <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
              Please verify you are human
            </div>
          </div>
        </div>

        {/* Checkbox area */}
        <div className="px-6 pb-6">
          <button
            onClick={handleCheck}
            className="w-full rounded-2xl flex items-center justify-between px-4 py-3 transition-all duration-200 active:scale-98"
            style={{
              background: "#f9fafb",
              border: `2px solid ${checked ? "#22c55e" : "#d1d5db"}`,
              cursor: checked ? "default" : "pointer",
            }}
          >
            <div className="flex items-center gap-3">
              {/* Checkbox */}
              <div
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-all duration-300"
                style={{
                  background: checked ? "#22c55e" : "white",
                  border: `2px solid ${checked ? "#22c55e" : checking ? "#ff6b35" : "#d1d5db"}`,
                  borderTopColor: checking && !checked ? "transparent" : undefined,
                  animation: checking && !checked ? "spin 0.8s linear infinite" : undefined,
                }}
              >
                {checked && (
                  <svg viewBox="0 0 12 10" className="w-3.5 h-3.5">
                    <polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className="font-medium text-sm select-none"
                style={{ color: checked ? "#166534" : "#374151" }}
              >
                {checked
                  ? "✓ Verified! You're human"
                  : checking
                  ? "Verifying, please wait..."
                  : "I am not a robot"}
              </span>
            </div>
            {/* Badge */}
            <div className="flex flex-col items-center gap-0.5 ml-3 flex-shrink-0">
              <div className="w-8 h-8 rounded overflow-hidden">
                <img src={logoUrl} alt={`${appName} logo`} className="w-full h-full object-cover" />
              </div>
              <span className="text-xs font-black tracking-wider" style={{ color: "#ff4500", fontSize: "8px" }}>
                {appName}
              </span>
            </div>
          </button>

          {/* Footer */}
          <p className="text-center text-xs mt-4" style={{ color: "#9ca3af" }}>
             Protected by {appName} Shield •{" "}
            <span className="underline cursor-pointer" style={{ color: "#ff6b35" }}>Privacy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
