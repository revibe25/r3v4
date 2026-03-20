import { useQuery } from "@tanstack/react-query";

function StatCard({ title, value }: any) {
  return (
    <div className="bg-card p-4 rounded-lg">
      <div className="text-muted-foreground text-sm">{title}</div>
      <div className="text-xl font-bold">{value ?? '—'}</div>
    </div>
  );
}

export default function AgentDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["agentState"],
    queryFn: async () => {
      const res = await fetch("/agent/state?tenantId=tenant_1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 2000
  });

  if (isLoading) return <div>Loading agent state...</div>;

  if (isError || !data) {
    return (
      <div className="p-6 text-white bg-background min-h-screen">
        <h1 className="text-2xl font-bold mb-6">Agent Dashboard</h1>
        <div className="bg-red-900 p-4 rounded">
          Unable to reach agent state endpoint. Retrying...
        </div>
      </div>
    );
  }

  const cpuLoad       = data?.audioEngine?.cpuLoad        ?? 'N/A';
  const bufferUnderruns = data?.audioEngine?.bufferUnderruns ?? 'N/A';
  const serverStatus  = data?.health?.serverStatus        ?? 'N/A';
  const alerts: any[] = Array.isArray(data?.alerts) ? data.alerts : [];

  return (
    <div className="p-6 text-white bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Agent Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="CPU Load"   value={cpuLoad} />
        <StatCard title="Underruns"  value={bufferUnderruns} />
        <StatCard title="Server Status" value={serverStatus} />
      </div>
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Alerts</h2>
        {alerts.length === 0 ? (
          <div className="text-muted-foreground text-sm">No alerts.</div>
        ) : (
          alerts.map((a: any, i: number) => (
            <div key={i} className="bg-red-900 p-2 mb-2 rounded">
              {a.message ?? JSON.stringify(a)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
