import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { emailPickReminders } = await request.json()

  if (typeof emailPickReminders !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailPickReminders },
  })

  return NextResponse.json({ success: true, emailPickReminders })
}
