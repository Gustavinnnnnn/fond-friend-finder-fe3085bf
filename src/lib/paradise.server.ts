import { getParadiseApiKey } from "@/lib/runtime-credentials.server";

const PARADISE_BASE = "https://multi.paradisepags.com/api/v1";

function stripBase64Prefix(v: string | null | undefined): string | null {
  if (!v) return null;
  const marker = "base64,";
  const idx = v.indexOf(marker);
  return idx === -1 ? v : v.slice(idx + marker.length);
}

function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeCreateStatus(status: string | undefined): string {
  if (!status || status === "success") return "pending";
  return status;
}

export async function paradiseCreatePix(args: {
  amountCents: number;
  description: string;
  reference: string;
  phone?: string | null;
}): Promise<{
  transactionId: string;
  status: string;
  qrCode: string;
  qrCodeBase64: string;
}> {
  const token = await getParadiseApiKey();
  if (!token) throw new Error("Chave da Paradise não configurada. Adicione em Configurações → Credenciais.");

  const phone = onlyDigits(args.phone) || "11999999999";
  const safeRef = args.reference.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 48);

  const res = await fetch(`${PARADISE_BASE}/transaction.php`, {
    method: "POST",
    headers: {
      "X-API-Key": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: args.amountCents,
      description: args.description,
      reference: args.reference,
      source: "api_externa",
      customer: {
        name: "Edu Terezinha",
        email: `cliente-${safeRef || Date.now()}@seven-calls.com`,
        document: "99094517000",
        phone,
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Paradise create error", res.status, text);
    throw new Error(`Falha ao gerar Pix na Paradise (${res.status}): ${text}`);
  }

  let json: {
    status?: string;
    transaction_id?: number | string;
    id?: string;
    qr_code?: string;
    qr_code_base64?: string;
  };
  try {
    json = JSON.parse(text);
  } catch {
    console.error("Paradise invalid JSON", text);
    throw new Error("A Paradise retornou uma resposta inválida ao gerar o Pix.");
  }

  const qrCode = json.qr_code ?? "";
  const qrCodeBase64 = stripBase64Prefix(json.qr_code_base64) ?? "";
  if (!qrCode && !qrCodeBase64) {
    console.error("Paradise create without Pix data", text);
    throw new Error("A Paradise criou a transação, mas não retornou QR Code Pix.");
  }

  return {
    transactionId: String(json.transaction_id ?? json.id ?? args.reference),
    status: normalizeCreateStatus(json.status),
    qrCode,
    qrCodeBase64,
  };
}

export async function paradiseGetStatus(transactionId: string): Promise<string | null> {
  const token = await getParadiseApiKey();
  if (!token) return null;
  const res = await fetch(
    `${PARADISE_BASE}/query.php?action=get_transaction&id=${encodeURIComponent(transactionId)}`,
    { headers: { "X-API-Key": token } },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error("Paradise status error", res.status, text);
    return null;
  }
  try {
    const json = JSON.parse(text) as { status?: string };
    return json.status ?? null;
  } catch {
    console.error("Paradise status invalid JSON", text);
    return null;
  }
}