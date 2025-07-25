"use server";
import { inngest } from "@/lib/inngest/client";
import { getRedisClient } from "@/lib/redis/config";
import { type Workflow } from "@/lib/inngest/types";

// export const sendBlogPostToReview = async (id: string) => {
//   const supabase = createClient();
//   await supabase
//     .from("blog_posts")
//     .update({
//       status: "under review",
//       markdown_ai_revision: null,
//     })
//     .eq("id", id);

//   await inngest.send({
//     name: "blog-post.updated",
//     data: {
//       id,
//     },
//   });
// };

// export const approveBlogPostAiSuggestions = async (id: string) => {
//   await inngest.send({
//     name: "blog-post.approve-ai-suggestions",
//     data: {
//       id,
//     },
//   });
// };

// export const publishBlogPost = async (id: string) => {
//   const supabase = createClient();
//   await supabase
//     .from("blog_posts")
//     .update({
//       status: "published",
//       markdown_ai_revision: null,
//     })
//     .eq("id", id);

//   await inngest.send({
//     name: "blog-post.published",
//     data: {
//       id,
//     },
//   });
// };
export const updateWorkflow = async (workflow: Workflow) => {
  const redis = await getRedisClient();
  await redis.sadd("workflows", workflow.id);
    // 2) Prepare a flat record of strings for Redis
    const record: Record<string, string> = {
        id:            workflow.id,
        name:          workflow.name,
        description:   workflow.description ?? '',
        trigger:       workflow.trigger,
        enabled:       String(workflow.enabled),
        createdAt:     workflow.createdAt,
        workflow:      JSON.stringify(workflow.workflow),
      }
  await redis.hmset(`workflow:${workflow.id}`, record);
};

export const toggleWorkflow = async (workflowId: string, enabled: boolean) => {
  const redis = await getRedisClient();

  await redis.hmset(`workflow:${workflowId}`, { enabled: String(enabled) });
};
