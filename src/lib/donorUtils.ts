export interface Donation {
  id: string;
  member_id: string | null;
  donor_name: string;
  phone: string | null;
  amount: number;
  category: 'General' | 'Sahar' | 'Iftar';
  notes: string | null;
  donation_date: string;
  created_at?: string;
  members?: {
    full_name: string;
  } | null;
}

export interface DonorProfile {
  id: string; // member_[id] or ext_[base64]
  donor_name: string; // Display name
  phone: string | null;
  member_id: string | null;
  source: 'Member' | 'External';
  donationCount: number;
  generalTotal: number;
  saharTotal: number;
  iftarTotal: number;
  lifetimeTotal: number;
  largestDonation: number;
  latestDonationDate: string;
  firstDonationDate: string;
  donations: Donation[];
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getDonorId(memberId: string | null, donorName: string, phone: string | null): string {
  if (memberId) {
    return `member_${memberId}`;
  }
  const normName = normalizeName(donorName);
  const normPhone = (phone || '').trim().toLowerCase();
  const rawId = `${normName}:${normPhone}`;
  
  // URL-safe Base64 encode
  let b64 = '';
  if (typeof btoa !== 'undefined') {
    b64 = btoa(unescape(encodeURIComponent(rawId)));
  } else {
    b64 = Buffer.from(rawId).toString('base64');
  }
  return `ext_${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

export function decodeExternalDonorId(extId: string): { donor_name: string; phone: string | null } {
  const b64Part = extId.substring(4); // strip 'ext_'
  let base64 = b64Part.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  let decoded = '';
  if (typeof atob !== 'undefined') {
    decoded = decodeURIComponent(escape(atob(base64)));
  } else {
    decoded = Buffer.from(base64, 'base64').toString('utf-8');
  }
  const parts = decoded.split(':');
  const name = parts[0] || '';
  const phone = parts[1] || null;
  return { donor_name: name, phone: phone === '' ? null : phone };
}

export function aggregateDonors(donations: Donation[]): DonorProfile[] {
  const map = new Map<string, DonorProfile>();

  donations.forEach((d) => {
    const memberId = d.member_id || null;
    const donorName = d.donor_name;
    const phone = d.phone || null;
    const id = getDonorId(memberId, donorName, phone);

    const amt = Number(d.amount);
    const category = d.category;
    const date = d.donation_date;

    let profile = map.get(id);
    if (!profile) {
      profile = {
        id,
        donor_name: donorName,
        phone: phone,
        member_id: memberId,
        source: memberId ? 'Member' : 'External',
        donationCount: 0,
        generalTotal: 0,
        saharTotal: 0,
        iftarTotal: 0,
        lifetimeTotal: 0,
        largestDonation: 0,
        latestDonationDate: '',
        firstDonationDate: '',
        donations: [],
      };
      map.set(id, profile);
    }

    profile.donationCount += 1;
    profile.lifetimeTotal += amt;
    if (amt > profile.largestDonation) {
      profile.largestDonation = amt;
    }
    if (category === 'General') profile.generalTotal += amt;
    else if (category === 'Sahar') profile.saharTotal += amt;
    else if (category === 'Iftar') profile.iftarTotal += amt;

    if (!profile.latestDonationDate || date > profile.latestDonationDate) {
      profile.latestDonationDate = date;
    }
    if (!profile.firstDonationDate || date < profile.firstDonationDate) {
      profile.firstDonationDate = date;
    }
    profile.donations.push(d);
  });

  // Sort by lifetimeTotal descending
  return Array.from(map.values()).sort((a, b) => b.lifetimeTotal - a.lifetimeTotal);
}
