// useTooltipVisible.ts
import { useState } from "react";

export const useTooltipVisible = () => {
  const [visibleId, setVisibleId] = useState<string | null>(null);

  const showTooltip = (id: string) => setVisibleId(id);
  const hideTooltip = () => setVisibleId(null);

  const isTooltipVisible = (id: string) => visibleId === id;

  return { showTooltip, hideTooltip, isTooltipVisible };
};
