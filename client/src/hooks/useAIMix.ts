import { useMutation } from "@tanstack/react-query";

export function useAIMix() {
  return useMutation({
    mutationFn: async (data: {
      stems: string[];
      style: string;
    }) => {
      const res = await fetch("/api/ai/mix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("AI mix failed");
      }

      return res.json();
    },
  });
}
