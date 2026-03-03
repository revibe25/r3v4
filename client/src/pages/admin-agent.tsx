import { useQuery } from "@tanstack/react-query";

export default function AdminAgentPage() {
  const { data } = useQuery({
    queryKey: ["tenantState"],
    queryFn: async () => {
      const res = await fetch("/api/tenant/state");
      return res.json();
    }
  });

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">
        AI Agent Dashboard
      </h1>

      <pre className="bg-card p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
