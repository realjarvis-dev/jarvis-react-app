import { type Workflow as InngestWorkflow } from "@inngest/workflow-kit";

export interface Workflow {
  /** your Redis key or UUID */
  id: string;
  /** human‑friendly name of this automation */
  name: string;
  /** optional description */
  description?: string;
  /** which Inngest event fires this workflow */
  trigger: string;
  /** toggle on/off */
  enabled: boolean;
  /** ISO timestamp when created */
  createdAt: string;
  /** the JSON blob describing the user’s action graph */
  workflow: InngestWorkflow | null;
}
