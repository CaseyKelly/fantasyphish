import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminFeaturesEnabled } from "@/lib/env"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin auth
    const session = await auth()
    if (
      !session?.user?.id ||
      !session.user.isAdmin ||
      !isAdminFeaturesEnabled()
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: submissionId } = await params

    if (!submissionId) {
      return NextResponse.json(
        { error: "Submission ID is required" },
        { status: 400 }
      )
    }

    // Get submission info before deleting for logging
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        show: { select: { venue: true, showDate: true } },
        user: { select: { username: true } },
      },
    })

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      )
    }

    // Delete the submission (cascade will delete related picks)
    await prisma.submission.delete({
      where: { id: submissionId },
    })

    console.log(
      `[Admin] Deleted submission ${submissionId} by ${submission.user.username} for ${submission.show.venue} (${submission.show.showDate.toISOString().split("T")[0]})`
    )

    return NextResponse.json({
      success: true,
      message: `Deleted submission by ${submission.user.username} for ${submission.show.venue}`,
    })
  } catch (error) {
    console.error("[Admin] Delete submission error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete submission",
      },
      { status: 500 }
    )
  }
}
