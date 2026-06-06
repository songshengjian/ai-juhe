import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { ChatShell } from "@/components/chat/chat-shell";
import { authOptions } from "@/lib/auth";
import type { CreationType } from "@/components/chat/generate-view";
import type { WorkspaceView } from "@/types";

const workspaceViews: WorkspaceView[] = ["home", "chat", "library", "apps", "audio", "generate", "canvas"];
const generationTypes: CreationType[] = ["agent", "image", "video", "avatar", "voice", "motion"];

type ChatPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  const params = searchParams ? await searchParams : {};
  const requestedView = firstParam(params.view);
  const requestedType = firstParam(params.type);
  const initialView = workspaceViews.includes(requestedView as WorkspaceView)
    ? (requestedView as WorkspaceView)
    : "home";
  const initialGenerationType = generationTypes.includes(requestedType as CreationType)
    ? (requestedType as CreationType)
    : "agent";

  return (
    <ChatShell
      userName={session.user.name ?? "用户"}
      userEmail={session.user.email ?? ""}
      initialView={initialView}
      initialGenerationType={initialGenerationType}
    />
  );
}
