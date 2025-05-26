import { sendEmail } from "@/actions/send-email";
import { db } from "../prisma";
import { inngest } from "./client";
import EmailTemplate from "@/emails/template";
import { use } from "react";
import { date } from "zod";
import { get } from "react-hook-form";
import { getMonth } from "date-fns";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const checkBudgetAlert = inngest.createFunction(
  { name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" }, // every 6 hours
  async ({ step }) => {
    const budgets = await step.run("fetch-budgets", async () => {
      return await db.budget.findMany({
        include: {
          user: {
            include: {
              accounts: {
                where: { isDefault: true },
              },
            },
          },
        },
      });
    });

    for (const budget of budgets) {
      const deafaultAccount = budget.user.accounts[0];
      if (!deafaultAccount) continue;
      await step.run(`check-budget-${budget.id}`, async () => {
        const currentDate = new Date();
        const startOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
        const endOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        );
        const expenses = await db.transaction.aggregate({
          where: {
            userId: budget.userId,
            accountId: deafaultAccount.id,
            type: "EXPENSE",
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          _sum: {
            amount: true,
          },
        });

        const totalExpenses = expenses._sum.amount?.toNumber() || 0;
        const budgetAmount = budget.amount;
        const percentageUsed = (totalExpenses / budgetAmount) * 100;

        if (
          percentageUsed >= 80 &&
          (!budget.lastAlertSent ||
            isNewMonth(new Date(budget.lastAlertSent), new Date()))
        ) {
          // Send email alert
          // try {
          const to = budget.user.email;
          const subject = `Budget Alert for ${deafaultAccount.name}`;

          console.log("Preparing to send email with Resend:", { to, subject });

          await sendEmail({
            to: budget.user.email,
            subject: `Budget Alert for ${deafaultAccount.name}`,
            react: EmailTemplate({
              userName: budget.user.name,
              type: "budget-alert",
              data: {
                percentageUsed,
                budgetAmount: parseInt(budgetAmount).toFixed(1),
                totalExpenses: parseInt(totalExpenses).toFixed(1),
                accountName: deafaultAccount.name,
              },
            }),
          });
          // } catch (error) {
          //   console.error("Error sending email:", error);
          // }

          await db.budget.update({
            where: { id: budget.id },
            data: { lastAlertSent: new Date() },
          });
        }
      });
    }
  }
);

function isNewMonth(lastAlertSent, currentDate) {
  return (
    lastAlertSent.getMonth() !== currentDate.getMonth() ||
    lastAlertSent.getFullYear() !== currentDate.getFullYear()
  );
}

export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions",
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" },
  async ({ step }) => {
    // Fetch all recurring transactions
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        return await db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null },
              {
                nextRecurringDate: {
                  lte: new Date(),
                },
              },
            ],
          },
        });
      }
    );

    // Process each recurring transaction

    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: { transactionId: transaction.id, userId: transaction.userId },
      }));

      await inngest.send(events);
    }
    return { triggered: recurringTransactions.length };
  }
);

export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 10,
      period: "1m",
      key: "event.data.userId",
    },
  },
  { event: "transaction.recurring.process" },
  async ({ event, step }) => {
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.log("Invalid event data:", event);
      return { error: "Missing Required Data" };
    }

    await step.run("process-transaction", async () => {
      const transaction = await db.transaction.findUnique({
        where: {
          id: event.data.transactionId,
          userId: event.data.userId,
        },
        include: {
          account: true,
        },
      });
      if (!transaction || !isTransactionDue(transaction)) return;

      await db.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            type: transaction.type,
            amount: transaction.amount,
            description: `${transaction.description} (Recurring)`,
            date: new Date(),
            category: transaction.category,
            userId: transaction.userId,
            accountId: transaction.accountId,
            isRecurring: false,
          },
        });

        const balanceChange =
          transaction.type === "INCOME"
            ? transaction.amount.toNumber()
            : -transaction.amount.toNumber();

        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: {
              increment: balanceChange,
            },
          },
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              transaction.recurringInterval
            ),
          },
        });
      });
    });
  }
);

function isTransactionDue(transaction) {
  if (!transaction.lastProcessed) return true;

  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);

  return nextDue <= today;
}

function calculateNextRecurringDate(date, interval) {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

export const generateMonthlyReport = inngest.createFunction(
  {
    id: "generate-monthly-report",
    name: "Generate Monthly Report",
  },
  { cron: "0 0 1 * *" },
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      return await db.user.findMany({
        include: {
          accounts: true,
        },
      });
    });

    for (const user of users) {
      await step.run(`generate-report-${user.id}`, async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const stats = await getMonthlyStats(user.id, lastMonth);

        const monthName = lastMonth.toLocaleString("default", {
          month: "long",
        });

        const insights = await generateFinancialInsights(stats, monthName);

        await sendEmail({
          to: user.email,
          subject: `Your Monthly Financial Report for ${monthName}`,
          react: EmailTemplate({
            userName: user.name,
            type: "monthly-report",
            data: {
              stats,
              month: monthName,
              insights,
            },
          }),
        });
      });
    }

    return { processed: users.length };
  }
);

