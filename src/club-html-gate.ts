/**
 * Club HTML completeness gate for any future SEO-page metadata fallback.
 * HTTP 200 alone is insufficient (thin ~57KB shells omit PhysicalStore fields).
 */
export type ClubHtmlCompleteness = {
  physicalStorePayloadFound: boolean;
  clubNumberFound: boolean;
  addressFound: boolean;
  storeTypeFound: boolean;
};

export function isUsableClubHtml(gate: ClubHtmlCompleteness): boolean {
  return (
    gate.physicalStorePayloadFound &&
    gate.clubNumberFound &&
    gate.addressFound &&
    gate.storeTypeFound
  );
}

export function assessClubHtmlCompleteness(html: string): ClubHtmlCompleteness {
  return {
    physicalStorePayloadFound:
      /uniqueID|&q;uniqueID&q;|PhysicalStore/i.test(html) && html.length > 100_000,
    clubNumberFound: /&q;uniqueID&q;:&q;\d+&q;|"uniqueID"\s*:\s*"?\d+/i.test(html),
    addressFound: /addressLine|streetAddress|&q;addressLine&q;/i.test(html),
    storeTypeFound: /StoreType|&q;name&q;:&q;StoreType&q;/i.test(html),
  };
}
