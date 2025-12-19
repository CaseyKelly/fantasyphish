import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Add your personal email here - set this in your .env file
const FORWARD_TO_EMAIL = process.env.FORWARD_TO_EMAIL || "your-email@example.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);

    // Verify webhook signature (optional but recommended for production)
    if (process.env.RESEND_WEBHOOK_SECRET) {
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error("Missing svix headers");
        return NextResponse.json(
          { error: "Missing webhook signature" },
          { status: 401 }
        );
      }

      try {
        resend.webhooks.verify({
          payload: body,
          headers: {
            id: svixId,
            timestamp: svixTimestamp,
            signature: svixSignature,
          },
          webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
        });
      } catch (error) {
        console.error("Webhook verification failed:", error);
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    }

    // Log the incoming email
    console.log("Received email event:", {
      type: event.type,
      from: event.data?.from,
      to: event.data?.to,
      subject: event.data?.subject,
    });

    // Only process email.received events
    if (event.type !== "email.received") {
      return NextResponse.json({ received: true });
    }

    const emailData = event.data;

    // Fetch the full email content (includes html, text, headers)
    const emailContent = await resend.emails.receiving.get(emailData.email_id);

    if (emailContent.error) {
      console.error("Error fetching email content:", emailContent.error);
      return NextResponse.json(
        { error: "Failed to fetch email content" },
        { status: 500 }
      );
    }

    // Build attachments section if any exist
    let attachmentsHtml = "";
    if (emailData.attachments && emailData.attachments.length > 0) {
      const attachmentsList = await resend.emails.receiving.attachments.list({
        emailId: emailData.email_id,
      });

      if (attachmentsList.data?.data) {
        attachmentsHtml = `
          <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Attachments:</p>
            ${attachmentsList.data.data
              .map(
                (att) => `
              <div style="margin: 4px 0;">
                <a href="${att.download_url}" style="color: #2563eb; text-decoration: none;">
                  📎 ${att.filename ?? "attachment"} (${Math.round((att.size ?? 0) / 1024)}KB)
                </a>
              </div>
            `
              )
              .join("")}
          </div>
        `;
      }
    }

    // Forward the email to your personal email
    const forwardResult = await resend.emails.send({
      from: "FantasyPhish Forwarding <noreply@fantasyphish.com>",
      to: FORWARD_TO_EMAIL,
      subject: `FWD: ${emailData.subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>From:</strong> ${emailData.from}</p>
            <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;"><strong>To:</strong> ${emailData.to.join(", ")}</p>
            <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Subject:</strong> ${emailData.subject}</p>
            ${emailData.cc && emailData.cc.length > 0 ? `<p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;"><strong>CC:</strong> ${emailData.cc.join(", ")}</p>` : ""}
          </div>
          <div>
            ${emailContent.data?.html || emailContent.data?.text?.replace(/\n/g, "<br>") || "<p>No content</p>"}
          </div>
          ${attachmentsHtml}
        </div>
      `,
    });

    if (forwardResult.error) {
      console.error("Error forwarding email:", forwardResult.error);
      return NextResponse.json(
        { error: "Failed to forward email" },
        { status: 500 }
      );
    }

    console.log("Forwarded email:", forwardResult.data?.id);

    return NextResponse.json({
      received: true,
      forwarded: forwardResult.data?.id,
    });
  } catch (error) {
    console.error("Error processing inbound email:", error);
    return NextResponse.json(
      { error: "Failed to process email" },
      { status: 500 }
    );
  }
}
