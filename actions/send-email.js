// import { Resend } from "resend";

// export async function sendEmail({ to, subject, react }) {
//     const resend = new Resend(process.env.RESEND_API_KEY || "");

//     try {
//         const data = await resend.sendEmail({
//             from: "Finance App <onboarding@resend.dev>",
//             to,
//             subject,
//             react,
//         });
//         return {success: true, data};
//     } catch (error) {
//         console.error('Error sending email:', error);
//         return {success: false, error};        
//     }
// }

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function sendEmail({ to, subject, react }) {
  try {
    const data = await resend.emails.send({
      from: "Finance App <onboarding@resend.dev>",
      to,
      subject,
      react,
    });
    console.log("Resend email success:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error };
  }
}
