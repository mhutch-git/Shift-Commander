import { Router } from "express";
import {
  db,
  dayOffRequestsTable,
  usersTable,
  shiftsTable,
  notificationLogsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { sendEmail } from "../lib/email";

const router = Router();

async function getRequestWithDetails(id: number) {
  const [req_] = await db
    .select({
      id: dayOffRequestsTable.id,
      userId: dayOffRequestsTable.userId,
      requestedDate: dayOffRequestsTable.requestedDate,
      reason: dayOffRequestsTable.reason,
      status: dayOffRequestsTable.status,
      reviewedById: dayOffRequestsTable.reviewedById,
      reviewNotes: dayOffRequestsTable.reviewNotes,
      reviewedAt: dayOffRequestsTable.reviewedAt,
      createdAt: dayOffRequestsTable.createdAt,
      requesterFirstName: usersTable.firstName,
      requesterLastName: usersTable.lastName,
      requesterShiftId: usersTable.shiftId,
    })
    .from(dayOffRequestsTable)
    .innerJoin(usersTable, eq(dayOffRequestsTable.userId, usersTable.id))
    .where(eq(dayOffRequestsTable.id, id))
    .limit(1);

  return req_;
}

router.get("/day-off-requests", requireAuth, async (req, res): Promise<void> => {
  try {
    const requesterId = req.session.userId!;
    const requesterRole = req.session.role ?? "";
    const { userId, status, shiftId } = req.query;

    const query = db
      .select({
        id: dayOffRequestsTable.id,
        userId: dayOffRequestsTable.userId,
        requestedDate: dayOffRequestsTable.requestedDate,
        reason: dayOffRequestsTable.reason,
        status: dayOffRequestsTable.status,
        reviewedById: dayOffRequestsTable.reviewedById,
        reviewNotes: dayOffRequestsTable.reviewNotes,
        reviewedAt: dayOffRequestsTable.reviewedAt,
        createdAt: dayOffRequestsTable.createdAt,
        requesterFirstName: usersTable.firstName,
        requesterLastName: usersTable.lastName,
        requesterShiftId: usersTable.shiftId,
        requesterShiftName: shiftsTable.name,
      })
      .from(dayOffRequestsTable)
      .innerJoin(usersTable, eq(dayOffRequestsTable.userId, usersTable.id))
      .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
      .orderBy(desc(dayOffRequestsTable.createdAt));

    const conditions = [];

    // Role-based scoping
    if (requesterRole === "deputy") {
      // Deputies can only see their own requests
      conditions.push(eq(dayOffRequestsTable.userId, requesterId));
    } else if (requesterRole === "sergeant") {
      // Sergeants see requests from their own shift's personnel
      const [sergeantShift] = await db
        .select({ id: shiftsTable.id })
        .from(shiftsTable)
        .where(eq(shiftsTable.sergeantId, requesterId))
        .limit(1);
      if (sergeantShift) {
        conditions.push(eq(usersTable.shiftId, sergeantShift.id));
      } else {
        // Sergeant not assigned to a shift — show only own requests
        conditions.push(eq(dayOffRequestsTable.userId, requesterId));
      }
    }
    // Admins see all (no restriction)

    // Apply optional client-side filters on top
    if (userId && requesterRole === "admin") {
      conditions.push(eq(dayOffRequestsTable.userId, parseInt(userId as string)));
    }
    if (status) conditions.push(eq(dayOffRequestsTable.status, status as string));
    if (shiftId && requesterRole === "admin") {
      conditions.push(eq(usersTable.shiftId, parseInt(shiftId as string)));
    }

    const requests = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    res.json(requests);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/day-off-requests", requireAuth, async (req, res): Promise<void> => {
  try {
    const { requestedDate, reason } = req.body;
    const userId = req.session.userId!;

    if (!requestedDate || !reason) {
      res.status(400).json({ message: "requestedDate and reason required" });
      return;
    }

    const [request] = await db
      .insert(dayOffRequestsTable)
      .values({ userId, requestedDate, reason, status: "pending" })
      .returning();

    const [user] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName, shiftId: usersTable.shiftId })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user?.shiftId) {
      const [shift] = await db
        .select({ sergeantId: shiftsTable.sergeantId })
        .from(shiftsTable)
        .where(eq(shiftsTable.id, user.shiftId))
        .limit(1);

      if (shift?.sergeantId) {
        await db.insert(notificationLogsTable).values({
          recipientId: shift.sergeantId,
          type: "day_off_submitted",
          message: `${user.firstName} ${user.lastName} has requested a day off on ${requestedDate}.`,
          isRead: false,
        });

        const [sergeant] = await db
          .select({ email: usersTable.email, firstName: usersTable.firstName })
          .from(usersTable)
          .where(eq(usersTable.id, shift.sergeantId))
          .limit(1);

        if (sergeant) {
          await sendEmail(
            sergeant.email,
            "New Day-Off Request",
            `${user.firstName} ${user.lastName} has submitted a day-off request for ${requestedDate}.\n\nReason: ${reason}\n\nPlease review in the Shift Scheduler.`
          );
        }
      }
    }

    res.status(201).json({ ...request, requesterFirstName: user?.firstName, requesterLastName: user?.lastName });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/day-off-requests/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const request = await getRequestWithDetails(parseInt(req.params.id as string));
    if (!request) {
      res.status(404).json({ message: "Request not found" });
      return;
    }
    res.json(request);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Helper: verify that a sergeant reviewer can only action requests from their own shift
async function canReview(reviewerId: number, reviewerRole: string, requestId: number): Promise<boolean> {
  if (reviewerRole === "admin") return true;

  const request = await getRequestWithDetails(requestId);
  if (!request) return false;

  // Find which shift this reviewer is the sergeant of
  const [reviewerShift] = await db
    .select({ id: shiftsTable.id })
    .from(shiftsTable)
    .where(eq(shiftsTable.sergeantId, reviewerId))
    .limit(1);

  if (!reviewerShift) return false;

  return request.requesterShiftId === reviewerShift.id;
}

// PATCH — aligns with OpenAPI spec
router.patch("/day-off-requests/:id/approve", requireRole(["admin", "sergeant"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { notes } = req.body;
    const reviewerId = req.session.userId!;
    const reviewerRole = req.session.role!;

    if (!await canReview(reviewerId, reviewerRole, id)) {
      res.status(403).json({ message: "You can only review requests from your own shift" });
      return;
    }

    const [request] = await db
      .update(dayOffRequestsTable)
      .set({
        status: "approved",
        reviewedById: reviewerId,
        reviewNotes: notes || null,
        reviewedAt: new Date(),
      })
      .where(and(eq(dayOffRequestsTable.id, id), eq(dayOffRequestsTable.status, "pending")))
      .returning();

    if (!request) {
      res.status(404).json({ message: "Request not found or already reviewed" });
      return;
    }

    await db.insert(notificationLogsTable).values({
      recipientId: request.userId,
      type: "day_off_approved",
      message: `Your day-off request for ${request.requestedDate} has been approved.${notes ? ` Note: ${notes}` : ""}`,
      isRead: false,
    });

    const [requester] = await db
      .select({ email: usersTable.email, firstName: usersTable.firstName })
      .from(usersTable)
      .where(eq(usersTable.id, request.userId))
      .limit(1);

    if (requester) {
      await sendEmail(
        requester.email,
        "Day-Off Request Approved",
        `Your day-off request for ${request.requestedDate} has been approved.${notes ? `\n\nNotes: ${notes}` : ""}`
      );
    }

    res.json(request);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH — aligns with OpenAPI spec
router.patch("/day-off-requests/:id/deny", requireRole(["admin", "sergeant"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { notes } = req.body;
    const reviewerId = req.session.userId!;
    const reviewerRole = req.session.role!;

    if (!await canReview(reviewerId, reviewerRole, id)) {
      res.status(403).json({ message: "You can only review requests from your own shift" });
      return;
    }

    const [request] = await db
      .update(dayOffRequestsTable)
      .set({
        status: "denied",
        reviewedById: reviewerId,
        reviewNotes: notes || null,
        reviewedAt: new Date(),
      })
      .where(and(eq(dayOffRequestsTable.id, id), eq(dayOffRequestsTable.status, "pending")))
      .returning();

    if (!request) {
      res.status(404).json({ message: "Request not found or already reviewed" });
      return;
    }

    await db.insert(notificationLogsTable).values({
      recipientId: request.userId,
      type: "day_off_denied",
      message: `Your day-off request for ${request.requestedDate} has been denied.${notes ? ` Reason: ${notes}` : ""}`,
      isRead: false,
    });

    const [requester] = await db
      .select({ email: usersTable.email, firstName: usersTable.firstName })
      .from(usersTable)
      .where(eq(usersTable.id, request.userId))
      .limit(1);

    if (requester) {
      await sendEmail(
        requester.email,
        "Day-Off Request Denied",
        `Your day-off request for ${request.requestedDate} has been denied.${notes ? `\n\nReason: ${notes}` : ""}`
      );
    }

    res.json(request);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
