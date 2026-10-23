import { format, subDays } from "date-fns";
import {
  createActivity,
  createCase,
  createClient,
  listCases,
  listClients,
  updateCase,
} from "@/lib/store";

function dayOffset(days: number): string {
  return format(subDays(new Date(), days), "yyyy-MM-dd");
}

async function main(): Promise<void> {
  const [clients, cases] = await Promise.all([listClients(), listCases()]);
  if (clients.length > 0 || cases.length > 0) {
    console.log("Seed skipped: the workbook already contains clients or cases.");
    console.log("Delete data/tracker.xlsx if you want a fresh demo workbook.");
    return;
  }

  const dara = await createClient({
    nameKh: "សុខ ដារា",
    nameEn: "Sok Dara",
    phone: "012 345 678",
    note: "Prefers updates by phone after 4pm.",
  });
  const sreyneang = await createClient({
    nameKh: "ចាន់ ស្រីនាង",
    nameEn: "Chan Sreyneang",
    phone: "017 882 441",
    note: "",
  });
  const nml = await createClient({
    nameKh: "អិនអិមអិល ហ្គាម៉ង់",
    nameEn: "NML GARMENT Co., Ltd.",
    phone: "023 998 120",
    note: "Company documents require the director's stamp.",
  });

  const landTransfer = await createCase({
    clientId: dara.id,
    serviceType: "ownership-transfer",
    ministry: "land-ministry",
    description: "Transfer of title for borey lot 42, Khan Sen Sok.",
    startDate: dayOffset(26),
    endDate: "",
    status: "in_progress",
  });
  await createActivity({
    caseId: landTransfer.id,
    date: dayOffset(25),
    ministry: "land-ministry",
    action: "Submitted the transfer file to the land office.",
    status: "in_progress",
    signed: true,
    note: "Receipt no. 01842 kept in the physical folder.",
  });
  await createActivity({
    caseId: landTransfer.id,
    date: dayOffset(16),
    ministry: "land-ministry",
    action: "Waiting for the officer to review the boundary map.",
    status: "waiting",
    signed: false,
    note: "Call the officer again if there is no movement by Friday.",
  });
  await updateCase(landTransfer.id, { status: "waiting" });

  const vatCase = await createCase({
    clientId: sreyneang.id,
    serviceType: "vat-zero",
    ministry: "gdt",
    description: "VAT registration for a new small retail business.",
    startDate: dayOffset(12),
    endDate: "",
    status: "in_progress",
  });
  await createActivity({
    caseId: vatCase.id,
    date: dayOffset(10),
    ministry: "gdt",
    action: "Filed the VAT registration application at the tax branch.",
    status: "in_progress",
    signed: true,
    note: "",
  });
  await createActivity({
    caseId: vatCase.id,
    date: dayOffset(9),
    ministry: "gdt",
    action: "Waiting for the tax branch to issue the VAT certificate.",
    status: "waiting",
    signed: false,
    note: "",
  });
  await updateCase(vatCase.id, { status: "waiting" });

  const rejectedCase = await createCase({
    clientId: nml.id,
    serviceType: "other",
    ministry: "commerce-ministry",
    description: "Amendment of the company's registered business activities.",
    startDate: dayOffset(7),
    endDate: "",
    status: "in_progress",
  });
  await createActivity({
    caseId: rejectedCase.id,
    date: dayOffset(6),
    ministry: "commerce-ministry",
    action: "Submitted the amendment form with the supporting resolution.",
    status: "in_progress",
    signed: true,
    note: "",
  });
  await createActivity({
    caseId: rejectedCase.id,
    date: dayOffset(4),
    ministry: "commerce-ministry",
    action: "Application returned because the director's signature was missing.",
    status: "rejected",
    signed: false,
    note: "Ask the client to sign a fresh resolution.",
  });

  const completedCase = await createCase({
    clientId: dara.id,
    serviceType: "ownership-transfer",
    ministry: "land-ministry",
    description: "Hard title transfer for a family plot in Kandal.",
    startDate: dayOffset(40),
    endDate: "",
    status: "in_progress",
  });
  await createActivity({
    caseId: completedCase.id,
    date: dayOffset(38),
    ministry: "land-ministry",
    action: "Submitted the hard title transfer request.",
    status: "in_progress",
    signed: true,
    note: "",
  });
  await createActivity({
    caseId: completedCase.id,
    date: dayOffset(30),
    ministry: "land-ministry",
    action: "Collected the updated title from the land office.",
    status: "done",
    signed: true,
    note: "Original title returned to the client.",
  });
  await updateCase(completedCase.id, { status: "done" });

  const healthyCase = await createCase({
    clientId: sreyneang.id,
    serviceType: "other",
    ministry: "commerce-ministry",
    description: "Business name reservation for a new bakery.",
    startDate: dayOffset(3),
    endDate: "",
    status: "in_progress",
  });
  await createActivity({
    caseId: healthyCase.id,
    date: dayOffset(1),
    ministry: "commerce-ministry",
    action: "Name reservation submitted and queued for review.",
    status: "in_progress",
    signed: true,
    note: "",
  });

  console.log("Demo data created:");
  console.log("  3 clients");
  console.log("  5 cases");
  console.log("  9 activities");
  console.log("Workbook: data/tracker.xlsx");
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
