"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatSydneyPortalDateTime } from "../lib/portal-date-time";
import type { MachineCapacity } from "../lib/machine-capacity";
import { MobileWorkspaceNavigation } from "./components/workspace-navigation";

type DashboardMetric = {
  value: string | null;
  detail: string;
  loading: boolean;
};

type SessionResponse = { authenticated?: boolean; username?: string };
type QualityResponse = { events?: Array<{ status?: string; action?: string }>; error?: string };
type SkillsResponse = {
  people?: Array<{ id: string; name: string; department: string }>;
  records?: Array<{ personId: string; sopId: string; status: string }>;
  error?: string;
};
type SopResponse = {
  sops?: Array<{
    id: string;
    department: string;
    reviewDate: string;
    status: string;
    availableToAllDepartments?: boolean;
  }>;
  error?: string;
};
type TrainingResponse = {
  connected?: boolean;
  videos?: Array<{ ready?: boolean; created?: string | null }>;
  error?: string;
};
type MachineCapacityResponse = { machines?: MachineCapacity[]; refreshedAt?: string; error?: string };

const destinations = [
  {
    title: "Quality Hub",
    subtitle: "Audits, events and improvements",
    href: "/quality",
    tone: "red",
    icon: "✓",
  },
  {
    title: "Training Records",
    subtitle: "View progress and compliance",
    href: "/vivadocs?view=skills",
    tone: "blue",
    icon: "◎",
  },
  {
    title: "SOP Library",
    subtitle: "Find controlled procedures",
    href: "/vivadocs?view=library",
    tone: "green",
    icon: "▤",
  },
  {
    title: "Training Videos",
    subtitle: "Watch and learn",
    href: "/training",
    tone: "charcoal",
    icon: "▷",
  },
] as const;

const initialMetric: DashboardMetric = { value: null, detail: "Loading", loading: true };

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "This dashboard information is unavailable.");
  return payload;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "VS";
}

function metricFromError(): DashboardMetric {
  return { value: null, detail: "Unavailable", loading: false };
}

function MachineCapacityChart({ machines }: { machines: MachineCapacity[] }) {
  const width = 300;
  const height = 170;
  const left = 27;
  const right = 8;
  const top = 13;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const clusterWidth = chartWidth / machines.length;
  const barWidth = Math.min(19, clusterWidth * 0.66);
  const bars = machines.map((machine, index) => ({
    ...machine,
    x: left + index * clusterWidth + (clusterWidth - barWidth) / 2,
    y: top + (100 - machine.capacity) / 100 * chartHeight,
  }));

  return (
    <div className="portal-capacity-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="capacity-chart-title capacity-chart-description">
        <title id="capacity-chart-title">Machine capability percentages</title>
        <desc id="capacity-chart-description">A clustered bar chart showing the current percentage capability for every machine in the linked Google Sheet.</desc>
        {[0, 50, 100].map((value) => {
          const y = top + (100 - value) / 100 * chartHeight;
          return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} className="capacity-gridline" /><text x={left - 5} y={y + 3} textAnchor="end" className="capacity-axis-label">{value}%</text></g>;
        })}
        {bars.map((bar) => (
          <g key={bar.machine}>
            <rect x={bar.x} y={bar.y} width={barWidth} height={top + chartHeight - bar.y} rx="2" className="capacity-bar" />
            <text x={bar.x + barWidth / 2} y={Math.max(9, bar.y - 6)} textAnchor="middle" className="capacity-value">{bar.capacity}%</text>
            <text x={bar.x + barWidth / 2} y={height - 25} textAnchor="end" transform={`rotate(-42 ${bar.x + barWidth / 2} ${height - 25})`} className="capacity-machine-label">{bar.machine.length > 9 ? `${bar.machine.slice(0, 8)}…` : bar.machine}</text>
          </g>
        ))}
      </svg>
      <ul aria-label="Machine capability values">
        {machines.map((machine) => <li key={machine.machine}><span>{machine.machine}</span><strong>{machine.capacity}%</strong></li>)}
      </ul>
    </div>
  );
}

