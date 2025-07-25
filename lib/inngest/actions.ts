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
  await redis.hmset(`workflow:${workflow.id}`, workflow);
};

export const toggleWorkflow = async (workflowId: string, enabled: boolean) => {
  const redis = await getRedisClient();
  await redis.hmset(`workflow:${workflowId}`, { enabled });
};
