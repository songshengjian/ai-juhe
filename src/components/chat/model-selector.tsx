"use client";

import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";
import { MODEL_OPTIONS, type ModelId } from "@/types";

export function ModelSelector() {
  const selectedModel = useChatStore((state) => state.selectedModel);
  const selectModel = useChatStore((state) => state.selectModel);
  const selected = MODEL_OPTIONS.find((model) => model.id === selectedModel) ?? MODEL_OPTIONS[0];

  function chooseModel(modelId: ModelId): void {
    void selectModel(modelId);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 rounded-xl px-3 text-base font-medium transition-colors duration-150 ease-in-out hover:bg-accent data-[state=open]:bg-accent"
        >
          <span className="max-w-[220px] truncate">{selected?.label ?? "MiMo-V2.5"}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[260px] rounded-2xl border bg-popover/95 p-2 shadow-2xl backdrop-blur"
      >
        {MODEL_OPTIONS.map((model) => {
          const active = selectedModel === model.id;
          return (
            <DropdownMenuItem
              key={model.id}
              onSelect={() => chooseModel(model.id)}
              className={cn(
                "flex items-center justify-between rounded-xl p-3 text-sm font-medium transition-colors duration-150 ease-in-out",
                active && "bg-accent"
              )}
            >
              <span className="truncate">{model.label}</span>
              {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