export default function HomePage() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [username, setUsername] = useState("Signed-in user");
  const [metrics, setMetrics] = useState<Record<string, DashboardMetric>>({
    compliance: initialMetric,
    reviews: initialMetric,
    quality: initialMetric,
    videos: initialMetric,
  });
  const [machineCapacities, setMachineCapacities] = useState<MachineCapacity[]>([]);
  const [machineCapacityStatus, setMachineCapacityStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    updateTime();
    const timer = window.setInterval(updateTime, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let current = true;

    async function loadDashboard() {
      const [sessionResult, qualityResult, skillsResult, sopResult, trainingResult, machineCapacityResult] =
        await Promise.allSettled([
          requestJson<SessionResponse>("/api/auth/session"),
          requestJson<QualityResponse>("/api/non-conformance"),
          requestJson<SkillsResponse>("/api/vivadocs/skills"),
          requestJson<SopResponse>("/api/vivadocs/sops"),
          requestJson<TrainingResponse>("/api/training/videos"),
          requestJson<MachineCapacityResponse>("/api/machine-capacity"),
        ]);

      if (!current) return;

      const session = sessionResult.status === "fulfilled" ? sessionResult.value : null;
      const quality = qualityResult.status === "fulfilled" ? qualityResult.value : null;
      const skills = skillsResult.status === "fulfilled" ? skillsResult.value : null;
      const sops = sopResult.status === "fulfilled" ? sopResult.value : null;
      const training = trainingResult.status === "fulfilled" ? trainingResult.value : null;
      const machineCapacity = machineCapacityResult.status === "fulfilled" ? machineCapacityResult.value : null;

      if (machineCapacity?.machines?.length) {
        setMachineCapacities(machineCapacity.machines);
        setMachineCapacityStatus("ready");
      } else {
        setMachineCapacityStatus("error");
      }

      const nextUsername = session?.username?.trim() || "Signed-in user";
      setUsername(nextUsername);

      let compliance = metricFromError();
      if (session && skills && sops) {
        const person = skills.people?.find(
          (item) => item.name.trim().toLowerCase() === nextUsername.toLowerCase(),
        );
        if (person) {
          const requiredSops = (sops.sops ?? []).filter(
            (sop) =>
              sop.status === "Published" &&
              (sop.availableToAllDepartments || sop.department === person.department),
          );
          const requiredIds = new Set(requiredSops.map((sop) => sop.id));
          const completedIds = new Set(
            (skills.records ?? [])
              .filter(
                (record) =>
                  record.personId === person.id &&
                  requiredIds.has(record.sopId) &&
                  (record.status === "Competent" || record.status === "Trainer"),
              )
              .map((record) => record.sopId),
          );
          const percentage = requiredSops.length
            ? Math.round((completedIds.size / requiredSops.length) * 100)
            : 0;
          compliance = {
            value: `${percentage}%`,
            detail: `${completedIds.size} of ${requiredSops.length} required`,
            loading: false,
          };
        }
      }

      let reviews = metricFromError();
      if (sops) {
        const today = Date.now();
        const count = (sops.sops ?? []).filter((sop) => {
          const reviewTime = sop.reviewDate ? Date.parse(sop.reviewDate) : Number.NaN;
          return sop.status === "Published" && Number.isFinite(reviewTime) && reviewTime <= today;
        }).length;
        reviews = { value: String(count), detail: "Published SOPs due", loading: false };
      }

      let qualityActions = metricFromError();
      if (quality) {
        const count = (quality.events ?? []).filter(
          (event) => event.action?.trim() && event.status !== "Completed",
        ).length;
        qualityActions = { value: String(count), detail: "Unresolved actions", loading: false };
      }

      let newVideos = metricFromError();
      if (training?.connected) {
        // The existing Quality dashboard treats videos added in the last seven days as recent.
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const count = (training.videos ?? []).filter(
          (video) => video.ready && video.created && Date.parse(video.created) >= cutoff,
        ).length;
        newVideos = { value: String(count), detail: "Added in the last 7 days", loading: false };
      }

      setMetrics({
        compliance,
        reviews,
        quality: qualityActions,
        videos: newVideos,
      });
    }

    void loadDashboard();
    return () => {
      current = false;
    };
  }, []);

  const dashboardCards = [
    { key: "compliance", label: "Training compliance", href: "/vivadocs?view=skills", tone: "green", icon: "↗" },
    { key: "reviews", label: "SOPs due for review", href: "/vivadocs?view=library", tone: "blue", icon: "▤" },
    { key: "quality", label: "Open quality actions", href: "/quality", tone: "red", icon: "!" },
    { key: "videos", label: "New training videos", href: "/training", tone: "charcoal", icon: "▷" },
  ] as const;

  return (
    <div className="portal-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/" aria-label="Vivad SPARK home">
          <img src="/vivad-logo.png" alt="Vivad SPARK — Hoshin, Continuous Improvement" />
        </Link>
        <MobileWorkspaceNavigation />
        <time className="portal-date-time" dateTime={currentTime?.toISOString()} title="Current date and time in Sydney">
          {currentTime ? formatSydneyPortalDateTime(currentTime) : ""}
        </time>
        <Link className="portal-profile" href="/hoshin-logout" aria-label={`Signed in as ${username}. Sign out`}>
          <span aria-hidden="true">{initials(username)}</span>
          <strong>{username}</strong>
          <i aria-hidden="true">⌄</i>
        </Link>
      </header>

      <main>
        <section className="portal-welcome" aria-labelledby="portal-title">
          <div className="portal-container">
            <div className="portal-spark-meaning" aria-label="SPARK means Skills, Performance, Action, Results and Knowledge">
              <strong>SPARK</strong>
              <span>Skills <i aria-hidden="true">•</i> Performance <i aria-hidden="true">•</i> Action <i aria-hidden="true">•</i> Results <i aria-hidden="true">•</i> Knowledge</span>
            </div>
            <h1 id="portal-title">Where would you like to go?</h1>
            <p>Access your quality systems, training and controlled documents in one place.</p>
            <nav className="portal-destinations" aria-label="Vivad SPARK destinations">
              {destinations.map((destination) => (
                <Link className={`portal-destination ${destination.tone}`} href={destination.href} key={destination.title}>
                  <span className="portal-destination-icon" aria-hidden="true">{destination.icon}</span>
                  <span><strong>{destination.title}</strong><small>{destination.subtitle}</small></span>
                  <b aria-hidden="true">›</b>
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <section className="portal-dashboard" aria-labelledby="dashboard-title">
          <div className="portal-container portal-dashboard-grid">
            <div>
              <h2 id="dashboard-title">Your dashboard</h2>
              <div className="portal-metrics">
                {dashboardCards.map((card) => {
                  const metric = metrics[card.key];
                  const qrCard = card.key === "compliance"
                    ? {
                        src: "/vivad-purchasing-qr.png",
                        alt: "Vivad Purchasing QR code",
                        caption: "Scan this QR code to open the Vivad Purchasing workflow.",
                        width: 375,
                        height: 352,
                      }
                    : card.key === "reviews"
                      ? {
                          src: "/toolbox-talk-qr.png",
                          alt: "Toolbox Talk Minutes QR code",
                          caption: "Scan this QR code to open Toolbox Talk Minutes.",
                          width: 253,
                          height: 350,
                        }
                      : null;
                  if (qrCard) {
                    return (
                      <figure className="portal-metric portal-qr-metric" key={card.key}>
                        {/* Preserve the source QR pixels; image optimisation can soften scanner edges. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrCard.src}
                          alt={qrCard.alt}
                          width={qrCard.width}
                          height={qrCard.height}
                        />
                        <figcaption className="sr-only">
                          {qrCard.caption}
                        </figcaption>
                      </figure>
                    );
                  }
                  return (
                    <Link className={`portal-metric ${card.tone}`} href={card.href} key={card.key}>
                      <span aria-hidden="true">{card.icon}</span>
                      <span><small>{card.label}</small>
                        {metric.loading ? (
                          <i className="portal-metric-skeleton" role="status" aria-label={`Loading ${card.label}`} />
                        ) : (
                          <strong>{metric.value ?? "—"}</strong>
                        )}
                        <em>{metric.detail}</em>
                      </span>
                    </Link>
                  );
                })}
              </div>

              <h2 className="portal-quick-heading">Quick actions</h2>
              <div className="portal-quick-actions">
                <Link className="portal-quick-action blue" href="/training?upload=1"><span aria-hidden="true">↑</span>Upload training evidence</Link>
                <Link className="portal-quick-action green" href="/vivadocs?view=library&focus=search"><span aria-hidden="true">⌕</span>Search all documents</Link>
              </div>
            </div>

            <aside className="portal-support" aria-labelledby="support-title">
              <span>VIVAD SPARK</span>
              <h2 id="support-title">Our area capabilities</h2>
              <p className="portal-capacity-heading">Live machine capability</p>
              {machineCapacityStatus === "loading" && <div className="portal-capacity-loading" role="status">Loading machine capability…</div>}
              {machineCapacityStatus === "error" && <p className="portal-capacity-error" role="alert">Machine capability data is temporarily unavailable.</p>}
              {machineCapacityStatus === "ready" && <MachineCapacityChart machines={machineCapacities} />}
              <Link href="/strategy">Open strategy workspace <b aria-hidden="true">›</b></Link>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
