import { useQuery } from "@tanstack/react-query";

function StatCard({ title, value }: any) {
  return (
    <div className="bg-card p-4 rounded-lg">
      <div className="text-muted-foreground text-sm">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

export default function AgentDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["agentState"],
    queryFn: async () => {
      const res = await fetch("/agent/state?tenantId=tenant_1");
      return res.json();
    },
    refetchInterval: 2000
  });

  if (isLoading) return <div>Loading agent state...</div>;

  const state = data;

  return (
    <div className="p-6 text-white bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Agent Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="CPU Load"
          value={state.audioEngine.cpuLoad}
        />
        <StatCard
          title="Underruns"
          value={state.audioEngine.bufferUnderruns}
        />
        <StatCard
          title="Server Status"
          value={state.health.serverStatus}
        />
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Alerts</h2>
        {state.alerts.map((a: any, i: number) => (
          <div key={i} className="bg-red-900 p-2 mb-2 rounded">
            {a.message}
          </div>
        ))}
      </div>
    </div>
  );
}
