'use client';

import React, { useState, useEffect, Suspense, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClientInstance } from '@/lib/supabase';
import DatePicker from '@/components/DatePicker';
import { formatDate, formatCurrency } from '@/lib/dueUtils';
import { getDonorId, aggregateDonors, normalizeName, DonorProfile } from '@/lib/donorUtils';
import {
  Heart,
  Search,
  Plus,
  User,
  Phone,
  IndianRupee,
  Filter,
  X,
  FileText,
  ChevronRight,
  Sparkles,
  Eye,
  Edit3,
  Trash2,
  List,
  Users,
} from 'lucide-react';

interface Member {
  id: string;
  full_name: string;
  phone: string;
}

interface Donation {
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

interface GroupedTransaction {
  key: string;
  donorId: string;
  donor_name: string;
  phone: string | null;
  member_id: string | null;
  category: 'General' | 'Sahar' | 'Iftar';
  totalAmount: number;
  donationCount: number;
  donations: Donation[];
}

function DonationsPageContent() {
  const supabase = createBrowserClientInstance();

  // Data States
  const [donations, setDonations] = useState<Donation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Visibility & Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [donationSource, setDonationSource] = useState<'Member' | 'External'>('Member');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  
  const [donorName, setDonorName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'General' | 'Sahar' | 'Iftar'>('General');
  const [notes, setNotes] = useState('');
  const [donationDate, setDonationDate] = useState(formatDate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // External Autocomplete dropdown states
  const [showExternalDropdown, setShowExternalDropdown] = useState(false);
  const externalRef = useRef<HTMLDivElement>(null);

  // List Filter & Search States
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'General' | 'Sahar' | 'Iftar'>('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Member' | 'External'>('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // View Toggle State: 'transaction' or 'donor'
  const [viewMode, setViewMode] = useState<'transaction' | 'donor'>('transaction');

  // Set of donor IDs expanded in donor summary view
  const [expandedDonors, setExpandedDonors] = useState<Set<string>>(new Set());

  const toggleDonorExpand = (donorId: string) => {
    setExpandedDonors((prev) => {
      const next = new Set(prev);
      if (next.has(donorId)) {
        next.delete(donorId);
      } else {
        next.add(donorId);
      }
      return next;
    });
  };

  // Set of grouped transaction keys expanded in transaction view
  const [expandedTransactionGroups, setExpandedTransactionGroups] = useState<Set<string>>(new Set());

  const toggleTransactionGroupExpand = (key: string) => {
    setExpandedTransactionGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Selected Donation Notes viewer modal
  const [viewingNotesDonation, setViewingNotesDonation] = useState<Donation | null>(null);

  // Edit & Delete Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingDonation, setDeletingDonation] = useState<Donation | null>(null);

  const renderNotes = (note: string | null, donation: Donation) => {
    if (!note || !note.trim()) {
      return <span className="text-slate-600 italic">No notes</span>;
    }
    if (note.length <= 35) {
      return (
        <span className="cursor-help text-slate-300 border-b border-dashed border-slate-700" title={note}>
          {note}
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setViewingNotesDonation(donation)}
        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition text-left"
        title="Click to open modal notes"
      >
        <span className="cursor-help border-b border-dashed border-slate-700 truncate max-w-[120px] block" title={note}>
          {note}
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      </button>
    );
  };

  // Unique external donors computed from list of donations
  const uniqueExternalDonors = useMemo(() => {
    const map = new Map<string, { donor_name: string; phone: string | null }>();
    donations.forEach((d) => {
      if (!d.member_id) {
        const key = `${normalizeName(d.donor_name)}:${(d.phone || '').trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, { donor_name: d.donor_name, phone: d.phone });
        }
      }
    });
    return Array.from(map.values());
  }, [donations]);

  // Autocomplete filtering
  const filteredAutocompleteExternalDonors = useMemo(() => {
    if (!donorName.trim()) return [];
    const search = donorName.toLowerCase();
    return uniqueExternalDonors.filter((d) =>
      d.donor_name.toLowerCase().includes(search) ||
      (d.phone && d.phone.toLowerCase().includes(search))
    );
  }, [donorName, uniqueExternalDonors]);

  // Donor profiles list and rankings
  const donorProfiles = useMemo(() => {
    return aggregateDonors(donations);
  }, [donations]);

  const uniqueDonorsCount = donorProfiles.length;

  const stats = useMemo(() => {
    let totalAmt = 0;
    let maxAmt = 0;
    let topDonorName = '—';
    let topDonorAmt = 0;

    donations.forEach((d) => {
      const amt = Number(d.amount);
      totalAmt += amt;
      if (amt > maxAmt) {
        maxAmt = amt;
      }
    });

    donorProfiles.forEach((profile) => {
      if (profile.lifetimeTotal > topDonorAmt) {
        topDonorAmt = profile.lifetimeTotal;
        topDonorName = profile.donor_name;
      }
    });

    const avgAmt = donations.length > 0 ? totalAmt / donations.length : 0;

    return {
      totalAmt,
      maxAmt,
      topDonorName,
      avgAmt,
    };
  }, [donations, donorProfiles]);

  const topFiveDonors = useMemo(() => {
    return donorProfiles.slice(0, 5);
  }, [donorProfiles]);

  // Fetch all donations and members
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch members for autocomplete dropdown
      const { data: memberData, error: memberErr } = await supabase
        .from('members')
        .select('id, full_name, phone')
        .order('full_name', { ascending: true });

      if (memberErr) throw memberErr;
      setMembers(memberData || []);

      // 2. Fetch donations with member details
      const { data: donationData, error: donationErr } = await supabase
        .from('donations')
        .select(`
          id,
          member_id,
          donor_name,
          phone,
          amount,
          category,
          notes,
          donation_date,
          created_at,
          members (
            full_name
          )
        `)
        .order('donation_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (donationErr) throw donationErr;
      
      interface DBDonation {
        id: string;
        member_id: string | null;
        donor_name: string;
        phone: string | null;
        amount: string | number;
        category: string;
        notes: string | null;
        donation_date: string;
        created_at: string;
        members: {
          full_name: string;
        } | null;
      }

      const formattedDonations = (donationData as unknown as DBDonation[] || []).map((d) => ({
        id: d.id,
        member_id: d.member_id,
        donor_name: d.donor_name,
        phone: d.phone,
        amount: Number(d.amount),
        category: d.category as 'General' | 'Sahar' | 'Iftar',
        notes: d.notes,
        donation_date: d.donation_date,
        created_at: d.created_at,
        members: d.members,
      }));

      setDonations(formattedDonations);
    } catch (err) {
      console.error('Error fetching donations data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const searchParams = useSearchParams();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Click away listener for external donor autocomplete
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (externalRef.current && !externalRef.current.contains(e.target as Node)) {
        setShowExternalDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for query params to apply filters or open modal automatically
  useEffect(() => {
    let updated = false;
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      const catMap: Record<string, 'General' | 'Sahar' | 'Iftar'> = {
        'general': 'General',
        'sahar': 'Sahar',
        'iftar': 'Iftar'
      };
      const mapped = catMap[categoryParam.toLowerCase()];
      if (mapped) {
        setCategoryFilter(mapped);
        updated = true;
      }
    }

    const sourceParam = searchParams.get('source');
    if (sourceParam) {
      const srcMap: Record<string, 'Member' | 'External'> = {
        'member': 'Member',
        'external': 'External'
      };
      const mapped = srcMap[sourceParam.toLowerCase()];
      if (mapped) {
        setSourceFilter(mapped);
        updated = true;
      }
    }

    if (searchParams.get('add') === 'true') {
      setIsAddModalOpen(true);
      updated = true;
    }

    if (updated) {
      // Remove query param without reload
      const newUrl = window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [searchParams]);

  // Form Submission
  const handleSaveDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    // Validate name
    let finalDonorName = '';
    let finalMemberId: string | null = null;
    let finalPhone = phone.trim() || null;

    if (donationSource === 'Member') {
      if (!selectedMember) {
        setFormError('Please select a member.');
        setIsSubmitting(false);
        return;
      }
      finalDonorName = selectedMember.full_name;
      finalMemberId = selectedMember.id;
      if (!finalPhone && selectedMember.phone) {
        finalPhone = selectedMember.phone;
      }
    } else {
      const trimmedName = donorName.trim();
      if (!trimmedName) {
        setFormError('Donor name is required.');
        setIsSubmitting(false);
        return;
      }
      // Check if we have an existing donor matching this normalized name & phone
      const matchingExisting = uniqueExternalDonors.find(
        (ext) =>
          normalizeName(ext.donor_name) === normalizeName(trimmedName) &&
          (ext.phone || '').trim() === (finalPhone || '').trim()
      );
      // Auto-normalize casing to the existing record if found
      finalDonorName = matchingExisting ? matchingExisting.donor_name : trimmedName;
    }

    // Validate amount
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setFormError('Please enter a valid donation amount greater than 0.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.from('donations').insert({
        member_id: finalMemberId,
        donor_name: finalDonorName,
        phone: finalPhone,
        amount: amtNum,
        category,
        notes: notes.trim() || null,
        donation_date: donationDate,
      });

      if (error) throw error;

      // Reset Form State
      setSelectedMember(null);
      setMemberSearchQuery('');
      setDonorName('');
      setPhone('');
      setAmount('');
      setCategory('General');
      setNotes('');
      setDonationDate(formatDate(new Date()));
      setIsAddModalOpen(false);

      // Refresh Data list
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record donation.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit & Delete Handlers
  const handleOpenEditModal = (donation: Donation) => {
    setEditingDonation(donation);
    setCategory(donation.category);
    setAmount(donation.amount.toString());
    setDonationDate(donation.donation_date);
    setNotes(donation.notes || '');
    setFormError(null);

    if (donation.member_id) {
      setDonationSource('Member');
      const member = members.find((m) => m.id === donation.member_id);
      if (member) {
        setSelectedMember(member);
        setMemberSearchQuery(member.full_name);
        setPhone(member.phone || '');
      } else {
        setSelectedMember(null);
        setMemberSearchQuery(donation.donor_name);
        setPhone(donation.phone || '');
      }
    } else {
      setDonationSource('External');
      setSelectedMember(null);
      setMemberSearchQuery('');
      setDonorName(donation.donor_name);
      setPhone(donation.phone || '');
    }
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (donation: Donation) => {
    setDeletingDonation(donation);
    setIsDeleteModalOpen(true);
  };

  const handleSaveEditDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDonation) return;

    setIsSubmitting(true);
    setFormError(null);

    let finalDonorName = '';
    let finalPhone = phone.trim() || null;

    if (donationSource === 'Member') {
      finalDonorName = editingDonation.donor_name;
      finalPhone = editingDonation.phone;
    } else {
      const trimmedName = donorName.trim();
      if (!trimmedName) {
        setFormError('Donor name is required.');
        setIsSubmitting(false);
        return;
      }
      const matchingExisting = uniqueExternalDonors.find(
        (ext) =>
          normalizeName(ext.donor_name) === normalizeName(trimmedName) &&
          (ext.phone || '').trim() === (finalPhone || '').trim()
      );
      finalDonorName = matchingExisting ? matchingExisting.donor_name : trimmedName;
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setFormError('Please enter a valid donation amount greater than 0.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('donations')
        .update({
          donor_name: finalDonorName,
          phone: finalPhone,
          amount: amtNum,
          category,
          notes: notes.trim() || null,
          donation_date: donationDate,
        })
        .eq('id', editingDonation.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      setEditingDonation(null);
      setSelectedMember(null);
      setMemberSearchQuery('');
      setDonorName('');
      setPhone('');
      setAmount('');
      setCategory('General');
      setNotes('');
      setDonationDate(formatDate(new Date()));

      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update donation.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDonation) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('donations')
        .delete()
        .eq('id', deletingDonation.id);

      if (error) throw error;

      setIsDeleteModalOpen(false);
      setDeletingDonation(null);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete donation.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered members for existing member selector autocomplete dropdown
  const filteredAutocompleteMembers = memberSearchQuery.trim()
    ? members.filter(
        (m) =>
          m.full_name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
          m.phone.includes(memberSearchQuery)
      )
    : members;

  // Client-side Searching & Filtering of Donations List
  const filteredDonations = donations.filter((donation) => {
    // 1. Search by donor name or phone
    const searchLower = listSearchQuery.toLowerCase().trim();
    const matchesSearch =
      donation.donor_name.toLowerCase().includes(searchLower) ||
      (donation.phone && donation.phone.toLowerCase().includes(searchLower));

    // 2. Filter by Category
    const matchesCategory =
      categoryFilter === 'All' || donation.category === categoryFilter;

    // 3. Filter by Source
    const isMemberSource = donation.member_id !== null;
    const matchesSource =
      sourceFilter === 'All' ||
      (sourceFilter === 'Member' && isMemberSource) ||
      (sourceFilter === 'External' && !isMemberSource);

    return matchesSearch && matchesCategory && matchesSource;
  });

  // Group only the filtered list of donations for the Donor Summary view
  const filteredDonorProfiles = useMemo(() => {
    return aggregateDonors(filteredDonations);
  }, [filteredDonations]);

  // Group filtered donations by Donor + Category for grouped Transaction View
  const groupedTransactions = useMemo(() => {
    const map = new Map<string, GroupedTransaction>();

    filteredDonations.forEach((d) => {
      const donorId = getDonorId(d.member_id, d.donor_name, d.phone);
      const key = `${donorId}:${d.category}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          donorId,
          donor_name: d.donor_name,
          phone: d.phone,
          member_id: d.member_id,
          category: d.category,
          totalAmount: 0,
          donationCount: 0,
          donations: [],
        };
        map.set(key, group);
      }
      group.totalAmount += d.amount;
      group.donationCount += 1;
      group.donations.push(d);
    });

    // Sort the groups descending by the latest donation date in each group
    return Array.from(map.values()).sort((a, b) => {
      const latestA = a.donations[0]?.donation_date || '';
      const latestB = b.donations[0]?.donation_date || '';
      return latestB.localeCompare(latestA);
    });
  }, [filteredDonations]);

  // Pagination math
  const itemsToPaginate = viewMode === 'transaction' ? groupedTransactions : filteredDonorProfiles;
  const totalItems = itemsToPaginate.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = itemsToPaginate.slice(startIndex, startIndex + itemsPerPage);

  const paginatedGroupedTransactions = viewMode === 'transaction' ? (paginatedItems as GroupedTransaction[]) : [];
  const paginatedDonors = viewMode === 'donor' ? (paginatedItems as DonorProfile[]) : [];

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset page when search/filter or viewMode changes
  useEffect(() => {
    setCurrentPage(1);
    setExpandedTransactionGroups(new Set());
  }, [viewMode, listSearchQuery, categoryFilter, sourceFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Heart className="h-8 w-8 text-indigo-500 fill-indigo-500/10" /> Donations
          </h2>
          <p className="text-slate-400">
            Track and log contributions from existing members and external donors.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 self-start sm:self-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition duration-150 shadow-md"
        >
          <Plus className="h-5 w-5" />
          Log Donation
        </button>
      </div>

      {/* Donation Dashboard Stats Grid */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* Unique Donors */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400">Unique Donors</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-violet-400">{uniqueDonorsCount}</span>
          </div>
        </div>

        {/* Total Donations */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400">Total Donations</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{formatCurrency(stats.totalAmt)}</span>
          </div>
        </div>

        {/* Top Donor */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400">Top Donor</span>
          <div className="mt-2 flex items-baseline gap-2 min-w-0">
            <span className="text-xl font-bold text-emerald-400 truncate block w-full" title={stats.topDonorName}>
              {stats.topDonorName}
            </span>
          </div>
        </div>

        {/* Largest Donation */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400">Largest Donation</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{formatCurrency(stats.maxAmt)}</span>
          </div>
        </div>

        {/* Average Donation */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
          <span className="text-xs font-semibold text-slate-400">Average Donation</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-400">{formatCurrency(stats.avgAmt)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Left 2 columns: Table & Filters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters and Search Row */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur-md">
            {/* View Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/60 pb-3 gap-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">View Mode</span>
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-850 self-start sm:self-center">
                <button
                  onClick={() => setViewMode('transaction')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    viewMode === 'transaction'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Transaction View
                </button>
                <button
                  onClick={() => setViewMode('donor')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    viewMode === 'donor'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Donor Summary View
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                placeholder="Search by donor name or phone..."
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
                className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Filter Selection Row */}
            <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-800/60">
              {/* Category Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" /> Category:
                </span>
                {(['All', 'General', 'Sahar', 'Iftar'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 ${
                      categoryFilter === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Source Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Source:
                </span>
                {[
                  { label: 'All Sources', value: 'All' },
                  { label: 'Member Donations', value: 'Member' },
                  { label: 'External Donors', value: 'External' },
                ].map((src) => (
                  <button
                    key={src.value}
                    onClick={() => setSourceFilter(src.value as 'All' | 'Member' | 'External')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 ${
                      sourceFilter === src.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Donation Table / Mobile cards */}
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="text-sm text-slate-500 mt-3">Loading donation records...</p>
            </div>
          ) : itemsToPaginate.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-slate-800 bg-slate-900/10 text-center">
              <Heart className="h-12 w-12 text-slate-700 mb-4" />
              <h3 className="text-lg font-semibold text-slate-300">No donations found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                {listSearchQuery || categoryFilter !== 'All' || sourceFilter !== 'All'
                  ? 'No donation records match your filter criteria.'
                  : 'Log your first donation to begin tracking contribution metrics.'}
              </p>
              {(listSearchQuery || categoryFilter !== 'All' || sourceFilter !== 'All') && (
                <button
                  onClick={() => {
                    setListSearchQuery('');
                    setCategoryFilter('All');
                    setSourceFilter('All');
                  }}
                  className="mt-4 text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">              {/* Desktop Table */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-slate-800 bg-slate-900/20 shadow-md">
                <table className="w-full border-collapse text-left text-sm text-slate-300">
                  <thead className="bg-slate-900/60 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                    {viewMode === 'transaction' ? (
                      <tr>
                        <th className="px-6 py-4">Donor Name</th>
                        <th className="px-6 py-4">Source</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Total Amount</th>
                        <th className="px-6 py-4">Donation Count</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="px-6 py-4">Donor Name</th>
                        <th className="px-6 py-4">Source</th>
                        <th className="px-6 py-4">Total Donated</th>
                        <th className="px-6 py-4">Donation Count</th>
                        <th className="px-6 py-4">Latest Donation Date</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-transparent">
                    {viewMode === 'transaction'
                      ? paginatedGroupedTransactions.map((group) => {
                          const isExpanded = expandedTransactionGroups.has(group.key);
                          const isMember = group.member_id !== null;
                          return (
                            <React.Fragment key={group.key}>
                              <tr className="hover:bg-slate-900/30 transition duration-100">
                                <td className="p-0 font-semibold text-white transition hover:text-indigo-400 hover:bg-slate-800/40">
                                  <Link href={`/dashboard/donations/donor/${group.donorId}`} className="block px-6 py-4 w-full h-full">
                                    {group.donor_name}
                                  </Link>
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                      isMember
                                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                                    }`}
                                  >
                                    {isMember ? 'Member' : 'External'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                      group.category === 'General'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : group.category === 'Sahar'
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}
                                  >
                                    {group.category}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-semibold text-emerald-400">
                                  {formatCurrency(group.totalAmount)}
                                </td>
                                <td className="px-6 py-4 text-slate-300 font-medium">
                                  {group.donationCount} {group.donationCount === 1 ? 'donation' : 'donations'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={() => toggleTransactionGroupExpand(group.key)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white transition"
                                  >
                                    {isExpanded ? 'Hide History' : 'View History'}
                                    <ChevronRight className={`h-4 w-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-slate-950/40 border-t border-slate-850/80">
                                  <td colSpan={6} className="px-6 py-4 border-b border-slate-800/80">
                                    <div className="space-y-2.5 text-left pl-4">
                                      <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                          {group.donor_name} — {group.category} Donations
                                        </span>
                                        <span className="text-xs font-bold text-slate-300">
                                          Subtotal: <span className="text-emerald-400">{formatCurrency(group.totalAmount)}</span>
                                        </span>
                                      </div>
                                      <div className="overflow-hidden rounded-lg border border-slate-850 bg-slate-950/60">
                                        <table className="w-full text-xs text-left text-slate-300">
                                          <thead className="bg-slate-900/40 text-[10px] font-semibold uppercase text-slate-500 border-b border-slate-850">
                                            <tr>
                                              <th className="px-4 py-2">Date</th>
                                              <th className="px-4 py-2">Amount</th>
                                              <th className="px-4 py-2">Notes</th>
                                              <th className="px-4 py-2 text-right">Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-850/60">
                                            {group.donations.map((d) => (
                                              <tr key={d.id} className="hover:bg-slate-900/20">
                                                <td className="px-4 py-2 text-slate-400">
                                                  {new Date(d.donation_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                                </td>
                                                <td className="px-4 py-2 font-semibold text-emerald-400">
                                                  {formatCurrency(d.amount)}
                                                </td>
                                                <td className="px-4 py-2 text-slate-400">
                                                  {renderNotes(d.notes, d)}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                  <div className="flex items-center justify-end gap-2">
                                                    <button
                                                      onClick={() => handleOpenEditModal(d)}
                                                      className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-blue-400 transition"
                                                      title="Edit Donation"
                                                    >
                                                      <Edit3 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                      onClick={() => handleOpenDeleteModal(d)}
                                                      className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
                                                      title="Delete Donation"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      : paginatedDonors.map((donor) => {
                          const isExpanded = expandedDonors.has(donor.id);
                          return (
                            <React.Fragment key={donor.id}>
                              <tr className="hover:bg-slate-900/30 transition duration-100">
                                <td className="p-0 font-semibold text-white transition hover:text-indigo-400 hover:bg-slate-800/40">
                                  <Link href={`/dashboard/donations/donor/${donor.id}`} className="block px-6 py-4 w-full h-full">
                                    {donor.donor_name}
                                  </Link>
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                      donor.source === 'Member'
                                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                                    }`}
                                  >
                                    {donor.source}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-semibold text-emerald-400">
                                  {formatCurrency(donor.lifetimeTotal)}
                                </td>
                                <td className="px-6 py-4 text-slate-300">
                                  {donor.donationCount} {donor.donationCount === 1 ? 'donation' : 'donations'}
                                </td>
                                <td className="px-6 py-4 text-slate-400">
                                  {new Date(donor.latestDonationDate).toLocaleDateString(undefined, {
                                    dateStyle: 'medium',
                                  })}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2.5">
                                    <Link
                                      href={`/dashboard/donations/donor/${donor.id}`}
                                      className="p-1 rounded-md text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition"
                                      title="View Profile"
                                    >
                                      <Eye className="h-4.5 w-4.5" />
                                    </Link>
                                    <button
                                      onClick={() => toggleDonorExpand(donor.id)}
                                      className="p-1 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition"
                                      title={isExpanded ? 'Collapse Details' : 'Expand Details'}
                                    >
                                      <ChevronRight className={`h-4.5 w-4.5 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-slate-950/40 border-t border-slate-850/85">
                                  <td colSpan={6} className="px-6 py-5 border-b border-slate-800/80">
                                    <div className="space-y-4 text-left">
                                      {/* Category Cards */}
                                      <div className="grid grid-cols-3 gap-4">
                                        <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-3">
                                          <span className="text-[10px] uppercase font-bold text-emerald-400">General</span>
                                          <div className="text-base font-bold text-white mt-1">{formatCurrency(donor.generalTotal)}</div>
                                        </div>
                                        <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-3">
                                          <span className="text-[10px] uppercase font-bold text-blue-400">Sahar</span>
                                          <div className="text-base font-bold text-white mt-1">{formatCurrency(donor.saharTotal)}</div>
                                        </div>
                                        <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
                                          <span className="text-[10px] uppercase font-bold text-amber-400">Iftar</span>
                                          <div className="text-base font-bold text-white mt-1">{formatCurrency(donor.iftarTotal)}</div>
                                        </div>
                                      </div>

                                      {/* Category Details */}
                                      <div className="space-y-4 mt-4">
                                        {(['General', 'Sahar', 'Iftar'] as const).map((cat) => {
                                          const catDonations = donor.donations.filter((d) => d.category === cat);
                                          if (catDonations.length === 0) return null;

                                          return (
                                            <div key={cat} className="space-y-2 border-t border-slate-800/40 pt-3.5 first:border-0 first:pt-0">
                                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <span className={`h-1.5 w-1.5 rounded-full ${
                                                  cat === 'General' ? 'bg-emerald-400' :
                                                  cat === 'Sahar' ? 'bg-blue-400' :
                                                  'bg-amber-400'
                                                }`} />
                                                {cat} Contributions ({catDonations.length})
                                              </h4>
                                              <div className="overflow-hidden rounded-lg border border-slate-850 bg-slate-950/50">
                                                <table className="w-full text-xs text-left text-slate-350">
                                                  <thead className="bg-slate-900/40 text-[10px] font-semibold uppercase text-slate-500 border-b border-slate-850">
                                                    <tr>
                                                      <th className="px-4 py-2">Date</th>
                                                      <th className="px-4 py-2">Amount</th>
                                                      <th className="px-4 py-2">Notes</th>
                                                      <th className="px-4 py-2 text-right">Actions</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-slate-850/60">
                                                    {catDonations.map((d) => (
                                                      <tr key={d.id} className="hover:bg-slate-900/20">
                                                        <td className="px-4 py-2 text-slate-400">
                                                          {new Date(d.donation_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                                        </td>
                                                        <td className="px-4 py-2 font-semibold text-emerald-400">
                                                          {formatCurrency(d.amount)}
                                                        </td>
                                                        <td className="px-4 py-2 text-slate-400">
                                                          {renderNotes(d.notes, d)}
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                          <div className="flex items-center justify-end gap-2">
                                                            <button
                                                              onClick={() => handleOpenEditModal(d)}
                                                              className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-blue-400 transition"
                                                              title="Edit Donation"
                                                            >
                                                              <Edit3 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                              onClick={() => handleOpenDeleteModal(d)}
                                                              className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
                                                              title="Delete Donation"
                                                            >
                                                              <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                          </div>
                                                        </td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="grid gap-4 grid-cols-1 md:hidden">
                {viewMode === 'transaction'
                  ? paginatedGroupedTransactions.map((group) => {
                      const isExpanded = expandedTransactionGroups.has(group.key);
                      const isMember = group.member_id !== null;
                      return (
                        <div
                          key={group.key}
                          className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 space-y-3 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white text-base hover:text-indigo-400 transition">
                              <Link href={`/dashboard/donations/donor/${group.donorId}`}>
                                {group.donor_name}
                              </Link>
                            </span>
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                isMember
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {isMember ? 'Member' : 'External'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                            <div>
                              Category:{' '}
                              <span
                                className={`font-semibold ${
                                  group.category === 'General'
                                    ? 'text-emerald-400'
                                    : group.category === 'Sahar'
                                    ? 'text-blue-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {group.category}
                              </span>
                            </div>
                            <div className="text-right font-semibold text-emerald-400">
                              {formatCurrency(group.totalAmount)}
                            </div>
                            <div>
                              Donations: <span className="text-slate-300 font-medium">{group.donationCount}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                            <Link
                              href={`/dashboard/donations/donor/${group.donorId}`}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-indigo-400 transition"
                            >
                              <Eye className="h-3.5 w-3.5" /> View Profile
                            </Link>
                            <button
                              onClick={() => toggleTransactionGroupExpand(group.key)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-850 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 transition"
                            >
                              {isExpanded ? 'Hide History' : 'View History'}
                              <ChevronRight className={`h-3.5 w-3.5 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="pt-3 border-t border-slate-800/40 space-y-2 text-xs text-slate-300">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                History Records ({group.donationCount})
                              </span>
                              <div className="space-y-2">
                                {group.donations.map((d) => (
                                  <div key={d.id} className="rounded border border-slate-850 bg-slate-950/40 p-2.5 space-y-1.5">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[10px] text-slate-400">
                                        {new Date(d.donation_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                      </span>
                                      <span className="font-semibold text-emerald-400">{formatCurrency(d.amount)}</span>
                                    </div>
                                    {d.notes && d.notes.trim() && (
                                      <div className="text-[10px] text-slate-500 bg-slate-950/20 p-1.5 rounded border border-slate-900/60">
                                        Notes: {d.notes}
                                      </div>
                                    )}
                                    <div className="flex justify-end gap-2.5 pt-1.5 border-t border-slate-900/60">
                                      <button
                                        onClick={() => handleOpenEditModal(d)}
                                        className="text-[10px] font-semibold text-slate-400 hover:text-blue-400 transition"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleOpenDeleteModal(d)}
                                        className="text-[10px] font-semibold text-slate-400 hover:text-red-400 transition"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  : paginatedDonors.map((donor) => {
                      const isExpanded = expandedDonors.has(donor.id);
                      return (
                        <div
                          key={donor.id}
                          className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 space-y-3 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white text-base hover:text-indigo-400 transition">
                              <Link href={`/dashboard/donations/donor/${donor.id}`}>
                                {donor.donor_name}
                              </Link>
                            </span>
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                donor.source === 'Member'
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {donor.source}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                            <div>
                              Donations: <span className="text-slate-200 font-medium">{donor.donationCount}</span>
                            </div>
                            <div className="text-right font-semibold text-emerald-400">
                              {formatCurrency(donor.lifetimeTotal)}
                            </div>
                            <div>
                              Latest Date:{' '}
                              <span className="text-slate-300 font-medium">
                                {new Date(donor.latestDonationDate).toLocaleDateString(undefined, {
                                  dateStyle: 'medium',
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                            <Link
                              href={`/dashboard/donations/donor/${donor.id}`}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-indigo-400 transition"
                            >
                              <Eye className="h-3.5 w-3.5" /> View Profile
                            </Link>
                            <button
                              onClick={() => toggleDonorExpand(donor.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-850 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 transition"
                            >
                              {isExpanded ? 'Hide Details' : 'Show Details'}
                              <ChevronRight className={`h-3.5 w-3.5 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="pt-3 border-t border-slate-800/40 space-y-4 text-xs text-slate-300">
                              {/* Category Cards (small grid) */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded border border-emerald-500/10 bg-emerald-500/5 p-2 text-center">
                                  <span className="text-[9px] uppercase font-bold text-emerald-400 block">General</span>
                                  <span className="text-[11px] font-bold text-white">{formatCurrency(donor.generalTotal)}</span>
                                </div>
                                <div className="rounded border border-blue-500/10 bg-blue-500/5 p-2 text-center">
                                  <span className="text-[9px] uppercase font-bold text-blue-400 block">Sahar</span>
                                  <span className="text-[11px] font-bold text-white">{formatCurrency(donor.saharTotal)}</span>
                                </div>
                                <div className="rounded border border-amber-500/10 bg-amber-500/5 p-2 text-center">
                                  <span className="text-[9px] uppercase font-bold text-amber-400 block">Iftar</span>
                                  <span className="text-[11px] font-bold text-white">{formatCurrency(donor.iftarTotal)}</span>
                                </div>
                              </div>

                              {/* Individual Records list */}
                              <div className="space-y-3">
                                {(['General', 'Sahar', 'Iftar'] as const).map((cat) => {
                                  const catDonations = donor.donations.filter((d) => d.category === cat);
                                  if (catDonations.length === 0) return null;

                                  return (
                                    <div key={cat} className="space-y-1.5">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        {cat} ({catDonations.length})
                                      </span>
                                      <div className="space-y-2">
                                        {catDonations.map((d) => (
                                          <div key={d.id} className="rounded border border-slate-850 bg-slate-950/40 p-2.5 space-y-1.5">
                                            <div className="flex justify-between items-center">
                                              <span className="text-[10px] text-slate-400">
                                                {new Date(d.donation_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                              </span>
                                              <span className="font-semibold text-emerald-400">{formatCurrency(d.amount)}</span>
                                            </div>
                                            {d.notes && d.notes.trim() && (
                                              <div className="text-[10px] text-slate-500 bg-slate-950/20 p-1.5 rounded border border-slate-900/60">
                                                Notes: {d.notes}
                                              </div>
                                            )}
                                            <div className="flex justify-end gap-2.5 pt-1.5 border-t border-slate-900/60">
                                              <button
                                                onClick={() => handleOpenEditModal(d)}
                                                className="text-[10px] font-semibold text-slate-400 hover:text-blue-400 transition"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                onClick={() => handleOpenDeleteModal(d)}
                                                className="text-[10px] font-semibold text-slate-400 hover:text-red-400 transition"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-sm text-slate-400">
                  <span>
                    Showing <span className="text-slate-200">{startIndex + 1}</span> to{' '}
                    <span className="text-slate-200">
                      {Math.min(startIndex + itemsPerPage, totalItems)}
                    </span>{' '}
                    of <span className="text-slate-200">{totalItems}</span> records
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                      className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition"
                    >
                      Previous
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 1 column: Top Donors Widget */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-md backdrop-blur-md">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" /> Top Donors
            </h3>
            <div className="space-y-3.5">
              {topFiveDonors.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No donors found yet</p>
              ) : (
                topFiveDonors.map((donor, index) => (
                  <div key={donor.id} className="flex items-center justify-between py-2 border-b border-slate-800/40 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        index === 1 ? 'bg-slate-300/10 text-slate-300 border border-slate-300/20' :
                        index === 2 ? 'bg-amber-700/10 text-amber-600 border border-amber-700/20' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <Link href={`/dashboard/donations/donor/${donor.id}`} className="font-semibold text-sm text-slate-200 hover:underline hover:text-indigo-400 truncate block">
                          {donor.donor_name}
                        </Link>
                        <span className="text-[10px] text-slate-500">{donor.donationCount} {donor.donationCount === 1 ? 'donation' : 'donations'} • {donor.source}</span>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-emerald-400 shrink-0">
                      {formatCurrency(donor.lifetimeTotal)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log Donation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setIsAddModalOpen(false);
              setShowMemberDropdown(false);
            }}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up text-left z-10">
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setShowMemberDropdown(false);
              }}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 animate-pulse">
                <Heart className="h-5 w-5 fill-indigo-400/20" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Log Donation</h3>
                <p className="text-xs text-slate-400">Record a general, Sahar, or Iftar contribution.</p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveDonation} className="mt-4 space-y-4">
              {/* Donation Source Selector Toggle */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Donation Source
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-slate-300 text-sm font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="sourceType"
                      checked={donationSource === 'Member'}
                      onChange={() => {
                        setDonationSource('Member');
                        setFormError(null);
                        setPhone('');
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-800 bg-slate-950"
                    />
                    Existing Member
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 text-sm font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="sourceType"
                      checked={donationSource === 'External'}
                      onChange={() => {
                        setDonationSource('External');
                        setFormError(null);
                        setSelectedMember(null);
                        setPhone('');
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-800 bg-slate-950"
                    />
                    External Donor (Non-Member)
                  </label>
                </div>
              </div>

              {/* Source-specific fields */}
              {donationSource === 'Member' ? (
                /* EXISTING MEMBER SELECTOR */
                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Search and Select Member <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Search className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Type member name or phone..."
                      value={memberSearchQuery}
                      onChange={(e) => {
                        setMemberSearchQuery(e.target.value);
                        setShowMemberDropdown(true);
                      }}
                      onFocus={() => setShowMemberDropdown(true)}
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    {selectedMember && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMember(null);
                          setMemberSearchQuery('');
                          setPhone('');
                        }}
                        className="absolute right-3 top-2.5 p-0.5 rounded text-slate-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showMemberDropdown && (
                    <div className="absolute z-20 w-full mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 shadow-2xl divide-y divide-slate-900 scrollbar-thin">
                      {filteredAutocompleteMembers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-500 italic">No matching members found</div>
                      ) : (
                        filteredAutocompleteMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMember(m);
                              setMemberSearchQuery(m.full_name);
                              setShowMemberDropdown(false);
                              if (m.phone) setPhone(m.phone);
                            }}
                            className="flex flex-col w-full text-left p-2.5 text-sm hover:bg-slate-900 transition-colors"
                          >
                            <span className="font-semibold text-slate-200">{m.full_name}</span>
                            <span className="text-xs text-slate-500 mt-0.5">{m.phone}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {selectedMember && (
                    <div className="mt-2 text-xs text-indigo-400 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Selected: <strong>{selectedMember.full_name}</strong> (Linked successfully)
                    </div>
                  )}
                </div>
              ) : (
                /* EXTERNAL DONOR NAME INPUT WITH AUTOCOMPLETE */
                <div className="relative" ref={externalRef}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Donor Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={donorName}
                      onChange={(e) => {
                        setDonorName(e.target.value);
                        setShowExternalDropdown(true);
                      }}
                      onFocus={() => setShowExternalDropdown(true)}
                      placeholder="Jane Smith"
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  {showExternalDropdown && donorName.trim() !== '' && (
                    <div className="absolute z-20 w-full mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 shadow-2xl divide-y divide-slate-900 scrollbar-thin">
                      {filteredAutocompleteExternalDonors.length > 0 && (
                        <div className="px-3 py-1 text-[10px] font-bold text-indigo-400 bg-slate-900/50 uppercase tracking-wider">Previous Donors</div>
                      )}
                      {filteredAutocompleteExternalDonors.length === 0 ? (
                        <div className="p-3 text-xs text-slate-500 italic">New donor profile will be created</div>
                      ) : (
                        filteredAutocompleteExternalDonors.map((d, index) => (
                          <button
                            key={`ext-${index}`}
                            type="button"
                            onClick={() => {
                              setDonorName(d.donor_name);
                              if (d.phone) {
                                setPhone(d.phone);
                              }
                              setShowExternalDropdown(false);
                            }}
                            className="flex flex-col w-full text-left p-2.5 text-sm hover:bg-slate-900 transition-colors"
                          >
                            <span className="font-semibold text-slate-200">{d.donor_name}</span>
                            {d.phone && <span className="text-xs text-slate-500 mt-0.5">{d.phone}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Phone Number (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Category & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'General' | 'Sahar' | 'Iftar')}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="General">General</option>
                    <option value="Sahar">Sahar</option>
                    <option value="Iftar">Iftar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <IndianRupee className="h-4 w-4" />
                    </div>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="1000"
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Donation Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Donation Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={donationDate}
                  onChange={setDonationDate}
                  required
                />
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ramadan collection, building support, anonymous donor etc..."
                  rows={3}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setShowMemberDropdown(false);
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Save Donation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Notes Modal */}
      {viewingNotesDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setViewingNotesDonation(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up text-left z-10">
            <button
              onClick={() => setViewingNotesDonation(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Donation Notes</h3>
                <p className="text-xs text-slate-400">For {viewingNotesDonation.donor_name}</p>
              </div>
            </div>
            <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-850 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {viewingNotesDonation.notes}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewingNotesDonation(null)}
                className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Donation Modal */}
      {isEditModalOpen && editingDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingDonation(null);
            }}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up text-left z-10">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingDonation(null);
              }}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 animate-pulse">
                <Heart className="h-5 w-5 fill-indigo-400/20" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Edit Donation</h3>
                <p className="text-xs text-slate-400">Modify donation record details.</p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEditDonation} className="mt-4 space-y-4">
              {/* If member donation, lock name and phone display */}
              {donationSource === 'Member' ? (
                <div className="p-3.5 rounded-lg border border-indigo-500/10 bg-indigo-500/5">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">Member Donor (Locked)</span>
                  <span className="text-sm font-bold text-slate-200 block mt-0.5">{editingDonation.donor_name}</span>
                  {editingDonation.phone && <span className="text-xs text-slate-500">{editingDonation.phone}</span>}
                </div>
              ) : (
                /* If external donation, allow modifying donor name and phone */
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Donor Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        placeholder="Jane Smith"
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Phone Number (Optional)
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 XXXXX XXXXX"
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Category & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'General' | 'Sahar' | 'Iftar')}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="General">General</option>
                    <option value="Sahar">Sahar</option>
                    <option value="Iftar">Iftar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <IndianRupee className="h-4 w-4" />
                    </div>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="1000"
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Donation Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Donation Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={donationDate}
                  onChange={setDonationDate}
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ramadan contribution details, cheque info, receipts, etc."
                  rows={3}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingDonation(null);
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setDeletingDonation(null);
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-scale-up text-left z-10">
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeletingDonation(null);
              }}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Delete Donation</h3>
              <p className="text-xs text-slate-400 mt-1">Are you sure you want to permanently delete this donation?</p>
            </div>

            <div className="my-6 space-y-3.5 p-4 rounded-xl bg-slate-950 border border-slate-850">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Donation Amount:</span>
                <span className="font-extrabold text-red-400 text-lg">{formatCurrency(deletingDonation.amount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Donor Name:</span>
                <span className="font-bold text-slate-200">{deletingDonation.donor_name}</span>
              </div>
              {deletingDonation.donation_date && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Donation Date:</span>
                  <span className="font-semibold text-slate-400">{formatDate(new Date(deletingDonation.donation_date))}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingDonation(null);
                }}
                className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DonationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500 mt-3">Loading Donations page...</p>
        </div>
      }
    >
      <DonationsPageContent />
    </Suspense>
  );
}
