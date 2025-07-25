import { PublicEngineAction } from "@inngest/workflow-kit";

export const actions: PublicEngineAction[] = [
  { kind: "swap",    
    name: "Buy PT from Pendle",    
    description: "Swap other tokens into PT on Pendle" },
  { kind: "deposit",
    name: "Deposit PT to Morpho", 
    description: "Deposit PT to Morpho as collateral" },
  { kind: "borrow", 
    name: "Borrow on Morpho",     
    description: "Borrow on Morpho using previously deposited PT as collateral" },
];
