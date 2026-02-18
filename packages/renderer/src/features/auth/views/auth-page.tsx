import { AuthUserSelection } from "@/features/auth/components";

/**
 * Full-screen auth page with light atmospheric background.
 * Renders the split-panel login UI edge-to-edge.
 */
export default function AuthPage() {
  return (
    <div
      data-testid="auth-page"
      className="relative h-screen w-screen overflow-hidden flex select-none"
      style={{
        fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
        background: "#E8EEF4",
        color: "#1e293b",
      }}
    >
      {/* ── Background atmosphere ── */}

      {/* Radial gradient canvas */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: [
            "radial-gradient(ellipse 80% 60% at 15% 85%, rgba(91,164,217,0.12) 0%, transparent 60%)",
            "radial-gradient(ellipse 60% 50% at 85% 10%, rgba(147,197,253,0.08) 0%, transparent 60%)",
            "radial-gradient(ellipse 100% 100% at 50% 50%, #F0F4F8 0%, #E2E8F0 100%)",
          ].join(", "),
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      {/* Floating orb 1 (sky blue) */}
      <div
        className="fixed rounded-full pointer-events-none z-0"
        style={{
          width: 500,
          height: 500,
          background: "rgba(91,164,217,0.08)",
          top: -100,
          right: -100,
          filter: "blur(80px)",
          animation: "drift 18s ease-in-out infinite alternate",
          animationDelay: "-5s",
        }}
      />

      {/* Floating orb 2 (light blue) */}
      <div
        className="fixed rounded-full pointer-events-none z-0"
        style={{
          width: 400,
          height: 400,
          background: "rgba(147,197,253,0.1)",
          bottom: -80,
          left: -80,
          filter: "blur(80px)",
          animation: "drift 18s ease-in-out infinite alternate",
          animationDelay: "-12s",
        }}
      />

      {/* ── Full-screen shell ── */}
      <div className="relative z-10 w-full h-full">
        <AuthUserSelection />
      </div>

      {/* ── Keyframe styles ── */}
      <style>{`
        @keyframes drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(40px, 30px) scale(1.08); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
