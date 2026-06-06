"use client";

import { useState, type FormEvent } from "react";
import { Lightbulb, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<boolean>;
}

export function ProjectDialog({ open, onOpenChange, onCreate }: ProjectDialogProps) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function submitProject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const projectName = name.trim();
    if (!projectName) {
      return;
    }
    setPending(true);
    const created = await onCreate(projectName);
    setPending(false);
    if (created) {
      setName("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[512px] p-4 sm:p-5">
        <form onSubmit={submitProject}>
          <DialogHeader className="mb-5 flex-row items-center justify-between pr-10">
            <DialogTitle className="text-lg">创建项目</DialogTitle>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="项目设置">
              <Settings className="h-4 w-4" />
            </Button>
            <DialogDescription className="sr-only">创建新的聊天项目。</DialogDescription>
          </DialogHeader>
          <label className="mb-2 block text-sm text-foreground" htmlFor="project-name">
            项目名称
          </label>
          <Input
            id="project-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="输入项目名称"
          />
          <div className="mt-4 flex gap-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
            <p>项目功能可将聊天、文件和自定义指令集中保存，便于持续工作。</p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={!name.trim() || pending} className="rounded-full px-5">
              {pending ? "正在创建..." : "创建项目"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
