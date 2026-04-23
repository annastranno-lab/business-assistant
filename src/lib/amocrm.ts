export async function createDeal(params: {
  name: string; budget?: number; deadline?: string;
  clientName: string; clientPhone?: string;
}): Promise<{ dealId: number; dealUrl: string }> {
  const subdomain = process.env.AMOCRM_SUBDOMAIN!;
  const token = process.env.AMOCRM_API_TOKEN!;
  const base = `https://${subdomain}.amocrm.ru/api/v4`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Find or create contact
  const searchRes = await fetch(`${base}/contacts?query=${encodeURIComponent(params.clientName)}`, { headers });
  const searchData = await searchRes.json();
  console.log('amoCRM search response:', JSON.stringify(searchData));
  let contactId: number;

  if (searchData._embedded?.contacts?.length > 0) {
    contactId = searchData._embedded.contacts[0].id;
  } else {
    const cc = await fetch(`${base}/contacts`, {
      method: "POST", headers,
      body: JSON.stringify([{ name: params.clientName }]),
    });
    const ccData = await cc.json();
    contactId = ccData._embedded.contacts[0].id;
  }

  // Create deal
  const dealRes = await fetch(`${base}/leads`, {
    method: "POST", headers,
    body: JSON.stringify([{ name: params.name, price: params.budget || 0, _embedded: { contacts: [{ id: contactId }] } }]),
  });
  const dealData = await dealRes.json();
  console.log('amoCRM deal response:', JSON.stringify(dealData));
  const dealId = dealData._embedded.leads[0].id;
  return { dealId, dealUrl: `https://${subdomain}.amocrm.ru/leads/detail/${dealId}` };
}
