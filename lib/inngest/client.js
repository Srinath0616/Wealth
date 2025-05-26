import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "wealth" ,name: "Wealth",
    retryFunction: async (attept)=>({
        delay: Math.pow(2, attept) * 1000,
        maxAttempts: 2,
    }),
 });
