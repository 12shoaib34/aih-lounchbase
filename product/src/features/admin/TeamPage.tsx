"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { TeamPanel } from "./TeamPanel";
export function TeamPage() {
  const cache = useQueryClient();
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["admin", "team"] });
    },
    [cache],
  );
  return (
    <OwnerPage title="Team">
      {(userId) => <TeamPanel userId={userId} />}
    </OwnerPage>
  );
}
