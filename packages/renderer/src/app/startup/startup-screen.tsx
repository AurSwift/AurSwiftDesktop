import { STARTUP_PHASE_LABELS } from "./startup.constants";
import type { StartupState } from "./startup.types";

interface StartupScreenProps {
  state: StartupState;
}

function clampProgress(progress: number): number {
  return Math.min(100, Math.max(0, progress));
}

export function StartupScreen({ state }: StartupScreenProps) {
  const phaseLabel = STARTUP_PHASE_LABELS[state.phase];
  const progress = clampProgress(state.progress);
  const progressScale = progress / 100;
  const logoSrc = `${import.meta.env.BASE_URL}licenselogo.png`;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden select-none"
      role="status"
      aria-live="polite"
      aria-label="AuraSwift startup in progress"
      data-testid="startup-screen"
      style={{
        background:
          "radial-gradient(circle at 20% 15%, rgba(113, 201, 255, 0.22) 0%, transparent 46%), radial-gradient(circle at 82% 88%, rgba(120, 178, 255, 0.2) 0%, transparent 48%), linear-gradient(150deg, #1a73e8 0%, #3f95ff 48%, #62abff 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div
        className="pointer-events-none absolute -top-28 -left-28 h-72 w-72 rounded-full blur-3xl startup-orb-float"
        style={{ background: "rgba(255,255,255,0.25)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full blur-3xl startup-orb-float"
        style={{
          background: "rgba(109, 180, 255, 0.4)",
          animationDelay: "-1.8s",
        }}
      />

      <div className="relative z-10 flex h-full w-full items-center justify-center p-8">
        <div className="flex w-full max-w-md flex-col items-center">
          <img
            src={logoSrc}
            alt="AuraSwift logo"
            width={92}
            height={92}
            className="mb-8 rounded-full bg-white/85 p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
          />

          <div className="w-full">
            <div className="mb-2.5 flex items-center justify-between">
              <p
                className="text-base font-medium tracking-wide text-white/95"
                data-testid="startup-phase-label"
              >
                {phaseLabel}
              </p>
              <span className="text-sm font-semibold text-white/90">{progress}%</span>
            </div>

            <div
              className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/35"
              data-testid="startup-progress-track"
            >
              <div
                className="h-full w-full origin-left rounded-full bg-white/95"
                data-testid="startup-progress-fill"
                style={{
                  transform: `scaleX(${progressScale})`,
                  transition: "transform 280ms ease-out",
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-full bg-white/25 startup-progress-sweep"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>

      <style data-testid="startup-motion-styles">{`
        .startup-orb-float {
          animation: startup-orb-float 4s ease-in-out infinite alternate;
        }
        .startup-progress-sweep {
          transform: translate3d(-130%, 0, 0);
          animation: startup-progress-sweep 2.1s ease-in-out infinite;
        }
        @keyframes startup-orb-float {
          from { transform: translate3d(0, 0, 0); opacity: 0.6; }
          to { transform: translate3d(0, -10px, 0); opacity: 0.85; }
        }
        @keyframes startup-progress-sweep {
          from { transform: translate3d(-130%, 0, 0); opacity: 0.35; }
          to { transform: translate3d(130%, 0, 0); opacity: 0.65; }
        }
        @media (prefers-reduced-motion: reduce) {
          .startup-orb-float,
          .startup-progress-sweep {
            animation: none !important;
          }
          [data-testid="startup-progress-fill"] {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
