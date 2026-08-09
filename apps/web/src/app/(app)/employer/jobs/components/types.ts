export type MyOrg = { id: string; slug: string; name: string; orgType: string };

export type Posting = {
  id: string;
  posterRole: string;
  companyStage: string;
  company: string;
  org?: { slug: string; name: string } | null;
  title: string;
  location?: string | null;
  salary?: string | null;
  description: string;
  url?: string | null;
  referralCode?: string | null;
  categories?: string[] | null;
  status: "draft" | "open" | "closed";
  reviewStatus: "pending" | "approved" | "rejected";
  reviewNote?: string | null;
  takenDownAt?: string | null;
  createdAt: string;
  _count?: { applications: number };
};
