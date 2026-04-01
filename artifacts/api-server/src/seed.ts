import bcrypt from "bcryptjs";
import { db, usersTable, shiftsTable, shiftAssignmentsTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  // Clear existing data
  await db.delete(shiftAssignmentsTable);
  await db.delete(usersTable);
  await db.delete(shiftsTable);

  const hash = async (p: string) => bcrypt.hash(p, 10);

  // Create 4 shifts
  const [dayA, dayB, nightA, nightB] = await db
    .insert(shiftsTable)
    .values([
      { name: "Day A", shiftType: "day", shiftLetter: "a" },
      { name: "Day B", shiftType: "day", shiftLetter: "b" },
      { name: "Night A", shiftType: "night", shiftLetter: "a" },
      { name: "Night B", shiftType: "night", shiftLetter: "b" },
    ])
    .returning();

  console.log("Created shifts:", dayA.id, dayB.id, nightA.id, nightB.id);

  // Create admin
  const [admin] = await db
    .insert(usersTable)
    .values({
      email: "admin@putnamcounty.gov",
      passwordHash: await hash("admin123"),
      firstName: "Chief",
      lastName: "Admin",
      role: "admin",
      shiftId: null,
      isActive: true,
    })
    .returning();

  // Create sergeants for each shift
  const sergeantData = [
    { email: "sgt.jones@putnamcounty.gov", firstName: "Robert", lastName: "Jones", shiftId: dayA.id },
    { email: "sgt.miller@putnamcounty.gov", firstName: "Patricia", lastName: "Miller", shiftId: dayB.id },
    { email: "sgt.davis@putnamcounty.gov", firstName: "James", lastName: "Davis", shiftId: nightA.id },
    { email: "sgt.wilson@putnamcounty.gov", firstName: "Linda", lastName: "Wilson", shiftId: nightB.id },
  ];

  const sergeants = await db
    .insert(usersTable)
    .values(
      await Promise.all(
        sergeantData.map(async (s) => ({
          email: s.email,
          passwordHash: await hash("password123"),
          firstName: s.firstName,
          lastName: s.lastName,
          role: "sergeant" as const,
          shiftId: s.shiftId,
          isActive: true,
        }))
      )
    )
    .returning();

  // Link sergeants to their shifts
  await db.update(shiftsTable).set({ sergeantId: sergeants[0].id }).where(shiftsTable.id === dayA.id);

  const { eq } = await import("drizzle-orm");
  await db.update(shiftsTable).set({ sergeantId: sergeants[0].id }).where(eq(shiftsTable.id, dayA.id));
  await db.update(shiftsTable).set({ sergeantId: sergeants[1].id }).where(eq(shiftsTable.id, dayB.id));
  await db.update(shiftsTable).set({ sergeantId: sergeants[2].id }).where(eq(shiftsTable.id, nightA.id));
  await db.update(shiftsTable).set({ sergeantId: sergeants[3].id }).where(eq(shiftsTable.id, nightB.id));

  // Create deputies (5 per shift)
  const deputyData = [
    // Day A deputies
    { first: "Michael", last: "Brown", email: "dep.brown@putnamcounty.gov", shiftId: dayA.id },
    { first: "Jennifer", last: "Taylor", email: "dep.taylor@putnamcounty.gov", shiftId: dayA.id },
    { first: "Charles", last: "Anderson", email: "dep.anderson@putnamcounty.gov", shiftId: dayA.id },
    { first: "Susan", last: "Thomas", email: "dep.thomas@putnamcounty.gov", shiftId: dayA.id },
    { first: "Daniel", last: "Jackson", email: "dep.jackson@putnamcounty.gov", shiftId: dayA.id },
    // Day B deputies
    { first: "Matthew", last: "White", email: "dep.white@putnamcounty.gov", shiftId: dayB.id },
    { first: "Karen", last: "Harris", email: "dep.harris@putnamcounty.gov", shiftId: dayB.id },
    { first: "Anthony", last: "Martin", email: "dep.martin@putnamcounty.gov", shiftId: dayB.id },
    { first: "Lisa", last: "Thompson", email: "dep.thompson@putnamcounty.gov", shiftId: dayB.id },
    { first: "Mark", last: "Garcia", email: "dep.garcia@putnamcounty.gov", shiftId: dayB.id },
    // Night A deputies
    { first: "Donald", last: "Martinez", email: "dep.martinez@putnamcounty.gov", shiftId: nightA.id },
    { first: "Betty", last: "Robinson", email: "dep.robinson@putnamcounty.gov", shiftId: nightA.id },
    { first: "Paul", last: "Clark", email: "dep.clark@putnamcounty.gov", shiftId: nightA.id },
    { first: "Sandra", last: "Rodriguez", email: "dep.rodriguez@putnamcounty.gov", shiftId: nightA.id },
    { first: "Steven", last: "Lewis", email: "dep.lewis@putnamcounty.gov", shiftId: nightA.id },
    // Night B deputies
    { first: "Edward", last: "Lee", email: "dep.lee@putnamcounty.gov", shiftId: nightB.id },
    { first: "Donna", last: "Walker", email: "dep.walker@putnamcounty.gov", shiftId: nightB.id },
    { first: "Kevin", last: "Hall", email: "dep.hall@putnamcounty.gov", shiftId: nightB.id },
    { first: "Helen", last: "Allen", email: "dep.allen@putnamcounty.gov", shiftId: nightB.id },
    { first: "Brian", last: "Young", email: "dep.young@putnamcounty.gov", shiftId: nightB.id },
  ];

  const deputies = await db
    .insert(usersTable)
    .values(
      await Promise.all(
        deputyData.map(async (d) => ({
          email: d.email,
          passwordHash: await hash("password123"),
          firstName: d.first,
          lastName: d.last,
          role: "deputy" as const,
          shiftId: d.shiftId,
          isActive: true,
        }))
      )
    )
    .returning();

  // Create shift assignments for all sergeants and deputies
  const allShiftMembers = [
    ...sergeants.map((s) => ({ userId: s.id, shiftId: s.shiftId! })),
    ...deputies.map((d) => ({ userId: d.id, shiftId: d.shiftId! })),
  ];

  await db.insert(shiftAssignmentsTable).values(allShiftMembers);

  console.log(`Seeding complete!`);
  console.log(`Created: 1 admin, 4 sergeants, 20 deputies`);
  console.log(`\nLogin credentials:`);
  console.log(`  Admin: admin@putnamcounty.gov / admin123`);
  console.log(`  Sergeant (Day A): sgt.jones@putnamcounty.gov / password123`);
  console.log(`  Sergeant (Day B): sgt.miller@putnamcounty.gov / password123`);
  console.log(`  Sergeant (Night A): sgt.davis@putnamcounty.gov / password123`);
  console.log(`  Sergeant (Night B): sgt.wilson@putnamcounty.gov / password123`);
  console.log(`  Deputy (Day A): dep.brown@putnamcounty.gov / password123`);
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