async function generateFinancialInsights(stats, month) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Analyze this financial data and provide 3 concise, actionable insights.
    Focus on spending patterns and practical advice.
    Keep it friendly and conversational.

    Financial Data for ${month}:
    - Total Income: $${stats.totalIncome.toFixed(2)}
    - Total Expenses: $${stats.totalExpenses}
    - Net Income: $${stats.totalIncome - stats.totalExpenses}
    - Expense Categories: ${Object.entries(stats.byCategory)
      .map(([category, amount]) => `${category}: $${amount}`)
      .join(", ")}

    Format the response as a JSON array of strings, like this:
    ["insight 1", "insight 2", "insight 3"]`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your Highest expense category might need attention.",
      "Consider reviewing your spending habits.",
      "Look for opportunities to save more next month.",
    ];
  }
}

const getMonthlyStats = async (userId, date) => {
  const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount.toNumber();
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] =
          (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    {
      totalIncome: 0,
      totalExpenses: 0,
      byCategory: {},
      transactionsCount: transactions.length,
    }
  );
};
// function calculateNextRecurringDate(startDate, interval) {
//   const date = new Date(startDate);

//   switch (interval) {
//     case "DAILY":
//       date.setDate(date.getDate() + 1);
//       break;
//     case "WEEKLY":
//       date.setDate(date.getDate() + 7);
//       break;
//     case "MONTHLY":
//       date.setMonth(date.getMonth() + 1);
//       break;
//     case "YEARLY":
//       date.setFullYear(date.getFullYear() + 1);
//       break;
//   }

//   return date;
// }

// import { sendEmail } from "@/actions/send-email";
// import { db } from "../prisma";
// import { inngest } from "./client";
// import EmailTemplate from "@/emails/template";

// export const checkBudgetAlert = inngest.createFunction(
//   { name: "Check Budget Alerts" },
//   { cron: "0 */6 * * *" }, // every 6 hours
//   async ({ step }) => {
//     const budgets = await step.run("fetch-budgets", async () => {
//       return await db.budget.findMany({
//         include: {
//           user: {
//             include: {
//               accounts: {
//                 where: { isDefault: true },
//               },
//             },
//           },
//         },
//       });
//     });

//     for (const budget of budgets) {
//       const defaultAccount = budget.user.accounts[0];
//       if (!defaultAccount) continue;

//       await step.run(`check-budget-${budget.id}`, async () => {
//         const currentDate = new Date();
//         const startOfMonth = new Date(
//           currentDate.getFullYear(),
//           currentDate.getMonth(),
//           1
//         );
//         const endOfMonth = new Date(
//           currentDate.getFullYear(),
//           currentDate.getMonth() + 1,
//           0
//         );

//         const expenses = await db.transaction.aggregate({
//           where: {
//             userId: budget.userId,
//             accountId: defaultAccount.id,
//             type: "EXPENSE",
//             createdAt: {
//               gte: startOfMonth,
//               lte: endOfMonth,
//             },
//           },
//           _sum: {
//             amount: true,
//           },
//         });

//         const totalExpenses = expenses._sum.amount?.toNumber() || 0;
//         const budgetAmount = budget.amount;
//         const percentageUsed = (totalExpenses / budgetAmount) * 100;

//         if (
//           percentageUsed >= 80 &&
//           (!budget.lastAlertSent ||
//             isNewMonth(new Date(budget.lastAlertSent), new Date()))
//         ) {
//           const emailData = {
//             to: budget.user.email,
//             subject: `Budget Alert for ${defaultAccount.name}`,
//             react: EmailTemplate({
//               userName: budget.user.name,
//               type: "budget-alert",
//               data: {
//                 percentageUsed: percentageUsed.toFixed(1),
//                 budgetAmount: Number(budgetAmount).toFixed(1),
//                 totalExpenses: Number(totalExpenses).toFixed(1),
//                 accountName: defaultAccount.name,
//               },
//             }),
//           };

//           console.log("Preparing to send email with Resend:", {
//             to: emailData.to,
//             subject: emailData.subject,
//           });

//           const result = await sendEmail(emailData);
//           console.log("Email send result:", result);

//           await db.budget.update({
//             where: { id: budget.id },
//             data: { lastAlertSent: new Date() },
//           });
//         }
//       });
//     }
//   }
// );

// function isNewMonth(lastAlertSent, currentDate) {
//   return (
//     lastAlertSent.getMonth() !== currentDate.getMonth() ||
//     lastAlertSent.getFullYear() !== currentDate.getFullYear()
//   );
// }
